import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { SITE_IMAGE_BUCKET, SITE_IMAGE_PREFIX, SITE_IMAGE_SLOTS, isSlot, settingKey } from "@/lib/site-image-slots";

/**
 * Images du site public (administrateur seulement).
 *  upload_url : lien signé pour déposer une image dans site/<emplacement>/
 *  set        : enregistre l'image déposée pour l'emplacement
 *  reset      : revient à l'image d'origine
 */
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX = 8 * 1024 * 1024;
const fail = (reason: string, status = 400) => NextResponse.json({ ok: false, reason }, { status });

async function admin(token: string) {
  const config = getSupabaseAdminConfig();
  if (!config) return null;
  const db = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: who } = await db.auth.getUser(token);
  if (!who.user) return null;
  const { data: staff } = await db.from("staff").select("role, username").eq("auth_user_id", who.user.id).maybeSingle();
  if (staff?.role !== "admin") return null;
  return { db, config, username: String(staff.username ?? "admin") };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const gate = await admin(String(body?.token ?? ""));
    if (!gate) return fail("Accès administrateur requis.", 403);
    const { db, config } = gate;

    if (body.action === "list") {
      const { data } = await db.from("app_settings").select("key, value").in("key", SITE_IMAGE_SLOTS.map((s) => settingKey(s.key)));
      const map = Object.fromEntries(((data ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value]));
      return NextResponse.json({ ok: true, images: Object.fromEntries(SITE_IMAGE_SLOTS.map((s) => [s.key, map[settingKey(s.key)] || ""])) });
    }

    const slot = String(body.slot ?? "");
    if (!isSlot(slot)) return fail("Emplacement inconnu.");

    if (body.action === "upload_url") {
      const ext = TYPES[String(body.type ?? "")];
      if (!ext) return fail("Formats acceptés : JPG, PNG, WEBP.");
      if (!(Number(body.size) > 0) || Number(body.size) > MAX) return fail("L'image doit faire moins de 8 Mo.");
      const path = `${SITE_IMAGE_PREFIX}${slot}/${crypto.randomUUID()}.${ext}`;
      const signed = await db.storage.from(SITE_IMAGE_BUCKET).createSignedUploadUrl(path);
      if (signed.error || !signed.data) return fail("Préparation de l'envoi impossible.", 500);
      return NextResponse.json({ ok: true, path, token: signed.data.token });
    }

    if (body.action === "set") {
      const path = String(body.path ?? "");
      if (!new RegExp(`^${SITE_IMAGE_PREFIX}${slot}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(path)) return fail("Image invalide.");
      const url = `${config.url}/storage/v1/object/public/${SITE_IMAGE_BUCKET}/${path}`;
      const { error } = await db.from("app_settings").upsert({ key: settingKey(slot), value: url }, { onConflict: "key" });
      if (error) return fail("Enregistrement impossible.", 500);
      await db.from("journal").insert({ user_name: gate.username, action: "Image du site modifiée", details: SITE_IMAGE_SLOTS.find((s) => s.key === slot)?.label ?? slot, package_ref: "", customer_code: "" });
      return NextResponse.json({ ok: true, url });
    }

    if (body.action === "reset") {
      const { error } = await db.from("app_settings").delete().eq("key", settingKey(slot));
      if (error) return fail("Opération impossible.", 500);
      return NextResponse.json({ ok: true });
    }
    return fail("Action inconnue.");
  } catch {
    return fail("Erreur serveur.", 500);
  }
}
