import "server-only";
import { SITE_URL } from "@/lib/branding";
import { affiliateWebsiteLink } from "@/lib/affiliate-terms";

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

const LOGIN_URL = `${SITE_URL}/espace-affilie/login`;

const label = (text: string) =>
  `<p style="margin:0;font-size:12px;font-weight:700;color:#374151">${esc(text)}</p>`;

/**
 * Bwat "fasil pou kopye". Okenn kliyan imèl (Gmail, Outlook, Apple Mail)
 * pa egzekite JavaScript — yon vrè bouton "Copier" enposib nan yon imèl.
 * Bwat sa a mete valè a POUKONT LI (san espas, gwo karaktè), konsa yon
 * doub-tap / apiye-long seleksyone l nèt. user-select:all respekte pa
 * kèk kliyan (Apple Mail); lòt yo inyore l san danje. Avèk `href`, valè a
 * se yon vrè lyen: apiye-long nan Gmail bay « Copier l'adresse du lien ».
 */
const copyBox = (value: string, href?: string) => {
  const inner = href
    ? `<a href="${esc(href)}" style="color:#1E3A8A;text-decoration:none">${esc(value)}</a>`
    : esc(value);
  return `<div style="margin-top:6px;padding:12px 14px;background:#F4F7FC;border:1px dashed #9DB3D9;border-radius:8px;`
    + `font-family:Menlo,Consolas,'Courier New',monospace;font-size:16px;font-weight:700;color:#111827;`
    + `word-break:break-all;-webkit-user-select:all;user-select:all">${inner}</div>`;
};

function fromValue(): string {
  return process.env.EMAIL_FROM || "STANDA COMMERCIAL <notifications@standacommercialsa.com>";
}

export function buildAffiliateApprovalEmail(a: {
  fullname: string; code: string; username: string; password: string;
  referralLink: string; contractStart: string; contractEnd: string; commissionAmount: number;
  isRenewal?: boolean;
}): { subject: string; html: string } {
  const websiteLink = affiliateWebsiteLink(a.code);
  const subject = a.isRenewal
    ? `Votre nouveau contrat Affiliation STANDA COMMERCIAL — ${a.code}`
    : `Bienvenue dans le programme Affiliation STANDA COMMERCIAL — ${a.code}`;
  const intro = a.isRenewal
    ? `Votre contrat <strong>programme Affiliation STANDA COMMERCIAL</strong> est renouvelé pour 3 mois, avec un <strong>nouveau lien</strong>. L'ancien lien ne génère plus de commission. Voici vos nouvelles informations :`
    : `Votre candidature au <strong>programme Affiliation STANDA COMMERCIAL</strong> est acceptée. Voici vos informations :`;
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#F4F6F9;font-family:${FONT}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F9">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:#FFFFFF;border:1px solid #EAECEF;border-radius:8px">
<tr><td style="padding:24px 32px 0"><img src="https://www.standacommercialsa.com/logo.png" alt="STANDA COMMERCIAL" height="32" style="height:32px"></td></tr>
<tr><td style="padding:16px 32px 0"><h1 style="margin:0;font-size:20px;color:#111827">${a.isRenewal ? `Bonne nouvelle, ${esc(a.fullname)} !` : `Félicitations, ${esc(a.fullname)} !`}</h1>
<p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:#4B5563">${intro}</p></td></tr>
<tr><td style="padding:18px 32px 0"><p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.06em">Vos deux liens personnels</p>
${label("1. Lien d'inscription")}
<p style="margin:2px 0 0;font-size:12px;line-height:1.5;color:#4B5563">Il ouvre directement la page où votre contact crée son compte client. À envoyer quand la personne est prête à s'inscrire.</p>
${copyBox(a.referralLink, a.referralLink)}
<div style="height:14px;line-height:14px">&nbsp;</div>
${label("2. Lien du site")}
<p style="margin:2px 0 0;font-size:12px;line-height:1.5;color:#4B5563">Pour une personne qui veut d'abord mieux connaître le service : le site explique tout. Si elle crée son compte ensuite depuis le site, sur le même téléphone et dans les 30 jours, elle vous est quand même rattachée.</p>
${copyBox(websiteLink, websiteLink)}
<p style="margin:8px 0 0;font-size:11px;line-height:1.5;color:#6B7280">Pour copier un lien : appuyez longuement dessus puis « Copier l'adresse du lien » sur téléphone, ou clic droit puis « Copier l'adresse du lien » sur ordinateur.</p>
<p style="margin:8px 0 0;padding:8px 10px;background:#FFF7ED;border-radius:6px;font-size:12px;line-height:1.5;color:#9A3412"><strong>Important :</strong> partagez toujours l'un de ces deux liens. Une personne qui tape elle-même l'adresse du site, sans votre lien, ne peut pas vous être rattachée.</p></td></tr>
<tr><td style="padding:14px 32px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
<tr><td style="padding:6px 0;color:#6B7280;font-size:13px">Code</td><td align="right" style="padding:6px 0;font-size:13px;font-weight:700;font-family:monospace">${esc(a.code)}</td></tr>
<tr><td style="padding:6px 0;color:#6B7280;font-size:13px">Commission par utilisation du service</td><td align="right" style="padding:6px 0;font-size:13px;font-weight:700">${a.commissionAmount.toFixed(2)} USD</td></tr>
<tr><td style="padding:6px 0;color:#6B7280;font-size:13px">Contrat valide</td><td align="right" style="padding:6px 0;font-size:13px;font-weight:700">${esc(a.contractStart)} → ${esc(a.contractEnd)}</td></tr>
</table></td></tr>
<tr><td style="padding:18px 32px 0"><div style="height:1px;background:#EAECEF"></div></td></tr>
<tr><td style="padding:14px 32px 0"><p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.06em">Accès à votre espace affilié</p>
${label("Identifiant")}${copyBox(a.username)}
<div style="height:10px;line-height:10px">&nbsp;</div>
${label("Mot de passe")}${copyBox(a.password)}
<p style="margin:6px 0 0;font-size:11px;line-height:1.5;color:#6B7280">Pour copier : appuyez deux fois ou longuement sur le texte puis « Copier » sur téléphone, ou double-cliquez dessus sur ordinateur. Ne partagez jamais votre mot de passe.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px"><tr><td bgcolor="#E8650A" style="border-radius:8px">
<a href="${esc(LOGIN_URL)}" style="display:inline-block;padding:13px 22px;font-size:14px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:8px">Me connecter à mon Espace Affilié</a>
</td></tr></table>
<p style="margin:8px 0 0;font-size:12px;color:#9CA3AF">Dans votre Espace Affilié : bouton « Copier » pour votre lien, suivi de vos clients et de vos commissions.</p></td></tr>
<tr><td style="padding:18px 32px 0"><p style="margin:0;font-size:13px;line-height:1.6;color:#4B5563">Le contrat détaillant les conditions du programme est joint à cet e-mail en PDF.</p></td></tr>
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
