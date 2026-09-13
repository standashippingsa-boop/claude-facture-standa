"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Copy, HandCoins, RefreshCw, ShieldOff, XCircle } from "lucide-react";
import { adminApi } from "@/lib/authx";
import { getAffiliateApplications, getAffiliateCommissions, getAffiliates } from "@/lib/db";
import { Affiliate, AffiliateApplication, AffiliateCommission } from "@/lib/types";
import { dateFr, usd } from "@/lib/utils";

const PAYOUT_METHODS = ["Espèces", "MonCash", "NatCash", "Virement bancaire", "Zelle"];

export default function AffiliatesPage() {
  const [tab, setTab] = useState<"applications" | "affiliates" | "commissions">("applications");
  const [applications, setApplications] = useState<AffiliateApplication[]>([]);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creds, setCreds] = useState<{ username: string; password: string; referralLink: string; mailSent: boolean; mailError: string } | null>(null);

  const load = async () => {
    const [a, b, c] = await Promise.all([getAffiliateApplications(), getAffiliates(), getAffiliateCommissions()]);
    setApplications(a); setAffiliates(b); setCommissions(c);
  };
  useEffect(() => { load(); }, []);

  const pending = applications.filter((a) => a.status === "pending");

  const approve = async (id?: string) => {
    if (!id) return;
    setBusy(id);
    try {
      const j = await adminApi("affiliate_approve", { application_id: id });
      if (!j.ok) { setNotice("Erè: " + j.reason); return; }
      setCreds({ username: j.username, password: j.password, referralLink: j.referralLink, mailSent: j.mailSent, mailError: j.mailError });
      setNotice(j.mailSent ? `Affilié créé et e-mail envoyé à ${j.affiliate?.email}.` : `Affilié créé, mais l'e-mail n'a pas pu être envoyé (${j.mailError}). Copiez les accès ci-dessous.`);
      await load();
    } finally { setBusy(null); }
  };

  const reject = async (id?: string) => {
    if (!id || !confirm("Rejeter cette candidature ?")) return;
    setBusy(id);
    try { await adminApi("affiliate_reject", { application_id: id }); await load(); } finally { setBusy(null); }
  };

  const revoke = async (id?: string) => {
    if (!id || !confirm("Révoquer cet affilié ? Son lien cessera immédiatement de générer des commissions.")) return;
    setBusy(id);
    try { await adminApi("affiliate_revoke", { affiliate_id: id }); await load(); } finally { setBusy(null); }
  };

  const renew = async (id?: string) => {
    if (!id || !confirm("Générer un nouveau contrat de 3 mois pour cet affilié ?")) return;
    setBusy(id);
    try {
      const j = await adminApi("affiliate_renew", { affiliate_id: id });
      if (!j.ok) { setNotice("Erè: " + j.reason); return; }
      setNotice(`Nouveau contrat : ${j.contractStart} → ${j.contractEnd}.`);
      await load();
    } finally { setBusy(null); }
  };

  const markPaid = async (id?: string, method?: string) => {
    if (!id || !method) return;
    setBusy(id);
    try { await adminApi("affiliate_mark_commission_paid", { commission_id: id, payout_method: method }); await load(); } finally { setBusy(null); }
  };

  return (
    <div className="max-w-6xl">
      <div className="flex items-center gap-3">
        <HandCoins className="text-accent" />
        <h1 className="text-2xl font-bold text-navy">Programme Affiliation</h1>
      </div>
      <p className="mt-1 text-sm text-mute">Candidatures, affiliés actifs et commissions ($10 par facture qualifiée, pendant la durée du contrat).</p>

      {notice && (
        <div className="mt-4 flex items-start justify-between gap-3 rounded-xl bg-mist px-4 py-3 text-sm text-navy">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-mute hover:text-navy"><XCircle size={16} /></button>
        </div>
      )}

      {creds && (
        <div className="mt-4 rounded-xl border border-accent/30 bg-accent-light/40 px-4 py-3.5 text-sm">
          <p className="font-bold text-navy">Accès de l'affilié (à conserver — le mot de passe ne sera plus réaffiché) :</p>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
            <CopyField label="Identifiant" value={creds.username} />
            <CopyField label="Mot de passe" value={creds.password} />
            <CopyField label="Lien" value={creds.referralLink} />
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-2 border-b border-line">
        <TabBtn active={tab === "applications"} onClick={() => setTab("applications")}>
          Candidatures {pending.length > 0 && <Badge>{pending.length}</Badge>}
        </TabBtn>
        <TabBtn active={tab === "affiliates"} onClick={() => setTab("affiliates")}>Affiliés ({affiliates.length})</TabBtn>
        <TabBtn active={tab === "commissions"} onClick={() => setTab("commissions")}>Commissions ({commissions.length})</TabBtn>
      </div>

      {tab === "applications" && (
        <div className="mt-4 space-y-3">
          {!applications.length && <p className="text-sm text-mute">Aucune candidature.</p>}
          {applications.map((a) => (
            <div key={a.id} className="rounded-xl border border-line bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-navy">{a.fullname} <StatusPill status={a.status} /></p>
                  <p className="text-[13px] text-mute">{a.email} · {a.phone}{a.city ? ` · ${a.city}` : ""}</p>
                  <p className="text-[13px] text-mute">{a.id_type} — {a.id_number}</p>
                  {a.motivation && <p className="mt-1.5 max-w-xl text-[13px] italic text-mute">« {a.motivation} »</p>}
                  <p className="mt-1 text-[11px] text-mute">Reçue le {dateFr(a.created_at)}</p>
                </div>
                {a.status === "pending" && (
                  <div className="flex shrink-0 gap-2">
                    <button disabled={busy === a.id} onClick={() => approve(a.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[13px] font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
                      <CheckCircle2 size={15} /> Approuver
                    </button>
                    <button disabled={busy === a.id} onClick={() => reject(a.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-mist px-3 py-2 text-[13px] font-bold text-navy hover:bg-red-50 hover:text-red-700 disabled:opacity-60">
                      <XCircle size={15} /> Rejeter
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "affiliates" && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-[13px]">
            <thead className="bg-mist text-left text-[11px] uppercase text-mute">
              <tr><th className="px-4 py-2.5">Nom</th><th className="px-4 py-2.5">Code / Lien</th><th className="px-4 py-2.5">Contrat</th><th className="px-4 py-2.5">Statut</th><th className="px-4 py-2.5"></th></tr>
            </thead>
            <tbody>
              {affiliates.map((a) => (
                <tr key={a.id} className="border-t border-line">
                  <td className="px-4 py-3"><p className="font-semibold text-navy">{a.fullname}</p><p className="text-mute">{a.email}</p></td>
                  <td className="px-4 py-3"><CopyField label="" value={a.referral_link} compact /></td>
                  <td className="px-4 py-3 text-mute">{dateFr(a.contract_start)} → {dateFr(a.contract_end)}</td>
                  <td className="px-4 py-3"><StatusPill status={a.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {a.status !== "active" && (
                        <button disabled={busy === a.id} onClick={() => renew(a.id)} title="Nouveau contrat de 3 mois"
                          className="inline-flex items-center gap-1 rounded-lg bg-mist px-2.5 py-1.5 text-[12px] font-bold text-navy hover:bg-accent-light">
                          <RefreshCw size={13} /> Renouveler
                        </button>
                      )}
                      {a.status === "active" && (
                        <button disabled={busy === a.id} onClick={() => revoke(a.id)} title="Révoquer"
                          className="inline-flex items-center gap-1 rounded-lg bg-mist px-2.5 py-1.5 text-[12px] font-bold text-navy hover:bg-red-50 hover:text-red-700">
                          <ShieldOff size={13} /> Révoquer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!affiliates.length && <tr><td colSpan={5} className="px-4 py-6 text-center text-mute">Aucun affilié pour le moment.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "commissions" && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-[13px]">
            <thead className="bg-mist text-left text-[11px] uppercase text-mute">
              <tr><th className="px-4 py-2.5">Date</th><th className="px-4 py-2.5">Facture</th><th className="px-4 py-2.5">Client</th><th className="px-4 py-2.5">Montant</th><th className="px-4 py-2.5">Statut</th><th className="px-4 py-2.5"></th></tr>
            </thead>
            <tbody>
              {commissions.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-4 py-3 text-mute">{dateFr(c.created_at)}</td>
                  <td className="px-4 py-3">{c.invoice_number || "—"}</td>
                  <td className="px-4 py-3">{c.client_name || "—"}</td>
                  <td className="px-4 py-3 font-semibold text-navy">{usd(c.amount)}</td>
                  <td className="px-4 py-3">
                    {c.status === "paid"
                      ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Payé{c.payout_method ? ` (${c.payout_method})` : ""}</span>
                      : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">Dû</span>}
                  </td>
                  <td className="px-4 py-3">
                    {c.status === "due" && (
                      <select disabled={busy === c.id} defaultValue=""
                        onChange={(e) => { if (e.target.value) markPaid(c.id, e.target.value); }}
                        className="rounded-lg border border-line px-2 py-1.5 text-[12px]">
                        <option value="" disabled>Marquer payé…</option>
                        {PAYOUT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
              {!commissions.length && <tr><td colSpan={6} className="px-4 py-6 text-center text-mute">Aucune commission pour le moment.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-3.5 py-2.5 text-[13px] font-bold border-b-2 -mb-px transition ${
        active ? "border-accent text-navy" : "border-transparent text-mute hover:text-navy"}`}>
      {children}
    </button>
  );
}
function Badge({ children }: { children: React.ReactNode }) {
  return <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">{children}</span>;
}
function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700", approved: "bg-emerald-100 text-emerald-700", rejected: "bg-red-100 text-red-700",
    active: "bg-emerald-100 text-emerald-700", expired: "bg-mist text-mute", revoked: "bg-red-100 text-red-700"
  };
  return <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${map[status] ?? "bg-mist text-mute"}`}>{status}</span>;
}
function CopyField({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };
  return (
    <div>
      {label && <p className="text-[10px] font-bold uppercase text-mute">{label}</p>}
      <button onClick={copy} title="Copier"
        className={`inline-flex items-center gap-1.5 rounded-lg bg-mist px-2 py-1 font-mono ${compact ? "text-[11px]" : "text-[12.5px]"} text-navy hover:bg-accent-light`}>
        <span className="max-w-[220px] truncate">{value}</span>
        {copied ? <CheckCircle2 size={13} className="text-emerald-600" /> : <Copy size={13} />}
      </button>
    </div>
  );
}
