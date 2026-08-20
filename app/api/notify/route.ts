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

/** Valè tèks: si li vid/absan -> "—". */
const dash = (v: unknown): string => {
  const s = String(v ?? "").trim();
  return s ? esc(s) : "—";
};

/** Pwa: absan / pa yon nonm / 0 -> "—". Sinon "0.5 lb" (san zewo initil). */
const lbs = (v: unknown): string => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${String(Number(n.toFixed(2)))} lb`;
};

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace";

function buildHtml(b: NotifyBody): { subject: string; html: string } {
  const isMiami = b.type === "recu_miami";
  const pkgs = Array.isArray(b.packages) ? b.packages : [];
  const many = pkgs.length > 1;

  const subject = isMiami
    ? `Nou resevwa koli ou Miami — ${b.client.code}`
    : `Koli ou disponib — ${b.client.code}`;

  const headline = isMiami ? "Nou resevwa koli ou." : "Bon nouvèl. Koli ou disponib.";
  const sub = isMiami
    ? "Koli ou rive nan depo nou Miami. W ap resevwa yon lòt mesaj lè li disponib."
    : "Ou ka vin pran li nan lye rekiperasyon w lan.";
  const statut = isMiami ? "Reçu à Miami" : "Disponible";

  const totalWeight = pkgs.reduce((s, p) => {
    const n = Number(p?.weight);
    return s + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);

  /**
   * LIY ETIKÈT / VALÈ — blòk debaz tout mesaj la.
   * Etikèt la pa janm kase (white-space:nowrap), valè a kase si l twò long.
   */
  const row = (k: string, v: string, opt?: { mono?: boolean; strong?: boolean }) => `
    <tr>
      <td style="padding:6px 0;color:#6B7280;font-size:13px;line-height:1.45;font-family:${FONT};white-space:nowrap;vertical-align:top" class="dm-muted">${k}</td>
      <td align="right" style="padding:6px 0 6px 12px;color:#111827;font-size:${opt?.mono ? "12" : "13"}px;font-weight:${opt?.strong ? "700" : "600"};text-align:right;line-height:1.45;font-family:${opt?.mono ? MONO : FONT};word-break:break-all;vertical-align:top" class="dm-text">${v}</td>
    </tr>`;

  /** Liy separasyon fen ant blòk yo */
  const divider = `
    <tr><td colspan="2" style="padding:9px 0">
      <div style="height:1px;background:#EAECEF;font-size:0;line-height:1px" class="dm-bgline">&nbsp;</div>
    </td></tr>`;

  /** Ti tit anndan lis la (ex: "COLIS 2 / 4") */
  const caption = (t: string) => `
    <tr><td colspan="2" style="padding:4px 0 2px;font-size:10px;letter-spacing:.6px;color:#9CA3AF;font-weight:700;text-transform:uppercase;font-family:${FONT}" class="dm-muted">${t}</td></tr>`;

  // ── Blòk kliyan ──────────────────────────────────────────────────────────
  const clientRows =
    row("Code Client", esc(b.client.code), { strong: true }) +
    row("Nom Client", dash(b.client.name)) +
    row("Ville", dash(b.client.ville)) +
    row("Statut", esc(statut));

  // ── Blòk koli yo — 4 enfòmasyon egzat, youn pa liy ──────────────────────
  const pkgRows = pkgs.map((p, i) =>
    divider +
    (many ? caption(`Colis ${i + 1} / ${pkgs.length}`) : "") +
    row("Tracking ID", dash(p?.tracking_number), { mono: true }) +
    row("Tracking Number", dash(p?.tracking_manual), { mono: true }) +
    row("Poids", lbs(p?.weight)) +
    row("Contenu", dash(p?.content))
  ).join("");

  const totalRows = many
    ? divider +
      row("Nombre de colis", String(pkgs.length)) +
      row("Poids total", totalWeight > 0 ? `${String(Number(totalWeight.toFixed(2)))} lb` : "—")
    : "";

  const emptyRow = !pkgs.length
    ? divider + row("Colis", "—")
    : "";

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
  @media (max-width:600px){
    .container{width:100%!important}
    .px{padding-left:20px!important;padding-right:20px!important}
    .pt{padding-top:20px!important}
  }
  @media (prefers-color-scheme:dark){
    body,.bg{background:#0F172A!important}
    .card{background:#111827!important}
    .dm-text{color:#F3F4F6!important}
    .dm-muted{color:#9CA3AF!important}
    .dm-bgline{background:#374151!important}
    .dm-line{background:#1E3A8A!important}
    .dm-foot{color:#9CA3AF!important}
    .dm-logobg{background:#FFFFFF!important}
  }
</style>
</head>
<body class="bg" style="margin:0;padding:0;background:#F4F6F9;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${headline} ${sub}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9" class="bg">
    <tr><td align="center" style="padding:20px 12px">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="container card" style="width:600px;max-width:600px;background:#FFFFFF;border:1px solid #EAECEF;border-radius:4px">

        <!-- HEADER: logo + liy ble mens -->
        <tr><td class="px" style="padding:22px 40px 0">
          <!--[if !mso]><!-->
          <span style="display:inline-block;background:#FFFFFF;border-radius:4px;padding:3px 6px" class="dm-logobg">
            <img src="${SITE_URL}/logo.png" alt="STANDA COMMERCIAL" height="32" style="display:block;height:32px;border:0;outline:none">
          </span>
          <!--<![endif]-->
          <!--[if mso]><img src="${SITE_URL}/logo.png" alt="STANDA COMMERCIAL" height="32" style="height:32px"><![endif]-->
        </td></tr>
        <tr><td style="padding:14px 0 0"><div class="dm-line" style="height:3px;background:#1E3A8A;line-height:3px;font-size:0">&nbsp;</div></td></tr>

        <!-- MESSAGE kout -->
        <tr><td class="px" style="padding:22px 40px 0;font-family:${FONT}">
          <div style="font-size:13px;color:#6B7280;margin-bottom:8px" class="dm-muted">Bonjour ${dash(b.client.name)},</div>
          <div style="font-size:18px;font-weight:700;color:#111827;letter-spacing:-.2px;line-height:1.3" class="dm-text">${headline}</div>
          <div style="font-size:13px;line-height:1.55;color:#4B5563;margin-top:6px" class="dm-muted">${sub}</div>
        </td></tr>

        <!-- DÉTAILS DU COLIS — yon sèl lis, menm bagay sou tout ekran -->
        <tr><td class="px" style="padding:20px 40px 0">
          <div style="font-size:10px;letter-spacing:.6px;color:#6B7280;font-weight:700;text-transform:uppercase;font-family:${FONT};padding-bottom:4px" class="dm-muted">Détails du colis</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse">
            ${clientRows}${pkgRows}${emptyRow}${totalRows}
          </table>
        </td></tr>

        <!-- LIEN discret -->
        <tr><td class="px" style="padding:18px 40px 0">
          <a href="${SITE_URL}/login" style="color:#1E3A8A;font-size:13px;font-weight:600;text-decoration:none;font-family:${FONT}">Konekte sou kont ou →</a>
        </td></tr>

        <!-- FOOTER -->
        <tr><td style="padding:20px 0 0"><div class="dm-line" style="height:2px;background:#1E3A8A;line-height:2px;font-size:0">&nbsp;</div></td></tr>
        <tr><td class="px dm-foot" style="padding:14px 40px 22px;color:#9CA3AF;font-size:11px;line-height:1.65;font-family:${FONT}">
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
