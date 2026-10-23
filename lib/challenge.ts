import { supabase } from "./supabase";

/**
 * CHALLENGE DE NOËL — accès client et admin.
 * Toutes les règles (bénéficiaire, idempotence, réservation atomique, droits)
 * sont dans la base : fonctions SECURITY DEFINER (supabase/20261020_challenge.sql).
 * Ce fichier ne fait qu'appeler ces fonctions.
 */
export type ChallengeBalances = { validated: number; reserved: number; used: number; available: number };
export type ChallengeReward = { id: string; model: string; target_lbs: number; condition: string };
export type ChallengeClaim = { id: string; reward: string; lbs: number; status: "pending" | "approved" | "rejected" | "delivered"; created_at: string };
export type ChallengeReferral = { code: string; name: string; since: string; active: boolean; credited_lbs: number };
export type ChallengeMe = {
  campaign: { id: string; name: string; start_at: string; end_at: string | null; allow_repeat_wins: boolean } | null;
  rewards?: ChallengeReward[];
  shipped_lbs?: number;
  sponsored?: boolean;
  is_affiliate?: boolean;
  /** Participation de l'affilié au challenge (validée par l'admin). Absent = migration non appliquée. */
  enrollment?: EnrollmentStatus | null;
  balances?: ChallengeBalances;
  claims?: ChallengeClaim[];
  affiliate?: { code: string; referral_link: string; active_referrals: number; new_referrals: number; referrals: ChallengeReferral[] };
};

export type EnrollmentStatus = "none" | "pending" | "approved" | "rejected";
export const ENROLLMENT_LABEL: Record<EnrollmentStatus, string> = { none: "Non inscrit", pending: "Demande en attente", approved: "Validé", rejected: "Refusé" };

export const CLAIM_STATUS_LABEL: Record<ChallengeClaim["status"], string> = {
  pending: "En attente", approved: "Approuvée", rejected: "Refusée", delivered: "Remise"
};

export async function getChallengeMe(): Promise<ChallengeMe | null> {
  const { data, error } = await supabase.rpc("challenge_me");
  if (error) return null;
  return data as ChallengeMe;
}

export async function claimChallengeReward(rewardId: string): Promise<{ claim_id: string; reserved: number; remaining: number }> {
  const { data, error } = await supabase.rpc("challenge_claim", { p_reward_id: rewardId });
  if (error) throw new Error(error.message);
  return data as { claim_id: string; reserved: number; remaining: number };
}

/** L'affilié connecté demande à participer au challenge. */
export async function requestChallengeEnrollment(): Promise<EnrollmentStatus> {
  const { data, error } = await supabase.rpc("challenge_request_enrollment");
  if (error) throw new Error(error.message);
  return (data as { status: EnrollmentStatus }).status;
}

// ── Administration ──
export type ChallengeCampaign = { id: string; name: string; start_at: string; end_at: string | null; status: "draft" | "active" | "closed"; allow_repeat_wins: boolean };
export type AdminReward = { id: string; campaign_id: string; model: string; target_lbs: number; max_budget_usd: number; condition: string; active: boolean; sort_order: number };
export type AdminParticipant = { code: string; name: string; type: string; validated: number; available: number; packages: number };
export type AdminAffiliate = { id: string; code: string; name: string; client_code: string | null; enrollment: EnrollmentStatus; requested_at: string | null; decided_by: string; referrals: number; has_lbs: boolean };
export type AdminClaim = { id: string; reward: string; lbs: number; status: ChallengeClaim["status"]; participant: string; name: string; price_paid: number | null; created_at: string; decided_by: string };

export async function getAdminChallenge(): Promise<{ campaign: ChallengeCampaign | null; rewards: AdminReward[]; participants: AdminParticipant[]; claims: AdminClaim[]; affiliates: AdminAffiliate[] | null }> {
  const { data: campaigns, error } = await supabase.from("challenge_campaigns").select("*").order("created_at", { ascending: false }).limit(1);
  if (error) throw error;
  const campaign = (campaigns?.[0] ?? null) as ChallengeCampaign | null;
  if (!campaign) return { campaign: null, rewards: [], participants: [], claims: [], affiliates: null };
  const [{ data: rewards }, overview] = await Promise.all([
    supabase.from("challenge_rewards").select("*").eq("campaign_id", campaign.id).order("sort_order"),
    supabase.rpc("challenge_admin_overview", { p_campaign: campaign.id })
  ]);
  if (overview.error) throw overview.error;
  const ov = (overview.data ?? {}) as { participants?: AdminParticipant[]; claims?: AdminClaim[]; affiliates?: AdminAffiliate[] };
  // affiliates absent = migration 20261022_challenge_affiliate_enrollment.sql pas encore appliquée.
  return { campaign, rewards: (rewards ?? []) as AdminReward[], participants: ov.participants ?? [], claims: ov.claims ?? [], affiliates: ov.affiliates ?? null };
}

export async function saveCampaign(id: string, patch: Partial<ChallengeCampaign>): Promise<void> {
  const { error } = await supabase.from("challenge_campaigns").update(patch).eq("id", id);
  if (error) throw error;
}

export async function saveReward(reward: Partial<AdminReward> & { campaign_id: string }): Promise<void> {
  const { id, ...row } = reward;
  const { error } = id ? await supabase.from("challenge_rewards").update(row).eq("id", id) : await supabase.from("challenge_rewards").insert(row);
  if (error) throw error;
}

export async function decideClaim(claimId: string, action: "approve" | "reject" | "deliver", price?: number, proof?: string): Promise<void> {
  const { error } = await supabase.rpc("challenge_decide_claim", { p_claim_id: claimId, p_action: action, p_price: price ?? null, p_proof: proof ?? "" });
  if (error) throw new Error(error.message);
}

export async function promoteClientToAffiliate(customerCode: string): Promise<{ code: string }> {
  const { data: client, error } = await supabase.from("clients").select("id").eq("customer_code", customerCode.trim().toUpperCase()).maybeSingle();
  if (error) throw error;
  if (!client) throw new Error("Code client introuvable.");
  const res = await supabase.rpc("challenge_promote_client", { p_client_id: client.id });
  if (res.error) throw new Error(res.error.message);
  return res.data as { code: string };
}

export async function linkAffiliateToClient(affiliateId: string, customerCode: string): Promise<void> {
  const { error } = await supabase.rpc("challenge_link_affiliate_client", { p_affiliate_id: affiliateId, p_client_code: customerCode });
  if (error) throw new Error(error.message);
}

export async function decideEnrollment(affiliateId: string, action: "approve" | "reject" | "remove"): Promise<void> {
  const { error } = await supabase.rpc("challenge_decide_enrollment", { p_affiliate_id: affiliateId, p_action: action });
  if (error) throw new Error(error.message);
}
