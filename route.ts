import { NextResponse } from "next/server";
import { rateLimit, tooMany, clientIp } from "@/lib/ratelimit";
import { SITE_URL, SUPPORT_PHONE } from "@/lib/branding";

/**
 * Email otomatik (Reçu à Miami / Disponible) via Resend (https://resend.com).
 * Konfigirasyon nan Vercel > Settings > Environment Variables:
 *   RESEND_API_KEY = re_xxxxx          (obligatwa pou email yo pati)
 *   EMAIL_FROM     = "STANDA COMMERCIAL <notifications@standacommercialsa.com>" (opsyonèl)
 * San RESEND_API_KEY, wout la reponn { skipped: true } san kraze anyen.
 *
 * TABLO KOLI (V9)
 * ───────────────
 * Chak koli parèt sou yon liy pa li ak 4 kolòn klè:
 *   TRACKING ID (Guía) | TRACKING NUMBER | CONTENU | POIDS
 *
 * • Desktop / tablette : yon VRE tableau HTML ak header.
 * • Téléphone (< 600px): chak koli tounen yon CARD ak etikèt sou chak liy —
 *   zewo overflow, zewo scroll orizontal, done 2 koli pa janm melanje.
 * • Done manke  : "—" (nou pa janm envante anyen).
 *
 * Fallback: si yon email client retire <style> a (donk pa gen media query),
 * blòk mobil la rete kache pa estil inline lan epi tableau a parèt. Zewo doub.
 */

interface NotifyPkg {
  tracking_number: string;
  tracking_manual?: string;
  content?: string;
  weight?: number;
  fournisseur?: string;
}
interface NotifyBody {
  type: "recu_miami" | "disponible";
  client: { name: string; code: string; ville?: string; email?: string };
  packages: NotifyPkg[];
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

/** Valè tèks: si li vid/absan -> "—". Nou pa janm envante done. */
const dash = (v: unknown): string => {
  const s = String(v ?? "").trim();
  return s ? esc(s) : "—";
};

/** Pwa: si li absan, pa yon nonm, oswa 0 -> "—". Sinon 2 desimal. */
const lb = (v: unknown): string => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n.toFixed(2) : "—";
};

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace";

function buildHtml(b: NotifyBody): { subject: string; html: string } {
  const isMiami = b.type === "recu_miami";
  const pkgs = Array.isArray(b.packages) ? b.packages : [];

  const subject = isMiami
    ? `Nou resevwa koli ou Miami — ${b.client.code}`
    : `Koli ou disponib — ${b.client.code}`;

  // Mesaj kout (spèk la: 3-4 fraz maksimòm)
  const headline = isMiami ? "Nou resevwa koli ou." : "Bon nouvèl. Koli ou disponib.";
  const sub = isMiami
    ? "Koli ou rive nan depo nou Miami. N ap okipe transpò a — w ap resevwa yon lòt mesaj lè li disponib."
    : "Ou ka vin pran li nan lye rekiperasyon w lan.";

  const totalWeight = pkgs.reduce((s, p) => {
    const n = Number(p?.weight);
    return s + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);

  // ── Liy enfòmasyon kliyan ────────────────────────────────────────────────
  const infoRow = (k: string, v: string) => `
    <tr>
      <td style="padding:6px 0;color:#6B7280;font-size:13px;line-height:1.4;font-family:${FONT}" class="dm-muted">${k}</td>
      <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;text-align:right;line-height:1.4;font-family:${FONT}" class="dm-text">${v}</td>
    </tr>`;

  const infoBlock = [
    infoRow("Code client", esc(b.client.code)),
    infoRow("Nom", dash(b.client.name)),
    infoRow("Ville", dash(b.client.ville)),
    infoRow("Nombre de colis", String(pkgs.length)),
    infoRow("Poids total (LB)", totalWeight > 0 ? totalWeight.toFixed(2) : "—")
  ].join("");

  // ── DESKTOP / TABLETTE : vre tableau, yon liy pa koli ────────────────────
  const th = (label: string, align: "left" | "right", width: string) => `
    <th align="${align}" width="${width}" style="width:${width};padding:10px 10px;font-size:10px;letter-spacing:.5px;color:#6B7280;font-weight:700;text-transform:uppercase;font-family:${FONT};border-bottom:1px solid #EAECEF" class="dm-muted dm-border">${label}</th>`;

  const desktopRows = pkgs.map((p) => `
    <tr>
      <td style="padding:11px 10px;border-top:1px solid #EAECEF;font-family:${MONO};font-size:11px;color:#111827;line-height:1.4;word-break:break-all" class="dm-text dm-border">${dash(p?.tracking_number)}</td>
      <td style="padding:11px 10px;border-top:1px solid #EAECEF;font-family:${MONO};font-size:11px;color:#4B5563;line-height:1.4;word-break:break-all" class="dm-muted dm-border">${dash(p?.tracking_manual)}</td>
      <td style="padding:11px 10px;border-top:1px solid #EAECEF;font-family:${FONT};font-size:12px;color:#374151;line-height:1.4;word-break:break-word" class="dm-text dm-border">${dash(p?.content)}</td>
      <td align="right" style="padding:11px 10px;border-top:1px solid #EAECEF;font-family:${FONT};font-size:12px;font-weight:600;color:#111827;text-align:right;line-height:1.4;white-space:nowrap" class="dm-text dm-border">${lb(p?.weight)}</td>
    </tr>`).join("");

  const desktopTable = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;border-collapse:collapse;border:1px solid #EAECEF;border-radius:4px" class="dm-border">
      <tr class="dm-head" style="background:#F8FAFC">
        ${th("Tracking ID", "left", "26%")}
        ${th("Tracking Number", "left", "26%")}
        ${th("Contenu", "left", "34%")}
        ${th("Poids (LB)", "right", "14%")}
      </tr>
      ${desktopRows}
    </table>`;

  // ── TÉLÉPHONE : chak koli = yon card, etikèt sou chak liy ────────────────
  const cardLine = (k: string, v: string, mono = false) => `
    <tr>
      <td style="padding:5px 0;color:#6B7280;font-size:11px;line-height:1.4;font-family:${FONT};white-space:nowrap;vertical-align:top" class="dm-muted">${k}</td>
      <td align="right" style="padding:5px 0 5px 10px;color:#111827;font-size:12px;font-weight:600;text-align:right;line-height:1.4;font-family:${mono ? MONO : FONT};word-break:break-word;vertical-align:top" class="dm-text">${v}</td>
    </tr>`;

  const mobileCards = pkgs.map((p) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;border-collapse:collapse;border:1px solid #EAECEF;border-radius:4px;margin-bottom:10px" class="dm-border">
      <tr><td style="padding:12px 14px">
        <div style="font-size:9px;letter-spacing:.5px;color:#6B7280;font-weight:700;text-transform:uppercase;font-family:${FONT};margin-bottom:3px" class="dm-muted">Tracking ID</div>
        <div style="font-family:${MONO};font-size:13px;font-weight:700;color:#111827;word-break:break-all;line-height:1.35" class="dm-text">${dash(p?.tracking_number)}</div>
        <div style="height:1px;background:#EAECEF;font-size:0;line-height:1px;margin:10px 0" class="dm-bgline">&nbsp;</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse">
          ${cardLine("Tracking Number", dash(p?.tracking_manual), true)}
          ${cardLine("Contenu", dash(p?.content))}
          ${cardLine("Poids (LB)", lb(p?.weight))}
        </table>
      </td></tr>
    </table>`).join("");

  const emptyState = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
      style="width:100%;border:1px solid #EAECEF;border-radius:4px" class="dm-border">
      <tr><td style="padding:16px;text-align:center;color:#9CA3AF;font-size:12px;font-family:${FONT}" class="dm-muted">—</td></tr>
    </table>`;

  const packagesBlock = pkgs.length
    ? `<div class="only-desktop">${desktopTable}</div>
       <div class="only-mobile" style="display:none;max-height:0;overflow:hidden;mso-hide:all">${mobileCards}</div>`
    : emptyState;

  const html = `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(subject)}</title>
<!--[if mso]><style>table{border-collapse:collapse}td,th{font-family:Arial,sans-serif}</style><![endif]-->
<style>
  .only-mobile{display:none;max-height:0;overflow:hidden;mso-hide:all}
  @media (max-width:600px){
    .container{width:100%!important}
    .px{padding-left:18px!important;padding-right:18px!important}
    .only-desktop{display:none!important;max-height:0!important;overflow:hidden!important}
    .only-mobile{display:block!important;max-height:none!important;overflow:visible!important;width:100%!important}
  }
  @media (prefers-color-scheme:dark){
    body,.bg{background:#0F172A!important}
    .card{background:#111827!important}
    .dm-text{color:#F3F4F6!important}
    .dm-muted{color:#9CA3AF!important}
    .dm-border{border-color:#374151!important}
    .dm-bgline{background:#374151!important}
    .dm-line{background:#1E3A8A!important}
    .dm-head{background:#0B1220!important}
    .dm-foot{color:#9CA3AF!important}
    .dm-logobg{background:#FFFFFF!important}
  }
</style>
</head>
<body class="bg" style="margin:0;padding:0;background:#F4F6F9;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${headline} ${sub}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9" class="bg">
    <tr><td align="center" style="padding:28px 12px">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="container card" style="width:600px;max-width:600px;background:#FFFFFF;border:1px solid #EAECEF;border-radius:4px">

        <!-- HEADER: logo + liy ble mens -->
        <tr><td class="px" style="padding:28px 40px 0">
          <!--[if !mso]><!-->
          <span style="display:inline-block;background:#FFFFFF;border-radius:4px;padding:4px 8px" class="dm-logobg">
            <img src="${SITE_URL}/logo.png" alt="STANDA COMMERCIAL" height="38" style="display:block;height:38px;border:0;outline:none">
          </span>
          <!--<![endif]-->
          <!--[if mso]><img src="${SITE_URL}/logo.png" alt="STANDA COMMERCIAL" height="38" style="height:38px"><![endif]-->
        </td></tr>
        <tr><td style="padding:18px 0 0"><div class="dm-line" style="height:3px;background:#1E3A8A;line-height:3px;font-size:0">&nbsp;</div></td></tr>

        <!-- MESSAGE kout -->
        <tr><td class="px dm-text" style="padding:30px 40px 6px;color:#111827;font-family:${FONT}">
          <div style="font-size:15px;color:#374151;margin-bottom:14px" class="dm-muted">Bonjour ${dash(b.client.name)},</div>
          <div style="font-size:20px;font-weight:700;color:#111827;letter-spacing:-.2px" class="dm-text">${headline}</div>
          <div style="font-size:14px;line-height:1.6;color:#4B5563;margin-top:8px" class="dm-muted">${sub}</div>
        </td></tr>

        <!-- INFORMATIONS CLIENT -->
        <tr><td class="px" style="padding:22px 40px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%">${infoBlock}</table>
        </td></tr>

        <!-- DÉTAIL DES COLIS -->
        <tr><td class="px" style="padding:24px 40px 0">
          <div style="font-size:10px;letter-spacing:.5px;color:#6B7280;font-weight:700;text-transform:uppercase;font-family:${FONT};padding-bottom:10px" class="dm-muted">Détail des colis</div>
          ${packagesBlock}
        </td></tr>

        <!-- LIEN discret -->
        <tr><td class="px" style="padding:22px 40px 0">
          <a href="${SITE_URL}/login" style="color:#1E3A8A;font-size:13px;font-weight:600;text-decoration:none;font-family:${FONT}">Konekte sou kont ou →</a>
        </td></tr>

        <!-- FOOTER -->
        <tr><td style="padding:28px 0 0"><div class="dm-line" style="height:2px;background:#1E3A8A;line-height:2px;font-size:0">&nbsp;</div></td></tr>
        <tr><td class="px dm-foot" style="padding:16px 40px 30px;color:#9CA3AF;font-size:11px;line-height:1.7;font-family:${FONT}">
          <strong style="color:#6B7280" class="dm-muted">STANDA COMMERCIAL</strong><br>
          Téléphone : ${SUPPORT_PHONE}<br>
          ${SITE_URL.replace("https://", "")}
        </td></tr>

      </table>

    </td></tr>
  </table>
</body></html>`;

  return { subject, html };
}

export async function POST(req: Request) {
  // Rate limiting — imèl: 60 / èdtan pa IP (anti-spam kliyan)
  const rl = rateLimit("notify:" + clientIp(req), 60, 3600000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  try {
    const body = (await req.json()) as NotifyBody;
    const key = process.env.RESEND_API_KEY;
    if (!key) return NextResponse.json({ skipped: true, reason: "RESEND_API_KEY pa konfigire" });
    if (!body?.client?.email) return NextResponse.json({ skipped: true, reason: "kliyan san imèl" });

    const { subject, html } = buildHtml(body);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "STANDA COMMERCIAL <notifications@standacommercialsa.com>",
        to: [body.client.email],
        subject,
        html
      })
    });
    if (!res.ok) {
      const t = await res.text();
      return NextResponse.json({ ok: false, error: t }, { status: 200 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 });
  }
}
