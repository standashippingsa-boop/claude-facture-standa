import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SITE_URL, SUPPORT_PHONE } from "@/lib/branding";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { sendPushToCustomer } from "@/lib/push-server";
import { sendFcmToCustomer } from "@/lib/push-fcm-server";
import { customerParcelCopy } from "@/lib/customer-push";
import { buildHtml, domainOf, esc, EXPECTED_FROM, fromValue, sendViaResend, type NotifyBody } from "@/lib/customer-mail";

/**
 * Email otomatik (Reçu à Miami / Disponible) via Resend (https://resend.com).
 * Konfigirasyon nan Vercel > Settings > Environment Variables:
 *   RESEND_API_KEY = re_xxxxx          (obligatwa pou email yo pati)
 *   EMAIL_FROM     = "STANDA COMMERCIAL <notifications@standacommercialsa.com>" (opsyonèl)
 * San RESEND_API_KEY, wout la reponn { skipped: true } san kraze anyen.
 *
 * LAYOUT (V10) — "DÉTAILS DU COLIS"
 * ─────────────────────────────────
 * PA GEN TABLO. Menm prensip ak popup "Détails du colis" nan aplikasyon an:
 * ETIKÈT agoch (gri) · VALÈ adwat (nwa, gra), chak enfòmasyon sou liy pa li.
 *
 *   Code Client        MC-36578
 *   Nom Client         DOKASAV SERVICES
 *   Ville              Ouanaminthe
 *   ─────────────────────────────
 *   Tracking ID        WR102600176452
 *   Tracking Number    GFUS01066667784640
 *   Poids              0.5 lb
 *   Contenu            ACC. PERSONAL
 *
 * YON SÈL LAYOUT pou TOUT ekran: sa kliyan an wè sou telefòn se EGZAKTEMAN
 * sa li wè sou òdinatè. Pa gen vèsyon mobil apa, pa gen kolòn ki kase,
 * pa gen scroll orizontal. Konpak espre pou l antre sou yon sèl ekran
 * telefòn (majorite kliyan yo sou telefòn).
 *
 * Done manke -> "—". Nou pa janm envante anyen.
 */

/** Verifye sesyon an se yon manm pèsonèl STANDA (menm modèl ak /api/audit-log). */
async function requireStaff(token: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const config = getSupabaseAdminConfig();
  if (!config) return { ok: false, status: 200, error: "Konfigirasyon sèvè enkonplè: SUPABASE_SECRET_KEY manke." };
  const svc = createClient(config.url, config.key, { auth: { persistSession: false } });
  const { data: au } = await svc.auth.getUser(token);
  if (!au?.user) return { ok: false, status: 401, error: "Sesyon obligatwa." };
  const { data: staff } = await svc.from("staff").select("role").eq("auth_user_id", au.user.id).maybeSingle();
  if (!staff) return { ok: false, status: 403, error: "Rezève pou pèsonèl STANDA." };
  return { ok: true };
}

/**
 * Notifikasyon PUSH — kanal SEPARE de imèl la. Li pa depann ni de
 * RESEND_API_KEY ni de yon adrès imèl kliyan; sèl bagay li bezwen se kle
 * VAPID yo (Vercel > Environment Variables) ak omwen yon abònman aktif pou
 * customer_code la nan `push_subscriptions`.
 */
function pushCopy(body: NotifyBody): { title: string; text: string } {
  const n = body.packages?.length ?? 0;
  if (body.type === "facture") {
    const plural = n > 1;
    return {
      title: "Votre facture est prête",
      text: plural ? `Une facture pour ${n} colis est disponible dans l'application.` : "Votre facture est disponible dans l'application."
    };
  }
  // Même texte que l'extension MCPACK et la confirmation du Bon de remise.
  return customerParcelCopy(body.type === "recu_miami" ? "recu_miami" : "disponible", n);
}

interface ProbeBody { probe?: "diag" | "test" | "sample"; token?: string; to?: string; sample?: "recu_miami" | "disponible" }

export async function POST(req: Request) {
  // PA GEN LIMIT: chak voye mande yon sesyon pèsonèl STANDA (requireStaff),
  // kidonk okenn kliyan ni moun deyò pa ka itilize wout sa a pou spam.
  // Yon kliyan ka resevwa otan notifikasyon + imèl ke operasyon yo mande.

  let body: (NotifyBody & ProbeBody) | null = null;
  try { body = (await req.json()) as NotifyBody & ProbeBody; } catch { /* body rete null */ }
  if (!body) return NextResponse.json({ ok: false, code: "bad_body", error: "Kò demann nan pa valab." }, { status: 200 });

  const key = process.env.RESEND_API_KEY;

  // ── PROBE : dyagnostik + imèl tès (Paramètres > Notifications email) ──
  // ── EGZANP: voye VRÈ modèl imèl kliyan an (fo done) bay admin nan ──
  if (body.probe === "sample") {
    const gate = await requireStaff(String(body.token ?? ""));
    if (!gate.ok) return NextResponse.json({ ok: false, code: "auth", error: gate.error }, { status: gate.status });
    const to = String(body.to ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) return NextResponse.json({ ok: false, code: "bad_to", error: "Adrès imèl la pa valab." }, { status: 200 });
    if (!key) return NextResponse.json({ ok: false, code: "no_key", error: "RESEND_API_KEY pa konfigire nan Vercel." }, { status: 200 });
    const type = body.sample === "disponible" ? "disponible" : "recu_miami";
    const { subject, html } = buildHtml({
      type,
      client: { name: "Marie Joseph", code: "MC-XXXXX", ville: "Gonaïves", email: to },
      packages: [
        { tracking_number: "WR102600237168", tracking_manual: "SPXMIA0136726100", content: "ACC. PERSONAL", weight: 4, fournisseur: "SHEIN" },
        { tracking_number: "WR102600233342", tracking_manual: "1Z999AA10123456784", content: "Chaussures", weight: 0.65, fournisseur: "Amazon" }
      ]
    } as NotifyBody);
    const r = await sendViaResend(key, to, `[EXEMPLE] ${subject}`, html);
    return r.ok
      ? NextResponse.json({ ok: true, id: r.id, to })
      : NextResponse.json({ ok: false, code: r.code, status: r.status, error: r.message, to }, { status: 200 });
  }

  if (body.probe === "diag" || body.probe === "test") {
    const gate = await requireStaff(String(body.token ?? ""));
    if (!gate.ok) return NextResponse.json({ ok: false, code: "auth", error: gate.error }, { status: gate.status });

    const from = fromValue();
    const config = {
      resend_key_present: !!key,
      email_from: from,
      from_domain: domainOf(from),
      from_is_default: !process.env.EMAIL_FROM,
      domain_matches_expected: domainOf(from) === domainOf(EXPECTED_FROM),
    };
    if (body.probe === "diag") return NextResponse.json({ ok: true, config });

    // probe === "test" — voye yon vrè imèl epi remonte repons egzat Resend la
    const to = String(body.to ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) {
      return NextResponse.json({ ok: false, code: "bad_to", error: "Adrès imèl tès la pa valab.", config }, { status: 200 });
    }
    if (!key) {
      return NextResponse.json({ ok: false, code: "no_key", error: "RESEND_API_KEY pa konfigire nan Vercel.", config }, { status: 200 });
    }
    const now = new Date().toLocaleString("fr-FR");
    const testHtml =
      `<!DOCTYPE html><html><body style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;padding:24px;color:#111827">`
      + `<h2 style="margin:0 0 8px">✅ Le système de courriel fonctionne</h2>`
      + `<p style="color:#4B5563;font-size:14px">Message de test envoyé depuis Paramètres → Notifications courriel.<br>`
      + `Expéditeur : <code>${esc(from)}</code><br>Date : ${esc(now)}</p>`
      + `<p style="color:#9CA3AF;font-size:12px">STANDA COMMERCIAL · ${esc(SITE_URL.replace("https://", ""))} · ${esc(SUPPORT_PHONE)}</p>`
      + `</body></html>`;
    const r = await sendViaResend(key, to, "Test STANDA COMMERCIAL · notifications courriel", testHtml);
    return r.ok
      ? NextResponse.json({ ok: true, id: r.id, config, to })
      : NextResponse.json({ ok: false, code: r.code, status: r.status, error: r.message, config, to }, { status: 200 });
  }

  // ── Wout nòmal : notifikasyon "Reçu à Miami" / "Disponible" ──
  // SEKIRITE: se yon manm pèsonèl STANDA sèlman ki ka fè sèvè a voye yon imèl.
  // Anvan, wout sa a te louvri — nenpòt moun te ka fè domèn ofisyèl la voye
  // imèl bay nenpòt adrès (phishing, spam, domaj repitasyon).
  const notifyGate = await requireStaff(String((body as ProbeBody).token ?? ""));
  if (!notifyGate.ok) {
    return NextResponse.json({ ok: false, code: "auth", error: notifyGate.error }, { status: notifyGate.status });
  }

  // Push la se yon kanal SEPARE: nou eseye l kanmenm si imèl la pa konfigire
  // oswa kliyan an pa gen adrès imèl — youn pa dwe bloke lòt la. De kanal
  // push kouri an paralèl: Web Push (navigatè/PWA) AK FCM (app Android
  // Uptodown) — yon kliyan ka gen youn, lòt la, oswa toulede.
  const adminConfig = getSupabaseAdminConfig();
  let pushSent = 0;
  if (adminConfig && body?.client?.code) {
    const copy = pushCopy(body);
    const [webResult, fcmResult] = await Promise.allSettled([
      sendPushToCustomer(adminConfig, body.client.code, copy),
      sendFcmToCustomer(adminConfig, body.client.code, copy)
    ]);
    if (webResult.status === "fulfilled") pushSent += webResult.value;
    if (fcmResult.status === "fulfilled") pushSent += fcmResult.value;
  }

  // "facture" se push sèlman — dokiman an deja voye pa WhatsApp (PDF).
  // buildHtml pa gen modèl imèl pou tip sa a.
  if (body.type === "facture") return NextResponse.json({ ok: true, pushSent });

  if (!key) return NextResponse.json({ skipped: true, code: "no_key", reason: "RESEND_API_KEY pa konfigire", pushSent });
  if (!body?.client?.email) return NextResponse.json({ skipped: true, code: "no_email", reason: "kliyan san imèl", pushSent });

  try {
    const { subject, html } = buildHtml(body);
    const r = await sendViaResend(key, body.client.email, subject, html);
    if (r.ok) return NextResponse.json({ ok: true, id: r.id, pushSent });
    return NextResponse.json({ ok: false, code: r.code, status: r.status, error: r.message, pushSent }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ ok: false, code: "exception", error: String(e), pushSent }, { status: 200 });
  }
}
