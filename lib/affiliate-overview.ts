import "server-only";

/**
 * VI ESPAS AFILYE — kalkil SÈL kote.
 * ═══════════════════════════════════
 * /api/affiliate-portal ("me", afilye a li menm) ak /api/admin-auth
 * ("affiliate_overview", admin k ap gade espas yon afilye) rele MENM
 * fonksyon sa a: admin nan wè EGZAKTEMAN sa afilye a wè, jamè yon kalkil
 * diferan ki ta ka montre de chif diferan pou menm moun.
 *
 * `svc` = kliyan Supabase service role (kote sèvè sèlman).
 */
export type AffiliateOverviewResult =
  | { ok: true; data: AffiliateOverview }
  | { ok: false; reason: string };

export interface AffiliateOverview {
  affiliate: {
    fullname: string; code: string; referral_link: string;
    contract_start: string; contract_end: string; status: string;
    commission_amount: number; days_left: number;
    payout_method: string | null; payout_phone: string; payout_updated_at: string | null;
    signed_contract_uploaded_at: string | null;
  };
  commissions: any[];
  totalDue: number;
  totalPaid: number;
  clientsCount: number;
  referredClients: Array<{
    id: string; fullname: string; customer_code: string; created_at: string;
    stage: "account_created" | "service_started" | "commission_added";
    commission_total: number; commission_count: number;
  }>;
}

export async function buildAffiliateOverview(svc: any, aff: any): Promise<AffiliateOverviewResult> {
  const { data: commissions, error: commissionsError } = await svc.from("affiliate_commissions")
    .select("id, amount, status, paid_at, paid_amount_htg, payout_method, created_at, client_id, invoice_id")
    .eq("affiliate_id", aff.id as string).order("created_at", { ascending: false });
  if (commissionsError) return { ok: false, reason: "Impossible de charger les commissions." };

  // Yon kliyan parèt sou espas afilye a DEPI enskripsyon li ak lyen an.
  // Li pa bezwen gen fakti pou afilye a wè li. Nou ajoute eta sèvis la
  // apre nou gade si kliyan sa a gen omwen yon colis, epi eta komisyon an
  // apre nou gade fakti ki deja jenere pou li.
  const { data: clients, error: clientsError } = await svc.from("clients")
    .select("id, fullname, customer_code, created_at")
    .eq("referred_by_affiliate_id", aff.id as string)
    .order("created_at", { ascending: false });
  if (clientsError) return { ok: false, reason: "Impossible de charger les clients référés." };

  const referred = (clients ?? []) as Array<{ id: string; fullname: string; customer_code?: string | null; created_at: string }>;
  const customerCodes = Array.from(new Set(referred.map((client) => String(client.customer_code ?? "").trim()).filter(Boolean)));
  let packages: Array<{ customer_code: string }> = [];
  if (customerCodes.length) {
    const { data, error: packagesError } = await svc.from("packages")
      .select("customer_code")
      .in("customer_code", customerCodes);
    if (packagesError) return { ok: false, reason: "Impossible de vérifier les services des clients." };
    packages = (data ?? []) as Array<{ customer_code: string }>;
  }

  // amount (numeric Postgres) toujou yon nimewo pou espas afilye a — li fè
  // `.toFixed()` dirèkteman; yon string ta kraze tout paj la.
  const list: any[] = (commissions ?? []).map((c: any) => ({ ...c, amount: Number(c.amount) || 0 }));
  const totalDue = list.filter((c) => c.status === "due").reduce((s: number, c) => s + Number(c.amount), 0);
  const totalPaid = list.filter((c) => c.status === "paid").reduce((s: number, c) => s + Number(c.amount), 0);
  const daysLeft = Math.max(0, Math.ceil((new Date(aff.contract_end as string).getTime() - Date.now()) / 86400000));
  const packagesByCode = new Set(packages.map((pkg) => String(pkg.customer_code ?? "").trim()));
  const commissionsByClient = new Map<string, any[]>();
  list.forEach((commission) => {
    if (!commission.client_id) return;
    const clientCommissions = commissionsByClient.get(commission.client_id) ?? [];
    clientCommissions.push(commission);
    commissionsByClient.set(commission.client_id, clientCommissions);
  });
  const referredClients = referred.map((client) => {
    const clientCommissions = commissionsByClient.get(client.id) ?? [];
    const commissionTotal = clientCommissions.reduce((sum, commission) => sum + Number(commission.amount || 0), 0);
    const hasService = !!client.customer_code && packagesByCode.has(client.customer_code);
    const stage: "account_created" | "service_started" | "commission_added" =
      commissionTotal > 0 ? "commission_added" : hasService ? "service_started" : "account_created";
    return {
      id: client.id, fullname: client.fullname, customer_code: client.customer_code ?? "", created_at: client.created_at,
      stage, commission_total: commissionTotal, commission_count: clientCommissions.length
    };
  });

  return {
    ok: true,
    data: {
      affiliate: {
        fullname: aff.fullname, code: aff.code, referral_link: aff.referral_link,
        contract_start: aff.contract_start, contract_end: aff.contract_end, status: aff.status,
        commission_amount: aff.commission_amount, days_left: daysLeft,
        payout_method: aff.payout_method ?? null, payout_phone: aff.payout_phone ?? "", payout_updated_at: aff.payout_updated_at ?? null,
        signed_contract_uploaded_at: aff.signed_contract_path ? aff.signed_contract_uploaded_at : null
      },
      commissions: list, totalDue, totalPaid,
      clientsCount: referredClients.length,
      referredClients
    }
  };
}
