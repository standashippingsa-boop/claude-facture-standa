import "server-only";
import { randomUUID } from "node:crypto";
import { getSupabaseAdminConfig } from "@/lib/supabase-server";
import { sendPushToStaff } from "@/lib/push-server";

/**
 * AVÈTI ADMIN YO lè yon afilye chanje yon bagay sansib (nimewo peman,
 * kontra siyen). Twa trase pou chak evènman:
 *   1. staff_notifications (kind 'affiliate_update') pou CHAK admin — kloch
 *      "Notifications" + lyen dirèk sou /affiliates/<id>;
 *   2. push sou telefòn admin yo ki aktive notifikasyon;
 *   3. journal (odit).
 * JAMÈ bloke aksyon afilye a: si notifikasyon an echwe, chanjman afilye a
 * deja anrejistre — nou log erè a epi nou kontinye.
 * `svc` = kliyan service role (sèvè sèlman).
 */
export async function notifyAdminsOfAffiliateChange(
  svc: any,
  aff: { id: string; fullname: string; code: string },
  event: { title: string; message: string }
): Promise<void> {
  const eventId = randomUUID();
  const href = `/affiliates/${aff.id}`;
  const message = `${aff.fullname} (${aff.code}) · ${event.message}`;
  try {
    const { data: admins } = await svc.from("staff").select("id").eq("role", "admin");
    const ids = ((admins ?? []) as Array<{ id: string }>).map((a) => a.id);
    if (ids.length) {
      const { error } = await svc.from("staff_notifications").insert(ids.map((staffId) => ({
        recipient_staff_id: staffId, source_affiliate_id: aff.id, kind: "affiliate_update",
        title: event.title, message, href,
        // Menm eventId pou tout admin yo: istorik afilye a regwoupe yo an yon sèl liy.
        event_key: `affiliate:${eventId}:staff:${staffId}`
      })));
      if (error) console.error("[affiliate-notify] staff_notifications", error);

      const config = getSupabaseAdminConfig();
      if (config) {
        await Promise.allSettled(ids.map((staffId) => sendPushToStaff(config, staffId, { title: event.title, text: message, url: href })));
      }
    }
    await svc.from("journal").insert({
      user_name: `${aff.fullname} · affilié ${aff.code}`, action: event.title,
      details: message.slice(0, 2000), package_ref: "", customer_code: ""
    });
  } catch (error) {
    console.error("[affiliate-notify]", error);
  }
}
