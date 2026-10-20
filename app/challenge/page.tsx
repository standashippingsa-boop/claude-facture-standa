"use client";
/*
 * STANDA — CHALLENGE DE NOËL (console administrateur)
 * Campagne et barème, participants, demandes de récompense, promotions
 * client → affilié. Les règles (crédits, réservations, droits) sont dans la
 * base ; cet écran ne fait qu'appeler les fonctions sécurisées.
 */
import { useEffect, useState } from "react";
import { Download, Plus, Trophy, UserPlus } from "lucide-react";
import Loader, { BusyButton } from "@/components/Loader";
import RefreshButton from "@/components/RefreshButton";
import { supabase } from "@/lib/supabase";
import { notify } from "@/lib/notify";
import {
  CLAIM_STATUS_LABEL, decideClaim, getAdminChallenge, linkAffiliateToClient, promoteClientToAffiliate, saveCampaign, saveReward,
  type AdminClaim, type AdminParticipant, type AdminReward, type ChallengeCampaign
} from "@/lib/challenge";

const lb = (value: number | null | undefined) => `${Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} lb`;
const toLocal = (iso: string | null) => iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
const fromLocal = (value: string) => value ? new Date(value).toISOString() : null;
const STATUS_LABEL: Record<ChallengeCampaign["status"], string> = { draft: "Brouillon (invisible)", active: "Active", closed: "Clôturée" };

export default function ChallengeAdminPage() {
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<ChallengeCampaign | null>(null);
  const [rewards, setRewards] = useState<AdminReward[]>([]);
  const [participants, setParticipants] = useState<AdminParticipant[]>([]);
  const [claims, setClaims] = useState<AdminClaim[]>([]);
  const [affiliates, setAffiliates] = useState<Array<{ id: string; fullname: string; code: string; client_id: string | null }>>([]);
  const [busy, setBusy] = useState(false);
  const [promoteCode, setPromoteCode] = useState("");
  const [linkCodes, setLinkCodes] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      const data = await getAdminChallenge();
      setCampaign(data.campaign); setRewards(data.rewards); setParticipants(data.participants); setClaims(data.claims);
      const { data: affs } = await supabase.from("affiliates").select("id, fullname, code, client_id").order("created_at");
      setAffiliates((affs ?? []) as typeof affiliates);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Chargement impossible.");
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const run = async (task: () => Promise<void>, success: string) => {
    if (busy) return;
    setBusy(true);
    try { await task(); notify.success(success); await load(); }
    catch (error) { notify.error(error instanceof Error ? error.message : "Opération impossible."); }
    finally { setBusy(false); }
  };

  if (loading) return <Loader inline />;
  if (!campaign) return <p className="card p-6 text-sm text-mute">Aucune campagne. La migration du challenge doit être appliquée.</p>;

  const saveCampaignForm = () => run(async () => {
    if (campaign.status === "active" && !confirm("Activer la campagne ? Les livres des colis livrés pendant la période seront crédités et les clients verront le challenge.")) throw new Error("Activation annulée.");
    await saveCampaign(campaign.id, { name: campaign.name, start_at: campaign.start_at, end_at: campaign.end_at, status: campaign.status, allow_repeat_wins: campaign.allow_repeat_wins });
  }, "Campagne enregistrée.");

  const exportCsv = () => {
    const rows = [["Code", "Nom", "Type", "Livres validés", "Disponible", "Colis"], ...participants.map((p) => [p.code, p.name, p.type, p.validated, p.available, p.packages])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `challenge-participants-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const deliver = (claim: AdminClaim) => {
    const price = prompt(`Prix réel payé pour « ${claim.reward} » (USD) :`);
    if (price === null) return;
    const proof = prompt("Preuve de remise (ex. numéro de série, photo, signature) :") ?? "";
    void run(() => decideClaim(claim.id, "deliver", Number(price.replace(",", ".")) || 0, proof), "Remise enregistrée.");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="h-page flex items-center gap-2"><Trophy size={22} /> CHALLENGE DE NOËL</h1>
        <RefreshButton onRefresh={load} />
      </div>

      {/* Campagne */}
      <section className="card space-y-3 p-5">
        <h2 className="h-sec">Campagne</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-bold text-mute">Nom<input className="input mt-1" value={campaign.name} onChange={(e) => setCampaign({ ...campaign, name: e.target.value })} /></label>
          <label className="block text-xs font-bold text-mute">Statut
            <select className="input mt-1" value={campaign.status} onChange={(e) => setCampaign({ ...campaign, status: e.target.value as ChallengeCampaign["status"] })}>
              {(["draft", "active", "closed"] as const).map((value) => <option key={value} value={value}>{STATUS_LABEL[value]}</option>)}
            </select>
          </label>
          <label className="block text-xs font-bold text-mute">Début<input type="datetime-local" className="input mt-1" value={toLocal(campaign.start_at)} onChange={(e) => setCampaign({ ...campaign, start_at: fromLocal(e.target.value) ?? campaign.start_at })} /></label>
          <label className="block text-xs font-bold text-mute">Fin (vide = sans fin)<input type="datetime-local" className="input mt-1" value={toLocal(campaign.end_at)} onChange={(e) => setCampaign({ ...campaign, end_at: fromLocal(e.target.value) })} /></label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={campaign.allow_repeat_wins} onChange={(e) => setCampaign({ ...campaign, allow_repeat_wins: e.target.checked })} /> Un participant peut gagner plusieurs récompenses</label>
        <p className="text-xs text-mute">Seuls les colis passés à « Livré » (payés et remis) pendant la période sont crédités. En brouillon, rien n&apos;est visible ni crédité.</p>
        <BusyButton className="btn btn-brand" onClick={saveCampaignForm} busy={busy}>Enregistrer la campagne</BusyButton>
      </section>

      {/* Barème */}
      <section className="card overflow-x-auto p-5">
        <div className="flex items-center justify-between"><h2 className="h-sec">Récompenses</h2>
          <button type="button" className="btn btn-ghost border border-line" onClick={() => setRewards([...rewards, { id: "", campaign_id: campaign.id, model: "", target_lbs: 0, max_budget_usd: 0, condition: "", active: true, sort_order: rewards.length + 1 }])}><Plus size={14} /> Ajouter</button>
        </div>
        <table className="mt-3 w-full min-w-[640px] text-sm">
          <thead><tr>{["Modèle", "Seuil (lb)", "Budget max $", "Condition", "Active", ""].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>{rewards.map((reward, index) => {
            const set = (patch: Partial<AdminReward>) => setRewards(rewards.map((row, i) => i === index ? { ...row, ...patch } : row));
            return <tr key={reward.id || `new-${index}`}>
              <td className="td"><input className="input" value={reward.model} onChange={(e) => set({ model: e.target.value })} /></td>
              <td className="td"><input className="input w-24" type="number" step="0.01" value={reward.target_lbs} onChange={(e) => set({ target_lbs: Number(e.target.value) })} /></td>
              <td className="td"><input className="input w-24" type="number" step="0.01" value={reward.max_budget_usd} onChange={(e) => set({ max_budget_usd: Number(e.target.value) })} /></td>
              <td className="td"><input className="input" value={reward.condition} onChange={(e) => set({ condition: e.target.value })} placeholder="neuf, 256 Go…" /></td>
              <td className="td"><input type="checkbox" checked={reward.active} onChange={(e) => set({ active: e.target.checked })} /></td>
              <td className="td"><button type="button" className="btn !py-1 !text-xs" disabled={busy || !reward.model.trim() || !(reward.target_lbs > 0)}
                onClick={() => void run(() => saveReward({ ...reward, id: reward.id || undefined, model: reward.model.trim() }), "Récompense enregistrée.")}>Enregistrer</button></td>
            </tr>;
          })}</tbody>
        </table>
      </section>

      {/* Demandes */}
      <section className="card overflow-x-auto p-5">
        <h2 className="h-sec">Demandes de récompense · {claims.length}</h2>
        {claims.length === 0 ? <p className="mt-2 text-sm text-mute">Aucune demande.</p> : (
          <table className="mt-3 w-full min-w-[720px] text-sm">
            <thead><tr>{["Date", "Participant", "Récompense", "Livres", "Statut", "Actions"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>{claims.map((claim) => <tr key={claim.id}>
              <td className="td">{new Date(claim.created_at).toLocaleDateString("fr-FR")}</td>
              <td className="td"><b>{claim.participant}</b><span className="block text-xs text-mute">{claim.name}</span></td>
              <td className="td">{claim.reward}</td>
              <td className="td">{lb(claim.lbs)}</td>
              <td className="td">{CLAIM_STATUS_LABEL[claim.status]}{claim.price_paid != null ? ` · $${claim.price_paid}` : ""}</td>
              <td className="td whitespace-nowrap">
                {claim.status === "pending" && <button type="button" className="mr-2 font-bold text-emerald-700" disabled={busy} onClick={() => void run(() => decideClaim(claim.id, "approve"), "Demande approuvée.")}>Approuver</button>}
                {claim.status === "approved" && <button type="button" className="mr-2 font-bold text-navy" disabled={busy} onClick={() => deliver(claim)}>Remettre</button>}
                {(claim.status === "pending" || claim.status === "approved") && <button type="button" className="font-bold text-red-600" disabled={busy} onClick={() => { if (confirm("Refuser ? Les livres réservés seront restitués.")) void run(() => decideClaim(claim.id, "reject"), "Demande refusée, livres restitués."); }}>Refuser</button>}
              </td>
            </tr>)}</tbody>
          </table>
        )}
      </section>

      {/* Participants */}
      <section className="card overflow-x-auto p-5">
        <div className="flex items-center justify-between"><h2 className="h-sec">Participants · {participants.length}</h2>
          <button type="button" className="btn btn-ghost border border-line" onClick={exportCsv} disabled={!participants.length}><Download size={14} /> Export CSV</button>
        </div>
        {participants.length === 0 ? <p className="mt-2 text-sm text-mute">Aucun livre crédité pour le moment.</p> : (
          <table className="mt-3 w-full min-w-[600px] text-sm">
            <thead><tr>{["#", "Code", "Nom", "Type", "Validé", "Disponible", "Colis"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>{participants.map((p, i) => <tr key={p.code + p.type}>
              <td className="td">{i + 1}</td><td className="td font-bold">{p.code}</td><td className="td">{p.name}</td><td className="td">{p.type}</td>
              <td className="td">{lb(p.validated)}</td><td className="td font-bold text-accent-dark">{lb(p.available)}</td><td className="td">{p.packages}</td>
            </tr>)}</tbody>
          </table>
        )}
      </section>

      {/* Affiliés */}
      <section className="card space-y-4 p-5">
        <h2 className="h-sec">Affiliés</h2>
        <div>
          <p className="text-xs font-bold text-mute">Promouvoir un client en affilié</p>
          <p className="text-[11px] text-slate-500">Il quitte le réseau de son parrain maintenant ; ses anciens crédits restent au parrain. Il reçoit un lien et un code.</p>
          <div className="mt-2 flex gap-2">
            <input className="input max-w-xs font-mono" placeholder="MC-12345" value={promoteCode} onChange={(e) => setPromoteCode(e.target.value)} />
            <button type="button" className="btn" disabled={busy || !promoteCode.trim()} onClick={() => { if (confirm(`Promouvoir ${promoteCode.trim()} en affilié ?`)) void run(async () => { const res = await promoteClientToAffiliate(promoteCode); setPromoteCode(""); notify.success(`Code affilié : ${res.code}`); }, "Client promu affilié."); }}><UserPlus size={14} /> Promouvoir</button>
          </div>
        </div>
        {affiliates.some((a) => !a.client_id) && (
          <div>
            <p className="text-xs font-bold text-mute">Affiliés existants à relier à leur compte client</p>
            <p className="text-[11px] text-slate-500">Une fois relié, l&apos;affilié voit son challenge et son réseau dans son espace client.</p>
            <div className="mt-2 space-y-2">{affiliates.filter((a) => !a.client_id).map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-[180px] font-semibold">{a.fullname} <span className="text-xs text-mute">· {a.code}</span></span>
                <input className="input w-36 font-mono" placeholder="MC-12345" value={linkCodes[a.id] ?? ""} onChange={(e) => setLinkCodes({ ...linkCodes, [a.id]: e.target.value })} />
                <button type="button" className="btn btn-ghost border border-line" disabled={busy || !(linkCodes[a.id] ?? "").trim()} onClick={() => void run(() => linkAffiliateToClient(a.id, linkCodes[a.id]), "Affilié relié à son compte client.")}>Relier</button>
              </div>
            ))}</div>
          </div>
        )}
      </section>
    </div>
  );
}
