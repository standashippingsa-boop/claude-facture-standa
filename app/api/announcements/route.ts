import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { clientIp, rateLimit, tooMany } from "@/lib/ratelimit";
import { sendPushToCustomer } from "@/lib/push-server";
import { sendFcmToCustomer } from "@/lib/push-fcm-server";

/**
 * ANNONS POU TOUT KLIYAN — ADMIN SÈLMAN.
 * ═══════════════════════════════════════════════════════════════════
 * POST multipart (FormData): token, title, body, image (jpg/png/webp ≤ 4 Mo)
 *   → foto a monte nan bucket piblik "announcements", annons lan anrejistre,
 *     epi chak kliyan ki gen yon telefòn anrejistre resevwa yon push.
 * POST JSON { token, action: "deactivate", id } → annons lan pa parèt ankò.
 * GET (Authorization: Bearer) → lis annons yo pou paj admin lan.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_IMAGE = 4 * 1024 * 1024;

async function requireAdmin(token: string) {
  const config = getSupabaseAdminConfig();
  if (!config) return { ok: false as const, status: 503, reason: "Service indisponible." };
  if (!token) return { ok: false as const, status: 401, reason: "Session expirée. Reconnectez-vous." };
  const db: any = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth } = await db.auth.getUser(token);
  if (!auth.user) return { ok: false as const, status: 401, reason: "Session expirée. Reconnectez-vous." };
  const { data: staff } = await db.from("staff").select("username, prenom, nom, role").eq("auth_user_id", auth.user.id).maybeSingle();
  if (!staff || staff.role !== "admin") return { ok: false as const, status: 403, reason: "Accès administrateur requis." };
  const name = [staff.prenom, staff.nom].filter(Boolean).join(" ") || staff.username || "Administrateur";
  return { ok: true as const, db, config, name };
}

const bearer = (req: Request) => (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

export async function GET(req: Request) {
  const gate = await requireAdmin(bearer(req));
  if (!gate.ok) return NextResponse.json({ ok: false, reason: gate.reason }, { status: gate.status });
  const { data, error } = await gate.db.from("announcements").select("*").order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ ok: false, reason: "Liste indisponible." }, { status: 500 });
  return NextResponse.json({ ok: true, announcements: data ?? [] });
}

export async function POST(req: Request) {
  const rl = rateLimit(`announcements:${clientIp(req)}`, 10, 60 * 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);
  try {
    const contentType = req.headers.get("content-type") ?? "";

    // ── Retire yon annons ──
    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => null);
      const gate = await requireAdmin(String(body?.token ?? "") || bearer(req));
      if (!gate.ok) return NextResponse.json({ ok: false, reason: gate.reason }, { status: gate.status });
      const id = String(body?.id ?? "");
      if (body?.action !== "deactivate" || !UUID.test(id)) return NextResponse.json({ ok: false, reason: "Demande invalide." }, { status: 400 });
      const { error } = await gate.db.from("announcements").update({ active: false }).eq("id", id);
      if (error) return NextResponse.json({ ok: false, reason: "Impossible de retirer l'annonce." }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // ── Nouvo annons ──
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ ok: false, reason: "Formulaire invalide." }, { status: 400 });
    const gate = await requireAdmin(String(form.get("token") ?? "") || bearer(req));
    if (!gate.ok) return NextResponse.json({ ok: false, reason: gate.reason }, { status: gate.status });

    const title = String(form.get("title") ?? "").trim().slice(0, 120);
    const text = String(form.get("body") ?? "").trim().slice(0, 2000);
    if (!title) return NextResponse.json({ ok: false, reason: "Écrivez un titre." }, { status: 400 });

    let imagePath: string | null = null;
    const image = form.get("image");
    if (image && typeof image !== "string" && image.size > 0) {
      const ext = IMAGE_TYPES[image.type];
      if (!ext) return NextResponse.json({ ok: false, reason: "Image JPG, PNG ou WEBP uniquement." }, { status: 400 });
      if (image.size > MAX_IMAGE) return NextResponse.json({ ok: false, reason: "Image trop lourde (4 Mo maximum)." }, { status: 400 });
      imagePath = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
      const upload = await gate.db.storage.from("announcements").upload(imagePath, Buffer.from(await image.arrayBuffer()), { contentType: image.type, upsert: false });
      if (upload.error) return NextResponse.json({ ok: false, reason: "L'image n'a pas pu être envoyée." }, { status: 500 });
    }

    const inserted = await gate.db.from("announcements")
      .insert({ title, body: text, image_path: imagePath, created_by: gate.name }).select("*").single();
    if (inserted.error) return NextResponse.json({ ok: false, reason: "Annonce non enregistrée." }, { status: 500 });

    // Push pou chak kliyan ki gen omwen yon telefòn anrejistre (navigatè oswa app Android).
    const [web, fcm] = await Promise.all([
      gate.db.from("push_subscriptions").select("customer_code").limit(20000),
      gate.db.from("fcm_device_tokens").select("customer_code").limit(20000)
    ]);
    const codes = Array.from(new Set([...(web.data ?? []), ...(fcm.data ?? [])]
      .map((row: { customer_code: string | null }) => String(row.customer_code ?? "").trim()).filter(Boolean)));
    const copy = { title, text: text ? text.slice(0, 140) : "Nouvelle annonce STANDA COMMERCIAL", url: "/espace-client" };
    let devices = 0;
    for (let start = 0; start < codes.length; start += 10) {
      const results = await Promise.allSettled(codes.slice(start, start + 10).flatMap((code) => [
        sendPushToCustomer(gate.config, code, copy), sendFcmToCustomer(gate.config, code, copy)
      ]));
      for (const result of results) if (result.status === "fulfilled") devices += result.value;
    }

    await gate.db.from("journal").insert({
      user_name: gate.name, action: "Annonce publiée",
      details: `${title} · ${codes.length} client(s) avec notifications · ${devices} appareil(s) atteint(s)`,
      package_ref: "", customer_code: ""
    });
    return NextResponse.json({ ok: true, announcement: inserted.data, clients: codes.length, devices });
  } catch (error) {
    console.error("[announcements]", error);
    return NextResponse.json({ ok: false, reason: "Publication impossible. Réessayez." }, { status: 500 });
  }
}
