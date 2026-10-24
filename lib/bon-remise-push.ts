import { sendFcmToStaff } from "@/lib/push-fcm-server";
import { sendPushToStaff } from "@/lib/push-server";

/** Push « Nouveau bon de remise » à chaque agent de retrait de la ville. Serveur seulement. */
export async function notifyPickupAgents(
  config: Parameters<typeof sendPushToStaff>[0],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  svc: any,
  destination: string, bonNumber: string, packageCount: number
): Promise<number> {
  if (!destination) return 0;
  const { data: ville } = await svc.from("villes").select("id").ilike("name", destination).maybeSingle();
  if (!ville) return 0;
  const { data: agents } = await svc.from("staff").select("id").eq("role", "agent_retrait").eq("pickup_ville_id", ville.id);
  if (!agents?.length) return 0;

  const title = "Nouveau bon de remise";
  const text = packageCount > 1
    ? `${packageCount} colis vous attendent — ${bonNumber || "un nouveau lot"} pour ${destination}.`
    : `Un colis vous attend — ${bonNumber || "un nouveau lot"} pour ${destination}.`;

  let notified = 0;
  await Promise.all((agents as { id: string }[]).map(async (agent) => {
    const [native, web] = await Promise.allSettled([
      sendFcmToStaff(config, agent.id, { title, text, url: "/espace-remise" }),
      sendPushToStaff(config, agent.id, { title, text, url: "/espace-remise" })
    ]);
    if (native.status === "fulfilled") notified += native.value;
    if (web.status === "fulfilled") notified += web.value;
  }));
  return notified;
}
