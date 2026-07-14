import { NextResponse } from "next/server";
import { SITE_URL, SUPPORT_PHONE } from "@/lib/branding";

/**
 * Email otomatik (Reçu à Miami / Disponible) via Resend (https://resend.com).
 * Konfigirasyon nan Vercel > Settings > Environment Variables:
 *   RESEND_API_KEY = re_xxxxx          (obligatwa pou email yo pati)
 *   EMAIL_FROM     = "STANDA COMMERCIAL <notifications@standacommercialsa.com>" (opsyonèl)
 * San RESEND_API_KEY, wout la reponn { skipped: true } san kraze anyen.
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

function buildHtml(b: NotifyBody): { subject: string; html: string } {
  const isMiami = b.type === "recu_miami";
  const subject = isMiami
    ? `📦 Nou resevwa koli ou Miami — ${b.client.code}`
    : `✅ Koli ou disponib — ${b.client.code}`;
  const intro = isMiami
    ? "Nou resevwa koli sa pou ou nan depo nou Miami. N ap okipe transpò a — w ap resevwa yon lòt mesaj lè li disponib."
    : "Bòn nouvèl! Koli ou disponib — ou ka vin pran li.";

  const totalWeight = b.packages.reduce((s, p) => s + (Number(p.weight) || 0), 0);
  const rows = b.packages.map((p) => `
    <tr>
      <td style="padding:7px 10px;border-bottom:1px solid #E1E6EF;font-family:monospace;font-size:12px">
        ${esc(p.tracking_number)}${p.tracking_manual ? `<br><span style="color:#64748B">${esc(p.tracking_manual)}</span>` : ""}
      </td>
      <td style="padding:7px 10px;border-bottom:1px solid #E1E6EF;font-size:12px">${esc(p.fournisseur || "—")}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #E1E6EF;font-size:12px">${esc(p.content || "—")}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #E1E6EF;font-size:12px;text-align:right">${Number(p.weight || 0).toFixed(2)}</td>
    </tr>`).join("");

  const info = (k: string, v: string) => `
    <tr>
      <td style="padding:6px 10px;color:#64748B;font-size:13px;white-space:nowrap">${k}</td>
      <td style="padding:6px 10px;font-weight:600;font-size:13px;text-align:right">${v}</td>
    </tr>`;

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F3F5F9;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:24px 12px">
  <div style="background:#122B5C;border-radius:14px 14px 0 0;padding:22px;text-align:center">
    <div style="background:#fff;display:inline-block;border-radius:12px;padding:8px 14px">
      <img src="${SITE_URL}/logo.png" alt="STANDA COMMERCIAL" height="52" style="display:block">
    </div>
  </div>
  <div style="background:#fff;border-radius:0 0 14px 14px;padding:26px 24px;border:1px solid #E1E6EF;border-top:0">
    <h2 style="color:#122B5C;margin:0 0 6px">Bonjour ${esc(b.client.name)} 👋</h2>
    <p style="color:#334155;font-size:14px;line-height:1.6;margin:0 0 18px">${intro}</p>

    <div style="background:#F3F5F9;border-radius:10px;padding:6px 4px;margin-bottom:18px">
      <table style="width:100%;border-collapse:collapse">
        ${info("Code client", esc(b.client.code))}
        ${info("Nom", esc(b.client.name))}
        ${info("Origine", "Miami")}
        ${info("Destination", esc(b.client.ville || "—"))}
        ${info("Nombre de colis", String(b.packages.length))}
        ${info("Poids (lbs)", totalWeight.toFixed(2))}
      </table>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <thead><tr style="background:#122B5C">
        <th style="padding:8px 10px;color:#fff;font-size:11px;text-align:left">TRACKING ID / NUMBER</th>
        <th style="padding:8px 10px;color:#fff;font-size:11px;text-align:left">FOURNISSEUR</th>
        <th style="padding:8px 10px;color:#fff;font-size:11px;text-align:left">CONTENU</th>
        <th style="padding:8px 10px;color:#fff;font-size:11px;text-align:right">POIDS (LB)</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <div style="text-align:center;margin-bottom:18px">
      <a href="${SITE_URL}/login"
        style="background:#122B5C;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px;display:inline-block">
        Konekte sou kont ou
      </a>
      <p style="color:#94A3B8;font-size:12px;margin:10px 0 0">Pou plis enfòmasyon, konekte sou kont ou.</p>
    </div>

    <hr style="border:0;border-top:1px solid #E1E6EF;margin:18px 0">
    <p style="color:#64748B;font-size:12px;text-align:center;margin:0">
      STANDA COMMERCIAL · Téléphone: ${SUPPORT_PHONE}
    </p>
  </div>
</div>
</body></html>`;
  return { subject, html };
}

export async function POST(req: Request) {
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
        from: process.env.EMAIL_FROM || "STANDA COMMERCIAL <onboarding@resend.dev>",
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
