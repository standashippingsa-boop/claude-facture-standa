import "server-only";

/**
 * PWOGRAM AFFILIATION — imèl apwobasyon (kontra + lyen + login).
 * ═══════════════════════════════════════════════════════════════
 * Menm sèvis ak lib/... itilize deja nan app/api/notify/route.ts (Resend),
 * men avèk yon PIÈCE JOINTE: kontra a se yon FICHYE STANDA telechaje nan
 * Paramètres (app_settings: affiliate_contract_pdf_url/_name) — nou pa
 * envante okenn tèks legal, nou tache menm fichye a chak fwa.
 */

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

function fromValue(): string {
  return process.env.EMAIL_FROM || "STANDA COMMERCIAL <notifications@standacommercialsa.com>";
}

export function buildAffiliateApprovalEmail(a: {
  fullname: string; code: string; username: string; password: string;
  referralLink: string; contractStart: string; contractEnd: string; commissionAmount: number;
}): { subject: string; html: string } {
  const subject = `Bienvenue dans le programme Affiliation STANDA COMMERCIAL — ${a.code}`;
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:${FONT}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:#FFFFFF;border:1px solid #EAECEF;border-radius:8px">
<tr><td style="padding:24px 32px 0"><img src="https://www.standacommercialsa.com/logo.png" alt="STANDA COMMERCIAL" height="32" style="height:32px"></td></tr>
<tr><td style="padding:16px 32px 0"><h1 style="margin:0;font-size:20px;color:#111827">Félicitations, ${esc(a.fullname)} !</h1>
<p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:#4B5563">Votre candidature au <strong>programme Affiliation STANDA COMMERCIAL</strong> est acceptée. Voici vos informations :</p></td></tr>
<tr><td style="padding:18px 32px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
<tr><td style="padding:6px 0;color:#6B7280;font-size:13px">Votre lien unique</td><td align="right" style="padding:6px 0;font-size:13px;font-weight:700;color:#1E3A8A;word-break:break-all">${esc(a.referralLink)}</td></tr>
<tr><td style="padding:6px 0;color:#6B7280;font-size:13px">Code</td><td align="right" style="padding:6px 0;font-size:13px;font-weight:700;font-family:monospace">${esc(a.code)}</td></tr>
<tr><td style="padding:6px 0;color:#6B7280;font-size:13px">Commission par facture qualifiée</td><td align="right" style="padding:6px 0;font-size:13px;font-weight:700">${a.commissionAmount.toFixed(2)} USD</td></tr>
<tr><td style="padding:6px 0;color:#6B7280;font-size:13px">Contrat valide</td><td align="right" style="padding:6px 0;font-size:13px;font-weight:700">${esc(a.contractStart)} → ${esc(a.contractEnd)}</td></tr>
</table></td></tr>
<tr><td style="padding:18px 32px 0"><div style="height:1px;background:#EAECEF"></div></td></tr>
<tr><td style="padding:14px 32px 0"><p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.06em">Accès à votre espace affilié</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
<tr><td style="padding:4px 0;color:#6B7280;font-size:13px">Identifiant</td><td align="right" style="padding:4px 0;font-size:13px;font-weight:700;font-family:monospace">${esc(a.username)}</td></tr>
<tr><td style="padding:4px 0;color:#6B7280;font-size:13px">Mot de passe</td><td align="right" style="padding:4px 0;font-size:13px;font-weight:700;font-family:monospace">${esc(a.password)}</td></tr>
</table>
<p style="margin:10px 0 0;font-size:12px;color:#9CA3AF">Connectez-vous sur standacommercialsa.com/espace-affilie/login pour suivre vos filleuls et vos commissions.</p></td></tr>
<tr><td style="padding:18px 32px 0"><p style="margin:0;font-size:13px;line-height:1.6;color:#4B5563">Le contrat détaillant les conditions du programme est joint à cet e-mail (PDF).</p></td></tr>
<tr><td style="padding:22px 32px 24px"><div style="height:2px;background:#1E3A8A;margin-bottom:12px"></div>
<p style="margin:0;font-size:11px;color:#9CA3AF">STANDA COMMERCIAL — standacommercialsa.com</p></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, html };
}

/**
 * Voye imèl la ak yon pyès jwenn PDF (URL Storage STANDA) via Resend.
 * Resend mande baz64 nan chan `attachments[].content`.
 */
export async function sendAffiliateApprovalEmail(
  key: string, to: string, subject: string, html: string, contractPdfUrl?: string | null
): Promise<{ ok: true; id: string } | { ok: false; status: number; message: string }> {
  let attachments: { filename: string; content: string }[] | undefined;
  if (contractPdfUrl) {
    try {
      const pdfRes = await fetch(contractPdfUrl);
      if (pdfRes.ok) {
        const buf = Buffer.from(await pdfRes.arrayBuffer());
        attachments = [{ filename: "Contrat-Affiliation-STANDA.pdf", content: buf.toString("base64") }];
      }
    } catch {
      // Si nou pa ka al chèche PDF la, nou voye imèl la kanmenm SAN pyès jwenn
      // (lyen + kredansyèl yo pi enpòtan pase blòke tout imèl la).
    }
  }

  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ from: fromValue(), to: [to], subject, html, ...(attachments ? { attachments } : {}) }),
    });
  } catch (e) {
    return { ok: false, status: 0, message: "Rezo : " + String(e) };
  }
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, message: text };
  let id = "";
  try { id = JSON.parse(text)?.id ?? ""; } catch { /* id opsyonèl */ }
  return { ok: true, id };
}
