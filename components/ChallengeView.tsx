"use client";
import { useState } from "react";
import { Check, Copy, Gift, Smartphone, Users } from "lucide-react";
import { CLAIM_STATUS_LABEL, claimChallengeReward, type ChallengeMe } from "@/lib/challenge";

const lb = (value: number | undefined | null) => `${Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} lb`;
const day = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";

/**
 * Espace client → CHALLENGE DE NOËL.
 * Sépare « poids expédié » (ses colis livrés) et « poids crédité au challenge »
 * (le grand livre). Un filleul voit que ses livres vont à son parrain, sans
 * aucune donnée de ce parrain. Un affilié voit en plus son lien et ses filleuls.
 */
export default function ChallengeView({ data, onChanged }: { data: ChallengeMe; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  if (!data.campaign) return null;
  const balances = data.balances;
  const rewards = data.rewards ?? [];
  const nextReward = rewards.find((reward) => (balances?.available ?? 0) < reward.target_lbs) ?? rewards[rewards.length - 1];

  const claim = async (rewardId: string, model: string, target: number) => {
    if (busy) return;
    if (!confirm(`Demander « ${model} » ? ${lb(target)} seront réservées sur votre solde.`)) return;
    setBusy(rewardId); setMessage(null);
    try {
      const res = await claimChallengeReward(rewardId);
      setMessage({ ok: true, text: `Demande envoyée. ${lb(res.reserved)} réservées, il vous reste ${lb(res.remaining)}.` });
      onChanged();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Demande impossible." });
    } finally { setBusy(null); }
  };

  const copyLink = async () => {
    if (!data.affiliate) return;
    try { await navigator.clipboard.writeText(data.affiliate.referral_link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* noop */ }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-navy p-5 text-white">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-white/80"><Smartphone size={16} /> {data.campaign.name}</p>
        <p className="mt-1 text-xs text-white/70">Du {day(data.campaign.start_at)}{data.campaign.end_at ? ` au ${day(data.campaign.end_at)}` : ""}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/20 pt-3">
          <div><p className="text-[12px] text-white/75">Poids expédié</p><p className="text-xl font-extrabold">{lb(data.shipped_lbs)}</p></div>
          <div><p className="text-[12px] text-white/75">Crédité au challenge</p><p className="text-xl font-extrabold">{data.sponsored ? "—" : lb(balances?.validated)}</p></div>
        </div>
        {data.sponsored && (
          <p className="mt-3 rounded-xl bg-white/15 px-3 py-2 text-[13px] leading-relaxed">Vos livres sont attribués à votre parrain. Vos colis restent visibles dans votre espace.</p>
        )}
      </section>

      {!data.sponsored && balances && (
        <section className="rounded-2xl border border-line bg-white p-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><p className="text-[11px] text-mute">Disponible</p><p className="text-lg font-extrabold text-accent-dark">{lb(balances.available)}</p></div>
            <div><p className="text-[11px] text-mute">Réservé</p><p className="text-lg font-extrabold text-ink">{lb(balances.reserved)}</p></div>
            <div><p className="text-[11px] text-mute">Utilisé</p><p className="text-lg font-extrabold text-ink">{lb(balances.used)}</p></div>
          </div>
          {nextReward && (
            <div className="mt-4">
              <div className="flex justify-between text-xs font-semibold text-ink"><span>Objectif : {nextReward.model}</span><span>{Math.min(100, Math.round((balances.available / nextReward.target_lbs) * 100))} %</span></div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-mist"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (balances.available / nextReward.target_lbs) * 100)}%` }} /></div>
            </div>
          )}
        </section>
      )}

      {message && <p className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${message.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{message.text}</p>}

      <section>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-navy"><Gift size={16} /> Récompenses</h2>
        <div className="divide-y divide-line rounded-2xl border border-line bg-white">
          {rewards.map((reward) => {
            const reached = !data.sponsored && (balances?.available ?? 0) >= reward.target_lbs;
            return (
              <div key={reward.id} className="flex items-center justify-between gap-3 p-3.5">
                <div className="min-w-0"><p className="font-bold text-ink">{reward.model}</p><p className="text-xs text-mute">{lb(reward.target_lbs)}{reward.condition ? ` · ${reward.condition}` : ""}</p></div>
                {reached
                  ? <button type="button" disabled={!!busy} onClick={() => void claim(reward.id, reward.model, reward.target_lbs)} className="min-h-10 shrink-0 rounded-xl bg-accent px-3.5 text-sm font-bold text-white disabled:opacity-50">{busy === reward.id ? "…" : "Demander"}</button>
                  : <span className="shrink-0 text-xs font-semibold text-mute">{data.sponsored ? "—" : `encore ${lb(reward.target_lbs - (balances?.available ?? 0))}`}</span>}
              </div>
            );
          })}
        </div>
      </section>

      {(data.claims ?? []).length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-extrabold text-navy">Mes demandes</h2>
          <div className="divide-y divide-line rounded-2xl border border-line bg-white">
            {(data.claims ?? []).map((claim) => (
              <div key={claim.id} className="flex items-center justify-between gap-3 p-3.5 text-sm">
                <span className="min-w-0"><b className="text-ink">{claim.reward}</b><span className="block text-xs text-mute">{day(claim.created_at)} · {lb(claim.lbs)}</span></span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${claim.status === "rejected" ? "bg-red-50 text-red-700" : claim.status === "delivered" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{CLAIM_STATUS_LABEL[claim.status]}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.affiliate && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-navy"><Users size={16} /> Mon réseau</h2>
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs text-mute">Votre lien d&apos;inscription · code <b className="text-ink">{data.affiliate.code}</b></p>
            <div className="mt-2 flex gap-2">
              <input readOnly value={data.affiliate.referral_link} className="input min-w-0 flex-1 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
              <button type="button" onClick={() => void copyLink()} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-navy px-3 text-xs font-bold text-white">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copié" : "Copier"}</button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-mist p-2"><p className="text-[11px] text-mute">Filleuls actifs</p><p className="text-lg font-extrabold text-ink">{data.affiliate.active_referrals}</p></div>
              <div className="rounded-xl bg-mist p-2"><p className="text-[11px] text-mute">Nouveaux (challenge)</p><p className="text-lg font-extrabold text-ink">{data.affiliate.new_referrals}</p></div>
            </div>
          </div>
          {data.affiliate.referrals.length > 0 && (
            <div className="divide-y divide-line rounded-2xl border border-line bg-white">
              {data.affiliate.referrals.map((referral) => (
                <div key={referral.code + referral.since} className="flex items-center justify-between gap-3 p-3.5 text-sm">
                  <span className="min-w-0"><b className="text-ink">{referral.name || referral.code}</b><span className="block text-xs text-mute">Inscrit le {day(referral.since)} · {referral.active ? "actif" : "sorti"}</span></span>
                  <span className="shrink-0 font-bold text-accent-dark">{lb(referral.credited_lbs)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
