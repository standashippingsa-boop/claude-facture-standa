"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarClock, CheckCircle2, Clock3, Copy, Eye, HandCoins, Inbox, KeyRound,
  Loader2, RefreshCw, RotateCcw, Search, ShieldOff, UserCheck, Users, Wallet, XCircle
} from "lucide-react";
import { adminApi } from "@/lib/authx";
import { getAffiliateApplications, getAffiliateCommissions, getAffiliates } from "@/lib/db";
import { Affiliate, AffiliateApplication, AffiliateCommission } from "@/lib/types";
import { dateFr, usd } from "@/lib/utils";
import { AFFILIATE_PAYOUT_METHODS, AFFILIATE_PAYOUT_RATE_HTG, formatHtg, toPayoutHtg } from "@/lib/affiliate-terms";

import { useNoticeToast } from "@/lib/notify";
/** Jou ki rete anvan contract_end (0 si deja pase). */
function daysLeft(endISO: string): number {
  const ms = new Date(endISO).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}
/** % tan ki deja pase nan yon kontra 3 mwa (pou ba pwogrè a). */
function contractProgress(startISO: string, endISO: string): number {
  const start = new Date(startISO).getTime(), end = new Date(endISO).getTime(), now = Date.now();
  if (!(end > start)) return 100;
  return Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
}

export default function AffiliatesPage() {
  const [tab, setTab] = useState<"applications" | "affiliates" | "commissions">("applications");
  const [applications, setApplications] = useState<AffiliateApplication[]>([]);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useNoticeToast(notice, setNotice);
  const [creds, setCreds] = useState<{ username: string; password: string; referralLink: string; mailSent: boolean; mailError: string } | null>(null);

  const load = async () => {
    const [a, b, c] = await Promise.all([getAffiliateApplications(), getAffiliates(), getAffiliateCommissions()]);
    setApplications(a); setAffiliates(b); setCommissions(c);
  };
  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const pending = applications.filter((a) => a.status === "pending");
  const activeAffiliates = affiliates.filter((a) => a.status === "active");
  const totalDue = commissions.filter((c) => c.status === "due").reduce((s, c) => s + Number(c.amount), 0);
  const totalPaid = commissions.filter((c) => c.status === "paid").reduce((s, c) => s + Number(c.amount), 0);

  const term = q.trim().toLowerCase();
  const visibleAffiliates = useMemo(() => !term ? affiliates
    : affiliates.filter((a) => [a.fullname, a.code, a.email].join(" ").toLowerCase().includes(term)),
    [affiliates, term]);

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
    if (!id || !confirm("Révoquer cet affilié ? Son lien cessera immédiatement de générer des commissions et il sera déconnecté. Vous pourrez le réactiver plus tard.")) return;
    setBusy(id);
    try {
      const j = await adminApi("affiliate_revoke", { affiliate_id: id });
      if (!j.ok) setNotice("Erè: " + j.reason);
      await load();
    } finally { setBusy(null); }
  };

  const reactivate = async (a: Affiliate) => {
    if (!a.id) return;
    const expired = a.contract_end < new Date().toISOString().slice(0, 10);
    if (!confirm(
      `Réactiver ${a.fullname} ?\n\n`
      + `➜ Même code, même lien et même mot de passe : il peut se reconnecter tout de suite.\n`
      + `➜ Les commissions reprennent pour les factures émises à partir de maintenant (pas pour celles émises pendant la révocation).\n`
      + (expired ? `➜ Son contrat était terminé : un nouveau contrat de 3 mois commence aujourd'hui.` : `➜ Le contrat reste valide jusqu'au ${dateFr(a.contract_end)}.`)
    )) return;
    setBusy(a.id);
    try {
      const j = await adminApi("affiliate_reactivate", { affiliate_id: a.id });
      if (!j.ok) { setNotice("Erè: " + j.reason); return; }
      setNotice(j.restarted
        ? `${a.fullname} est réactivé, avec un nouveau contrat du ${dateFr(j.contractStart)} au ${dateFr(j.contractEnd)}.`
        : `${a.fullname} est réactivé (contrat valide jusqu'au ${dateFr(j.contractEnd)}). Il peut se reconnecter avec ses accès habituels.`);
      await load();
    } finally { setBusy(null); }
  };

  const renew = async (id?: string) => {
    if (!id || !confirm("Créer un nouveau lien et un nouveau contrat de 3 mois pour cet affilié ? L'ancien lien cessera de générer des commissions.")) return;
    setBusy(id);
    try {
      const j = await adminApi("affiliate_renew", { affiliate_id: id });
      if (!j.ok) { setNotice("Erè: " + j.reason); return; }
      setCreds({ username: j.username, password: j.password, referralLink: j.referralLink, mailSent: j.mailSent, mailError: j.mailError });
      setNotice(j.mailSent ? `Nouveau lien créé (${j.contractStart} → ${j.contractEnd}) et e-mail envoyé à ${j.affiliate?.email}.` : `Nouveau lien créé, mais l'e-mail n'a pas pu être envoyé (${j.mailError}). Copiez les accès ci-dessous.`);
      await load();
    } finally { setBusy(null); }
  };

  const resetPassword = async (id?: string) => {
    if (!id || !confirm("Réinitialiser le mot de passe de cet affilié ? Ses sessions actives seront déconnectées.")) return;
    setBusy(id);
    try {
      const j = await adminApi("affiliate_reset_password", { affiliate_id: id });
      if (!j.ok) { setNotice("Erè: " + j.reason); return; }
      const a = affiliates.find((x) => x.id === id);
      setCreds({ username: a?.username ?? "", password: j.password, referralLink: a?.referral_link ?? "", mailSent: false, mailError: "Nouveau mot de passe — communiquez-le vous-même à l'affilié." });
      setNotice("Mot de passe réinitialisé. Copiez-le ci-dessous et transmettez-le à l'affilié.");
    } finally { setBusy(null); }
  };

  const affiliateById = useMemo(() => new Map(affiliates.map((a) => [a.id, a])), [affiliates]);

  const markPaid = async (c: AffiliateCommission, method?: string) => {
    if (!c.id || !method) return;
    const aff = affiliateById.get(c.affiliate_id);
    const to = aff?.payout_method === method && aff.payout_phone ? ` au ${aff.payout_phone}` : "";
    if (!confirm(`Confirmer le paiement de ${formatHtg(toPayoutHtg(Number(c.amount)))} par ${method}${to} ?\n(${usd(c.amount)} au taux de ${AFFILIATE_PAYOUT_RATE_HTG} HTG)`)) return;
    setBusy(c.id);
    try {
      const j = await adminApi("affiliate_mark_commission_paid", { commission_id: c.id, payout_method: method });
      if (!j.ok) setNotice("Erè: " + j.reason);
      await load();
    } finally { setBusy(null); }
  };

  const viewContract = async (id?: string) => {
    if (!id) return;
    setBusy(id);
    try {
      const j = await adminApi("affiliate_contract_url", { affiliate_id: id });
      if (!j.ok) { setNotice("Erè: " + j.reason); return; }
      window.open(j.url, "_blank", "noopener");
    } finally { setBusy(null); }
  };

  return (
    <div className="max-w-6xl">
      <div className="flex items-center gap-3">
        <HandCoins className="text-accent" />
        <h1 className="text-2xl font-bold text-navy">Programme Affiliation</h1>
      </div>
      <p className="mt-1 text-sm text-mute">Candidatures, affiliés actifs et commissions ($10 par facture qualifiée, pendant la durée du contrat). Paiement uniquement en gourdes ({AFFILIATE_PAYOUT_RATE_HTG} HTG pour 1 USD), par MonCash ou NatCash.</p>

      {/* ── KPI — vue d'ensemble ─────────────────────────────────────── */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Clock3} tone="amber" label="Candidatures en attente" value={loading ? "—" : String(pending.length)} />
        <Kpi icon={UserCheck} tone="emerald" label="Affiliés actifs" value={loading ? "—" : String(activeAffiliates.length)} />
        <Kpi icon={Wallet} tone="amber" label="Commissions dues" value={loading ? "—" : usd(totalDue)} />
        <Kpi icon={CheckCircle2} tone="navy" label="Commissions payées" value={loading ? "—" : usd(totalPaid)} />
      </div>

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

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-line">
        <div className="flex gap-2">
          <TabBtn active={tab === "applications"} onClick={() => setTab("applications")}>
            Candidatures {pending.length > 0 && <Badge>{pending.length}</Badge>}
          </TabBtn>
          <TabBtn active={tab === "affiliates"} onClick={() => setTab("affiliates")}>Affiliés ({affiliates.length})</TabBtn>
          <TabBtn active={tab === "commissions"} onClick={() => setTab("commissions")}>Commissions ({commissions.length})</TabBtn>
        </div>
        {tab === "affiliates" && affiliates.length > 0 && (
          <div className="relative mb-2 w-full sm:mb-0 sm:w-56">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-mute" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un affilié…"
              className="w-full rounded-lg border border-line py-1.5 pl-8 pr-2.5 text-[12.5px] outline-none focus:border-accent" />
          </div>
        )}
      </div>

      {loading ? (
        <TableSkeleton />
      ) : (
        <>
          {tab === "applications" && (
            <div className="mt-4 space-y-3">
              {!applications.length && <EmptyState icon={Inbox} text="Aucune candidature pour le moment." />}
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
                        <SpinButton busy={busy === a.id} onClick={() => approve(a.id)} icon={CheckCircle2}
                          className="bg-emerald-600 text-white hover:bg-emerald-700">Approuver</SpinButton>
                        <SpinButton busy={busy === a.id} onClick={() => reject(a.id)} icon={XCircle}
                          className="bg-mist text-navy hover:bg-red-50 hover:text-red-700">Rejeter</SpinButton>
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
                  <tr><th className="px-4 py-2.5">Nom</th><th className="px-4 py-2.5">Code / Lien</th><th className="px-4 py-2.5">Contrat</th><th className="px-4 py-2.5">Contrat signé</th><th className="px-4 py-2.5">Paiement (HTG)</th><th className="px-4 py-2.5">Statut</th><th className="px-4 py-2.5"></th></tr>
                </thead>
                <tbody>
                  {visibleAffiliates.map((a) => {
                    const left = daysLeft(a.contract_end);
                    const pct = contractProgress(a.contract_start, a.contract_end);
                    const urgent = a.status === "active" && left <= 14;
                    return (
                      <tr key={a.id} className="border-t border-line align-top">
                        <td className="px-4 py-3"><Link href={`/affiliates/${a.id}`} className="font-semibold text-navy hover:underline">{a.fullname}</Link><p className="text-mute">{a.email}</p><Link href={`/affiliates/${a.id}`} className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-accent hover:underline"><Eye size={11} /> Voir son espace</Link></td>
                        <td className="px-4 py-3"><CopyField label="" value={a.referral_link} compact /></td>
                        <td className="px-4 py-3 text-mute">
                          <p>{dateFr(a.contract_start)} → {dateFr(a.contract_end)}</p>
                          {a.status === "active" && (
                            <div className="mt-1.5 w-32">
                              <div className="h-1.5 overflow-hidden rounded-full bg-mist">
                                <div className={`h-full rounded-full ${urgent ? "bg-amber-500" : "bg-accent"}`} style={{ width: `${pct}%` }} />
                              </div>
                              <p className={`mt-1 text-[11px] font-semibold ${urgent ? "text-amber-700" : "text-mute"}`}>
                                {left > 0 ? `${left} jour${left > 1 ? "s" : ""} restant${left > 1 ? "s" : ""}`
                                  : a.contract_end < new Date().toISOString().slice(0, 10)
                                    ? "Contrat terminé — plus de commission, à renouveler"
                                    : "Expire aujourd'hui"}
                              </p>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {a.signed_contract_path ? (
                            <div>
                              <SpinButton busy={busy === a.id} onClick={() => viewContract(a.id)} icon={Eye}
                                title="Ouvrir le contrat signé" compact className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100">Voir</SpinButton>
                              <p className="mt-1 text-[11px] text-mute">Reçu le {dateFr(a.signed_contract_uploaded_at ?? "")}</p>
                            </div>
                          ) : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Non reçu</span>}
                        </td>
                        <td className="px-4 py-3">
                          {a.payout_method
                            ? <><p className="font-semibold text-navy">{a.payout_method}</p><p className="font-mono text-[12px] text-mute">{a.payout_phone}</p>{a.payout_updated_at && <p className="text-[11px] text-mute">modifié le {dateFr(a.payout_updated_at)}</p>}</>
                            : <span className="text-[12px] text-mute">Non choisi</span>}
                        </td>
                        <td className="px-4 py-3"><StatusPill status={a.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            {a.status === "revoked" ? (
                              <SpinButton busy={busy === a.id} onClick={() => reactivate(a)} icon={RotateCcw}
                                title="Annuler la révocation : même code, même lien" compact className="bg-emerald-600 text-white hover:bg-emerald-700">Réactiver</SpinButton>
                            ) : (
                              <SpinButton busy={busy === a.id} onClick={() => renew(a.id)} icon={RefreshCw}
                                title="Nouveau lien + nouveau contrat de 3 mois" compact className="bg-mist text-navy hover:bg-accent-light">Renouveler</SpinButton>
                            )}
                            {a.status === "active" && (
                              <>
                                <SpinButton busy={busy === a.id} onClick={() => resetPassword(a.id)} icon={KeyRound}
                                  title="Réinitialiser le mot de passe" compact className="bg-mist text-navy hover:bg-accent-light">Modpas</SpinButton>
                                <SpinButton busy={busy === a.id} onClick={() => revoke(a.id)} icon={ShieldOff}
                                  title="Révoquer" compact className="bg-mist text-navy hover:bg-red-50 hover:text-red-700">Révoquer</SpinButton>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!affiliates.length && (
                    <tr><td colSpan={7} className="px-4 py-10"><EmptyState icon={Users} text="Aucun affilié pour le moment." /></td></tr>
                  )}
                  {!!affiliates.length && !visibleAffiliates.length && (
                    <tr><td colSpan={7} className="px-4 py-10"><EmptyState icon={Search} text={`Aucun résultat pour « ${q} ».`} /></td></tr>
                  )}
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
                      <td className="px-4 py-3 font-semibold text-navy">
                        {usd(c.amount)}
                        <span className="block text-[11px] font-normal text-mute">{formatHtg(c.status === "paid" && c.paid_amount_htg != null ? Number(c.paid_amount_htg) : toPayoutHtg(Number(c.amount)))}</span>
                      </td>
                      <td className="px-4 py-3">
                        {c.status === "paid"
                          ? <span title={c.paid_by ? `Marqué payé par ${c.paid_by}` : undefined}
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                              <CheckCircle2 size={11} /> Payé{c.payout_method ? ` (${c.payout_method})` : ""}{c.paid_by ? ` · ${c.paid_by}` : ""}
                            </span>
                          : <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                              <Clock3 size={11} /> Dû
                            </span>}
                      </td>
                      <td className="px-4 py-3">
                        {c.status === "due" && (() => {
                          const aff = affiliateById.get(c.affiliate_id);
                          const preferred = aff?.payout_method ?? null;
                          const methods = preferred ? [preferred, ...AFFILIATE_PAYOUT_METHODS.filter((m) => m !== preferred)] : [...AFFILIATE_PAYOUT_METHODS];
                          return (
                            <div>
                              <select disabled={busy === c.id} value=""
                                onChange={(e) => { if (e.target.value) void markPaid(c, e.target.value); }}
                                className="rounded-lg border border-line px-2 py-1.5 text-[12px] disabled:opacity-60">
                                <option value="" disabled>{busy === c.id ? "Enregistrement…" : "Marquer payé…"}</option>
                                {methods.map((m) => <option key={m} value={m}>{m}{m === preferred ? " (choix de l'affilié)" : ""}</option>)}
                              </select>
                              {aff && <p className="mt-1 text-[11px] text-mute">{preferred ? `${preferred} · ${aff.payout_phone}` : "Mode non choisi par l'affilié"}</p>}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                  {!commissions.length && (
                    <tr><td colSpan={6} className="px-4 py-10"><EmptyState icon={HandCoins} text="Aucune commission pour le moment." /></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: string; tone: "amber" | "emerald" | "navy" }) {
  const tones: Record<string, string> = {
    amber: "bg-amber-100 text-amber-700", emerald: "bg-emerald-100 text-emerald-700", navy: "bg-accent-light text-accent-dark"
  };
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="flex items-center gap-2.5">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tones[tone]}`}><Icon size={17} /></span>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-mute">{label}</p>
          <p className="text-[19px] font-black text-navy">{value}</p>
        </div>
      </div>
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
const STATUS_LABELS: Record<string, string> = {
  pending: "En attente", approved: "Approuvée", rejected: "Rejetée",
  active: "Actif", expired: "Expiré", revoked: "Révoqué"
};
function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700", approved: "bg-emerald-100 text-emerald-700", rejected: "bg-red-100 text-red-700",
    active: "bg-emerald-100 text-emerald-700", expired: "bg-mist text-mute", revoked: "bg-red-100 text-red-700"
  };
  return <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${map[status] ?? "bg-mist text-mute"}`}>{STATUS_LABELS[status] ?? status}</span>;
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

/** Bouton ki montre yon ti wonn k ap vire pandan aksyon an ap trete. */
function SpinButton({ busy, onClick, icon: Icon, title, compact, className, children }: {
  busy: boolean; onClick: () => void; icon: typeof RefreshCw; title?: string; compact?: boolean; className: string; children: React.ReactNode;
}) {
  return (
    <button disabled={busy} onClick={onClick} title={title}
      className={`inline-flex items-center gap-1.5 rounded-lg font-bold disabled:opacity-60 ${
        compact ? "px-2.5 py-1.5 text-[12px]" : "px-3 py-2 text-[13px]"} ${className}`}>
      {busy ? <Loader2 size={compact ? 13 : 15} className="animate-spin" /> : <Icon size={compact ? 13 : 15} />}
      {children}
    </button>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof Inbox; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-2 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-mist text-mute"><Icon size={19} /></span>
      <p className="text-[13px] text-mute">{text}</p>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="mt-4 animate-pulse space-y-2.5">
      {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-mist" />)}
    </div>
  );
}
