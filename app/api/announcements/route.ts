import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { sendPushToCustomer } from "@/lib/push-server";
import { sendFcmToCustomer } from "@/lib/push-fcm-server";
import { normalizeMcCode } from "@/lib/utils";

/**
 * ANNONS POU KLIYAN — ADMIN SÈLMAN.
 * ═══════════════════════════════════════════════════════════════════
 * Tout demann se JSON ak `token` + `action`:
 *  • "upload_urls" { files: [{ type, size }] } → lyen siyen pou navigatè a
 *     monte foto/videyo yo DIRÈK nan Storage (pa gen limit 4,5 Mo Vercel).
 *  • "publish" { title, body, media: [{ path, kind }], audience_type, audience_values }
 *     → anons lan anrejistre, epi kliyan ki nan piblik la resevwa yon push.
 *  • "deactivate" { id } → anons lan pa parèt ankò.
 * GET (Authorization: Bearer) → lis annons yo pou paj admin lan.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
const MEDIA_TYPES: Record<string, { ext: string; kind: "image" | "video" }> = {
  "image/jpeg": { ext: "jpg", kind: "image" }, "image/png": { ext: "png", kind: "image" }, "image/webp": { ext: "webp", kind: "image" },
  "video/mp4": { ext: "mp4", kind: "video" }, "video/quicktime": { ext: "mov", kind: "video" }, "video/webm": { ext: "webm", kind: "video" }
};
const MAX_FILE = 50 * 1024 * 1024;
const MAX_FILES = 10;
const ACCOUNT_TYPES = new Set(["Personnel", "Business", "VIP"]);
const AUDIENCES = new Set(["all", "villes", "account_types", "clients"]);
const MEDIA_PATH = /^uploads\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp|mp4|mov|webm)$/i;

async function requireAdmin(token: string) {
  const config = getSupabaseAdminConfig();
  if (!config) return { ok: false as const, status: 503, reason: "Service indisponible." };
  if (!token) return { ok: false as const, status: 401, reason: "Session expirée. Veuillez vous reconnecter." };
  const db: any = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth } = await db.auth.getUser(token);
  if (!auth.user) return { ok: false as const, status: 401, reason: "Session expirée. Veuillez vous reconnecter." };
  const { data: staff } = await db.from("staff").select("username, prenom, nom, role").eq("auth_user_id", auth.user.id).maybeSingle();
  if (!staff || staff.role !== "admin") return { ok: false as const, status: 403, reason: "Accès administrateur requis." };
  const name = [staff.prenom, staff.nom].filter(Boolean).join(" ") || staff.username || "Administrateur";
  return { ok: true as const, db, config, name };
}

const bearer = (req: Request) => (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
const fail = (reason: string, status = 400) => NextResponse.json({ ok: false, reason }, { status });

export async function GET(req: Request) {
  const gate = await requireAdmin(bearer(req));
  if (!gate.ok) return fail(gate.reason, gate.status);
  const { data, error } = await gate.db.from("announcements").select("*").order("created_at", { ascending: false }).limit(50);
  if (error) return fail("Liste indisponible.", 500);
  return NextResponse.json({ ok: true, announcements: data ?? [] });
}

/** Kòd kliyan ki nan piblik la (null = tout moun). */
async function audienceCodes(db: any, type: string, values: string[]): Promise<string[] | null> {
  if (type === "all") return null;
  if (type === "clients") return values;
  const query = db.from("clients").select("customer_code").neq("customer_code", "").limit(20000);
  const { data } = type === "villes" ? await query.in("ville_id", values) : await query.in("account_type", values);
  return ((data ?? []) as { customer_code: string }[]).map((row) => row.customer_code);
}

export async function POST(req: Request) {
  // Pas de limite : action réservée à l'administrateur (vérifiée plus bas).
  try {
    const body = await req.json().catch(() => null);
    if (!body) return fail("Demande invalide.");
    const gate = await requireAdmin(String(body.token ?? "") || bearer(req));
    if (!gate.ok) return fail(gate.reason, gate.status);
    const { db, config, name } = gate;

    // ── Lyen siyen pou monte fichye yo ──
    if (body.action === "upload_urls") {
      const files = Array.isArray(body.files) ? body.files : [];
      if (!files.length || files.length > MAX_FILES) return fail(`Entre 1 et ${MAX_FILES} fichiers.`);
      const day = new Date().toISOString().slice(0, 10);
      const uploads = [];
      for (const file of files) {
        const meta = MEDIA_TYPES[String(file?.type ?? "")];
        if (!meta) return fail("Formats acceptés : JPG, PNG, WEBP, MP4, MOV, WEBM.");
        if (!(Number(file?.size) > 0) || Number(file.size) > MAX_FILE) return fail("Chaque fichier doit faire moins de 50 Mo.");
        const path = `uploads/${day}/${crypto.randomUUID()}.${meta.ext}`;
        const signed = await db.storage.from("announcements").createSignedUploadUrl(path);
        if (signed.error || !signed.data) return fail("Préparation de l'envoi impossible.", 500);
        uploads.push({ path, token: signed.data.token, kind: meta.kind });
      }
      return NextResponse.json({ ok: true, uploads });
    }

    // ── Retire yon anons ──
    if (body.action === "deactivate") {
      const id = String(body.id ?? "");
      if (!UUID.test(id)) return fail("Demande invalide.");
      const { error } = await db.from("announcements").update({ active: false }).eq("id", id);
      if (error) return fail("Impossible de retirer l'annonce.", 500);
      return NextResponse.json({ ok: true });
    }

    if (body.action !== "publish") return fail("Action inconnue.");

    // ── Nouvo anons ──
    const title = String(body.title ?? "").trim().slice(0, 120);
    const text = String(body.body ?? "").trim().slice(0, 2000);
    if (!title) return fail("Écrivez un titre.");

    const media = (Array.isArray(body.media) ? body.media : []).slice(0, MAX_FILES)
      .map((item: { path?: unknown; kind?: unknown }) => ({ path: String(item?.path ?? ""), kind: item?.kind === "video" ? "video" : "image" }))
      .filter((item: { path: string }) => MEDIA_PATH.test(item.path));

    const audienceType = String(body.audience_type ?? "all");
    if (!AUDIENCES.has(audienceType)) return fail("Public invalide.");
    let values: string[] = Array.from(new Set((Array.isArray(body.audience_values) ? body.audience_values : []).map((value: unknown) => String(value ?? "").trim()).filter(Boolean))) as string[];
    if (audienceType === "villes") values = values.filter((value) => UUID.test(value));
    if (audienceType === "account_types") values = values.filter((value) => ACCOUNT_TYPES.has(value));
    if (audienceType === "clients") values = Array.from(new Set(values.map((value) => normalizeMcCode(value)).filter(Boolean)));
    if (audienceType !== "all" && !values.length) return fail("Choisissez au moins un élément pour le public.");
    if (values.length > 2000) return fail("Liste de public trop longue.");

    const inserted = await db.from("announcements").insert({
      title, body: text, media, image_path: media.find((item: { kind: string }) => item.kind === "image")?.path ?? null,
      audience_type: audienceType, audience_values: audienceType === "all" ? [] : values, created_by: name
    }).select("*").single();
    if (inserted.error) return fail("Annonce non enregistrée.", 500);

    // Push: kliyan ki gen yon telefòn anrejistre ET ki nan piblik la.
    const [web, fcm] = await Promise.all([
      db.from("push_subscriptions").select("customer_code").limit(20000),
      db.from("fcm_device_tokens").select("customer_code").limit(20000)
    ]);
    const target = await audienceCodes(db, audienceType, values);
    const targetSet = target ? new Set(target) : null;
    const codes = Array.from(new Set([...(web.data ?? []), ...(fcm.data ?? [])]
      .map((row: { customer_code: string | null }) => String(row.customer_code ?? "").trim()).filter(Boolean)))
      .filter((code) => !targetSet || targetSet.has(code));
    const copy = { title, text: text ? text.slice(0, 140) : "Nouvelle annonce STANDA COMMERCIAL", url: "/espace-client" };
    let devices = 0;
    for (let start = 0; start < codes.length; start += 10) {
      const results = await Promise.allSettled(codes.slice(start, start + 10).flatMap((code) => [
        sendPushToCustomer(config, code, copy), sendFcmToCustomer(config, code, copy)
      ]));
      for (const result of results) if (result.status === "fulfilled") devices += result.value;
    }

    const audienceLabel = audienceType === "all" ? "tous les clients" : `${audienceType} (${values.length})`;
    await db.from("journal").insert({
      user_name: name, action: "Annonce publiée",
      details: `${title} · ${media.length} média(s) · public : ${audienceLabel} · ${codes.length} client(s) notifiable(s) · ${devices} appareil(s)`,
      package_ref: "", customer_code: ""
    });
    return NextResponse.json({ ok: true, announcement: inserted.data, clients: codes.length, devices, audienceSize: target ? target.length : null });
  } catch (error) {
    console.error("[announcements]", error);
    return fail("Publication impossible. Réessayez.", 500);
  }
}
