import { randomBytes } from "node:crypto";
import { sendPushToStaff } from "@/lib/push-server";
import { sendFcmToStaff } from "@/lib/push-fcm-server";
type SupabaseAdminConfig = NonNullable<ReturnType<typeof import("@/lib/supabase-server").getSupabaseAdminConfig>>;

/**
 * RAPPORT PDF D'UN POINT DE RETRAIT → ADMINISTRATION (serveur seulement).
 *  1) PDF archivé dans le bucket PRIVÉ « bons-remise », dossier rapports/ ;
 *  2) ligne dans le Journal (action « Rapport agence (PDF) ») : c'est la
 *     référence que l'admin ouvre via /api/documents/agent-report/<id> ;
 *  3) alerte téléphone à chaque administrateur ;
 *  4) e-mail aux administrateurs avec le PDF en pièce jointe (si Resend est configuré).
 */
export const AGENT_REPORT_ACTION = "Rapport agence (PDF)";
export const AGENT_REPORT_BUCKET = "bons-remise";
const MAX_BYTES = 3 * 1024 * 1024;

export async function sendAgentReport(
  config: SupabaseAdminConfig,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  input: { agentName: string; zone: string; pdfBase64: string; summary: string }
): Promise<{ ok: true; reportId: string; notified: number; emailed: number } | { ok: false; reason: string }> {
  const base64 = String(input.pdfBase64 ?? "").replace(/^data:application\/pdf;base64,/, "");
  let pdf: Buffer;
  try { pdf = Buffer.from(base64, "base64"); } catch { return { ok: false, reason: "PDF invalide." }; }
  if (pdf.length < 500 || pdf.length > MAX_BYTES || pdf.subarray(0, 4).toString() !== "%PDF") return { ok: false, reason: "PDF invalide." };

  const day = new Date().toISOString().slice(0, 10);
  const zoneSlug = input.zone.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "zone";
  const path = `rapports/${zoneSlug}-${day}-${randomBytes(6).toString("hex")}.pdf`;
  const upload = await db.storage.from(AGENT_REPORT_BUCKET).upload(path, pdf, { contentType: "application/pdf", upsert: false });
  if (upload.error) return { ok: false, reason: "Archivage du rapport impossible." };

  const summary = String(input.summary ?? "").slice(0, 1500);
  const inserted = await db.from("journal").insert({
    user_name: `${input.agentName} · agent_retrait`, action: AGENT_REPORT_ACTION,
    details: `${input.zone} · ${summary}`, package_ref: path, customer_code: ""
  }).select("id").single();
  if (inserted.error || !inserted.data) return { ok: false, reason: "Rapport non enregistré." };
  const reportId = String(inserted.data.id);

  const { data: admins } = await db.from("staff").select("id, email").eq("role", "admin");
  const title = `Rapport de ${input.zone}`;
  const text = `${input.agentName} a envoyé son rapport. ${summary}`.slice(0, 180);
  let notified = 0;
  await Promise.all(((admins ?? []) as Array<{ id: string }>).map(async (admin) => {
    const [web, native] = await Promise.allSettled([
      sendPushToStaff(config, admin.id, { title, text, url: "/points-retrait#rapports" }),
      sendFcmToStaff(config, admin.id, { title, text, url: "/points-retrait#rapports" })
    ]);
    if (web.status === "fulfilled") notified += web.value;
    if (native.status === "fulfilled") notified += native.value;
  }));

  let emailed = 0;
  const key = process.env.RESEND_API_KEY;
  const recipients = Array.from(new Set(((admins ?? []) as Array<{ email: string | null }>)
    .map((admin) => String(admin.email ?? "").trim()).filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))));
  if (key && recipients.length) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "STANDA COMMERCIAL <notifications@standacommercialsa.com>",
          to: recipients,
          subject: `Rapport point de retrait · ${input.zone} · ${day}`,
          html: `<p>Bonjour,</p><p><b>${escapeHtml(input.agentName)}</b> (point de retrait <b>${escapeHtml(input.zone)}</b>) a envoyé son rapport.</p><p>${escapeHtml(summary)}</p><p>Le rapport complet est en pièce jointe (PDF). Il est aussi disponible dans STANDA → Points de retrait → Rapports des agences.</p>`,
          attachments: [{ filename: `Rapport-${zoneSlug}-${day}.pdf`, content: base64 }]
        })
      });
      if (res.ok) emailed = recipients.length;
    } catch { /* l'e-mail est un plus : le rapport reste archivé et notifié */ }
  }
  return { ok: true, reportId, notified, emailed };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}
