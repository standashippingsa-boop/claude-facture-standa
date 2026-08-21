import { NextResponse } from "next/server";
import { rateLimit, tooMany, clientIp } from "@/lib/ratelimit";
import { SITE_URL, SUPPORT_PHONE } from "@/lib/branding";

/**
 * FÒM KONTAK SIT PIBLIK LA — /contact
 * ══════════════════════════════════════
 * Voye mesaj vizitè yo bay STANDA COMMERCIAL pa imèl, ak Resend
 * (menm sistèm ki deja konfigire pou app/api/notify/route.ts —
 *  ⚠️ PA gen nouvo sèvis imèl, menm RESEND_API_KEY, menm EMAIL_FROM).
 *
 * San RESEND_API_KEY nan Vercel, wout la reponn { skipped: true }
 * san kraze anyen (menm konpòtman ak /api/notify).
 *
 * ⚠️ Imèl biznis la ("to") make espre isit la — pa enpòte SiteHeader.tsx
 *    (fichye "use client") anndan yon wout sèvè. Si imèl kontak la ta
 *    chanje yon jou, chanje l ISIT AK nan components/site/SiteHeader.tsx (SITE.email).
 */
const CONTACT_TO_EMAIL = "standacommercialsa@gmail.com";

interface ContactBody {
  name?: string;
  email?: string;
  phone?: string;
  subject?: string;
  message?: string;
  /** Chan "honeypot" — envizib pou moun, bot yo ranpli l. Si li plen, nou senpleman inyore. */
  website?: string;
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

const emailOk = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function buildHtml(b: ContactBody): { subject: string; html: string } {
  const subject = `Nouveau message — Contact site web${b.subject ? " : " + b.subject : ""}`;

  const row = (k: string, v: string) => `
    <tr>
      <td style="padding:7px 0;color:#6B7280;font-size:13px;font-family:${FONT};white-space:nowrap;vertical-align:top">${k}</td>
      <td style="padding:7px 0 7px 14px;color:#111827;font-size:14px;font-weight:600;font-family:${FONT};vertical-align:top">${v}</td>
    </tr>`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#F4F6F9;-webkit-text-size-adjust:100%">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#FFFFFF;border:1px solid #EAECEF;border-radius:6px">
        <tr><td style="background:#122B5C;padding:18px 32px;border-radius:6px 6px 0 0">
          <span style="color:#FFFFFF;font-size:15px;font-weight:800;font-family:${FONT}">STANDA COMMERCIAL</span>
          <div style="color:#16A34A;font-size:12px;font-weight:700;font-family:${FONT};margin-top:2px">Nouveau message — formulaire Contact</div>
        </td></tr>
        <tr><td style="padding:26px 32px 8px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
            ${row("Nom", esc(b.name))}
            ${row("Email", b.email ? `<a href="mailto:${esc(b.email)}" style="color:#122B5C;text-decoration:none">${esc(b.email)}</a>` : "—")}
            ${row("Téléphone", b.phone ? `<a href="tel:${esc(b.phone)}" style="color:#122B5C;text-decoration:none">${esc(b.phone)}</a>` : "—")}
            ${row("Sujet", b.subject ? esc(b.subject) : "—")}
          </table>
        </td></tr>
        <tr><td style="padding:6px 32px 28px">
          <div style="font-size:11px;letter-spacing:.5px;color:#6B7280;font-weight:700;text-transform:uppercase;font-family:${FONT};padding-bottom:6px">Message</div>
          <div style="font-size:14px;line-height:1.6;color:#111827;font-family:${FONT};white-space:pre-wrap;background:#F5F7FB;border-radius:8px;padding:14px 16px">${esc(b.message)}</div>
        </td></tr>
        <tr><td style="padding:16px 32px 22px;border-top:1px solid #EAECEF">
          <p style="margin:0;color:#9CA3AF;font-size:11px;line-height:1.6;font-family:${FONT}">
            Envoyé depuis le formulaire de contact — ${SITE_URL.replace("https://", "")}<br>
            Répondez directement à ce courriel pour contacter le visiteur, ou appelez ${SUPPORT_PHONE}.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html };
}

export async function POST(req: Request) {
  // Rate limiting — 20 mesaj / èdtan pa IP (anti-spam vizitè)
  const rl = rateLimit("contact:" + clientIp(req), 20, 3600000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  try {
    const body = (await req.json()) as ContactBody;

    // Chan "honeypot" plen -> se yon bot, nou fè tankou tout mache byen
    // san nou pa voye anyen (pa gaspiye kredi Resend, pa alète moun pou anyen).
    if (body?.website && String(body.website).trim() !== "") {
      return NextResponse.json({ ok: true });
    }

    const name = String(body?.name ?? "").trim();
    const email = String(body?.email ?? "").trim();
    const phone = String(body?.phone ?? "").trim();
    const message = String(body?.message ?? "").trim();

    if (!name || !message) {
      return NextResponse.json({ ok: false, reason: "Non ak mesaj obligatwa." }, { status: 400 });
    }
    if (!email && !phone) {
      return NextResponse.json({ ok: false, reason: "Bay yon imèl oswa yon telefòn." }, { status: 400 });
    }
    if (email && !emailOk(email)) {
      return NextResponse.json({ ok: false, reason: "Imèl la pa valab." }, { status: 400 });
    }

    const key = process.env.RESEND_API_KEY;
    if (!key) return NextResponse.json({ skipped: true, reason: "RESEND_API_KEY pa konfigire" });

    const { subject, html } = buildHtml({ name, email, phone, subject: body?.subject, message });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "STANDA COMMERCIAL <notifications@standacommercialsa.com>",
        to: [CONTACT_TO_EMAIL],
        reply_to: email || undefined,
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
