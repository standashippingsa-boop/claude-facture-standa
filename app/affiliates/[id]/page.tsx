"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, BadgeDollarSign, Bell, CheckCircle2, Clock3, Eye, FileSignature, HandCoins, History, IdCard, Loader2,
  LogIn, PackageCheck, UserPlus, Users, Wallet
} from "lucide-react";
import { adminApi } from "@/lib/authx";
import { dateFr, usd } from "@/lib/utils";
import { formatHtg, toPayoutHtg } from "@/lib/affiliate-terms";

/**
 * ADMIN — "antre" nan espas yon afilye (LEKTI SÈLMAN).
 * Pati anwo a montre EGZAKTEMAN sa afilye a wè nan Espace Affilié li
 * (menm kalkil sèvè a: lib/affiliate-overview.ts). Pati anba a se enfo
 * admin sèlman ki gen rapò ak afilye a.
 */
type Line = { id: string; code: string; status: string; contract_start: string; contract_end: string };
interface Overview {
  affiliate: {
    fullname: string; code: string; referral_link: string; website_link: string; contract_start: string; contract_end: string;
    status: string; commission_amount: number; days_left: number;
    payout_method: string | null; payout_phone: string; payout_updated_at: string | null; signed_contract_uploaded_at: string | null;
  };
  commissions: Array<{
    id: string; amount: number; status: string; created_at: string; paid_at?: string | null;
    paid_amount_htg?: number | null; payout_method?: string | null;
    invoice_number: string; customer_code: string; customer_name: string;
  }>;
  totalDue: number; totalPaid: number; clientsCount: number;
  referredClients: Array<{
    id: string; fullname: string; customer_code: string; created_at: string;
    stage: "account_created" | "service_started" | "commission_added";
    commission_total: number; commission_count: number; account_status: string; phone: string;
  }>;
  admin: {
    id: string; email: string; phone: string; whatsapp: string; username: string; created_at: string;
    has_signed_contract: boolean;
    application: null | { fullname: string; email: string; phone: string; whatsapp: string; city: string; id_type: string; id_number: string; motivation: string; status: string; created_at: string };
    predecessor: Line | null; successors: Line[];
    last_login_at: string | null; active_sessions: number;
    events: Array<{ title: string; message: string; created_at: string }>;
  };
}

const STATUS: Record<string, { label: string; tone: string }> = {
  active: { label: "Actif", tone: "bg-emerald-100 text-emerald-700" },
  expired: { label: "Expiré", tone: "bg-mist text-mute" },
  revoked: { label: "Révoqué", tone: "bg-red-100 text-red-700" },
};

export default function AffiliateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let active = true;
    adminApi("affiliate_overview", { affiliate_id: id })
      .then((j) => { if (!active) return; if (j.ok) setData(j as Overview); else setError(j.reason || "Chargement impossible."); })
      .catch(() => { if (active) setError("Chargement impossible."); });
    return () => { active = false; };
  }, [id]);

  const openContract = async () => {
    setOpening(true);
    try {
      const j = await adminApi("affiliate_contract_url", { affiliate_id: id });
      if (j.ok) window.open(j.url, "_blank", "noopener"); else setError(j.reason);
    } finally { setOpening(false); }
  };

  if (error) return <Shell><p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p></Shell>;
  if (!data) return <Shell><div className="mt-6 flex items-center gap-2 text-sm text-mute"><Loader2 size={16} className="animate-spin" /> Chargement de l’espace de l’affilié…</div></Shell>;

  const { affiliate, admin, commissions, referredClients } = data;
  const status = STATUS[affiliate.status] ?? { label: affiliate.status, tone: "bg-mist text-mute" };
  const ended = affiliate.status === "active" && affiliate.contract_end < new Date().toISOString().slice(0, 10);

  return (
    <Shell>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-navy">{affiliate.fullname}</h1>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${status.tone}`}>{status.label}</span>
        <span className="rounded-lg bg-mist px-2 py-0.5 font-mono text-[12px] text-navy">{affiliate.code}</span>
      </div>
      {ended && <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800">Contrat terminé le {dateFr(affiliate.contract_end)} : ses clients ne génèrent plus de commission. Renouvelez-le depuis la liste des affiliés.</p>}

      {/* ── CE QUE VOIT L'AFFILIÉ ─────────────────────────────────────── */}
      <p className="mt-6 text-[11px] font-bold uppercase tracking-[.14em] text-accent">Ce que voit l’affilié dans son espace</p>
      <div className="mt-2 rounded-2xl bg-navy p-5 text-white">
        <p className="text-[11px] font-bold uppercase tracking-[.18em] text-white/50">Ses liens personnels</p>
        <p className="mt-2 text-[12px] text-white/70">Inscription directe</p>
        <code className="mt-1 block rounded-lg bg-white/10 px-3 py-2 text-[13px] break-all">{affiliate.referral_link}</code>
        <p className="mt-2 text-[12px] text-white/70">Site (informations)</p>
        <code className="mt-1 block rounded-lg bg-white/10 px-3 py-2 text-[13px] break-all">{affiliate.website_link}</code>
        <p className="mt-3 text-[12px] text-white/70">Contrat : {dateFr(affiliate.contract_start)} → {dateFr(affiliate.contract_end)} · {affiliate.days_left} jour{affiliate.days_left > 1 ? "s" : ""} restant{affiliate.days_left > 1 ? "s" : ""} · {usd(affiliate.commission_amount)} par facture</p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Stat icon={Users} label="Clients parrainés" value={String(data.clientsCount)} />
        <Stat icon={HandCoins} label="Commissions à venir" value={usd(data.totalDue)} sub={formatHtg(toPayoutHtg(data.totalDue))} tone="bg-amber-100 text-amber-700" />
        <Stat icon={CheckCircle2} label="Déjà payé" value={usd(data.totalPaid)} sub={formatHtg(toPayoutHtg(data.totalPaid))} tone="bg-emerald-100 text-emerald-700" />
      </div>

      <Card title="Clients inscrits avec son lien" icon={Users} count={referredClients.length}>
        {!referredClients.length && <Empty text="Aucun client inscrit avec ce lien." />}
        <div className="space-y-2">
          {referredClients.map((c) => {
            const stage = c.stage === "commission_added"
              ? { icon: BadgeDollarSign, label: `Commission ajoutée · ${usd(c.commission_total)}`, tone: "bg-emerald-100 text-emerald-700" }
              : c.stage === "service_started"
                ? { icon: PackageCheck, label: "Service commencé", tone: "bg-amber-100 text-amber-800" }
                : { icon: UserPlus, label: "Compte créé", tone: "bg-blue-50 text-blue-700" };
            const Icon = stage.icon;
            return (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-2.5">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${stage.tone}`}><Icon size={16} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-navy">
                    {c.customer_code ? <Link href={`/clients/${encodeURIComponent(c.customer_code)}`} className="hover:underline">{c.fullname}</Link> : c.fullname}
                  </p>
                  <p className="text-[12px] text-mute">{c.customer_code || "Compte en attente d’activation"} · {c.account_status || "—"} · inscrit le {dateFr(c.created_at)}{c.phone ? ` · ${c.phone}` : ""}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${stage.tone}`}>{stage.label}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Commissions" icon={HandCoins} count={commissions.length}>
        {!commissions.length ? <Empty text="Aucune commission pour le moment." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="text-left text-[11px] uppercase text-mute"><tr><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Facture</th><th className="py-2 pr-3">Client</th><th className="py-2 pr-3">Montant</th><th className="py-2">Statut</th></tr></thead>
              <tbody>
                {commissions.map((c) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className="py-2.5 pr-3 text-mute">{dateFr(c.created_at)}</td>
                    <td className="py-2.5 pr-3 font-semibold text-navy">{c.invoice_number || "—"}</td>
                    <td className="py-2.5 pr-3">{c.customer_name || "—"}{c.customer_code && <span className="block text-[11px] text-mute">{c.customer_code}</span>}</td>
                    <td className="py-2.5 pr-3 font-semibold text-navy">{usd(c.amount)}<span className="block text-[11px] font-normal text-mute">{formatHtg(c.status === "paid" && c.paid_amount_htg != null ? Number(c.paid_amount_htg) : toPayoutHtg(c.amount))}</span></td>
                    <td className="py-2.5">
                      {c.status === "paid"
                        ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700"><CheckCircle2 size={11} /> Payé{c.payout_method ? ` (${c.payout_method})` : ""}{c.paid_at ? ` le ${dateFr(c.paid_at)}` : ""}</span>
                        : <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700"><Clock3 size={11} /> À payer</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── ENFO ADMIN SÈLMAN ─────────────────────────────────────────── */}
      <p className="mt-8 text-[11px] font-bold uppercase tracking-[.14em] text-accent">Informations administratives</p>
      <div className="mt-2 grid gap-4 lg:grid-cols-2">
        <Card title="Identité et contact" icon={IdCard}>
          <Rows rows={[
            ["Identifiant", admin.username], ["Courriel", admin.email], ["Téléphone", admin.phone],
            ["WhatsApp", admin.whatsapp], ["Affilié depuis", dateFr(admin.created_at)],
            ["Ville", admin.application?.city ?? "—"],
            ["Pièce d’identité", admin.application ? `${admin.application.id_type} — ${admin.application.id_number}` : "—"],
          ]} />
          {admin.application?.motivation && <p className="mt-3 rounded-lg bg-mist px-3 py-2 text-[12.5px] italic text-mute">« {admin.application.motivation} »</p>}
          {admin.application && <p className="mt-2 text-[11px] text-mute">Candidature reçue le {dateFr(admin.application.created_at)}</p>}
        </Card>

        <Card title="Contrat signé et paiement" icon={FileSignature}>
          <div className="flex flex-wrap items-center gap-2">
            {admin.has_signed_contract ? (
              <>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Reçu le {dateFr(affiliate.signed_contract_uploaded_at)}</span>
                <button onClick={openContract} disabled={opening} className="inline-flex items-center gap-1.5 rounded-lg bg-mist px-2.5 py-1.5 text-[12px] font-bold text-navy hover:bg-accent-light disabled:opacity-60">
                  {opening ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />} Voir le contrat
                </button>
              </>
            ) : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">Contrat signé non reçu</span>}
          </div>
          <div className="mt-4 flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-100 text-emerald-600"><Wallet size={15} /></span>
            <p className="text-[13px] text-navy">{affiliate.payout_method ? <><b>{affiliate.payout_method}</b> · <span className="font-mono">{affiliate.payout_phone}</span>{affiliate.payout_updated_at && <span className="block text-[11px] text-mute">Modifié le {new Date(affiliate.payout_updated_at).toLocaleString("fr-CA")}</span>}</> : <span className="text-mute">Mode de paiement non choisi par l’affilié</span>}</p>
          </div>
        </Card>

        <Card title="Connexion à son espace" icon={LogIn}>
          <Rows rows={[
            ["Dernière connexion", admin.last_login_at ? new Date(admin.last_login_at).toLocaleString("fr-CA") : "Jamais connecté"],
            ["Sessions ouvertes", String(admin.active_sessions)],
          ]} />
          {affiliate.status !== "active" && <p className="mt-2 text-[12px] text-amber-700">Ce compte ne peut pas se connecter ({status.label.toLowerCase()}).</p>}
        </Card>

        <Card title="Modifications faites par l’affilié" icon={Bell} count={admin.events.length}>
          {!admin.events.length && <Empty text="Aucune modification pour le moment." />}
          <div className="space-y-2">
            {admin.events.map((e, i) => (
              <div key={i} className="rounded-xl border border-line px-3 py-2">
                <p className="text-[13px] font-semibold text-navy">{e.title}</p>
                <p className="text-[12px] text-mute">{e.message}</p>
                <p className="mt-0.5 text-[11px] text-mute">{new Date(e.created_at).toLocaleString("fr-CA")}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Historique du contrat" icon={History}>
          {!admin.predecessor && !admin.successors.length && <Empty text="Premier contrat, jamais renouvelé." />}
          {admin.predecessor && <LineRow label="Contrat précédent" line={admin.predecessor} />}
          {admin.successors.map((s) => <LineRow key={s.id} label="Renouvelé par" line={s} />)}
        </Card>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-5xl pb-10">
      <Link href="/affiliates" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-mute hover:text-navy"><ArrowLeft size={14} /> Retour aux affiliés</Link>
      <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-[12px] text-blue-800">Vue en lecture seule de l’espace de l’affilié. Les actions (réactiver, renouveler, mot de passe, paiements) se font depuis la liste des affiliés.</p>
      {children}
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, tone }: { icon: typeof Users; label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <span className={`grid h-9 w-9 place-items-center rounded-lg ${tone ?? "bg-accent-light text-accent"}`}><Icon size={17} /></span>
      <p className="mt-2 text-[20px] font-black text-navy">{value}</p>
      {sub && <p className="text-[12px] font-semibold text-navy/70">{sub}</p>}
      <p className="text-[12px] text-mute">{label}</p>
    </div>
  );
}

function Card({ title, icon: Icon, count, children }: { title: string; icon: typeof Users; count?: number; children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-2xl border border-line bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon size={17} className="text-accent" />
        <h2 className="text-[15px] font-bold text-navy">{title}</h2>
        {count !== undefined && <span className="rounded-full bg-mist px-2 py-0.5 text-[11px] font-bold text-mute">{count}</span>}
      </div>
      {children}
    </section>
  );
}

function Rows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
      {rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-mute">{k}</dt><dd className="break-all font-semibold text-navy">{v || "—"}</dd></div>)}
    </dl>
  );
}

function LineRow({ label, line }: { label: string; line: Line }) {
  const st = STATUS[line.status] ?? { label: line.status, tone: "bg-mist text-mute" };
  return (
    <Link href={`/affiliates/${line.id}`} className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 hover:bg-mist">
      <div><p className="text-[11px] text-mute">{label}</p><p className="font-mono text-[13px] font-bold text-navy">{line.code}</p></div>
      <div className="text-right text-[12px] text-mute">{dateFr(line.contract_start)} → {dateFr(line.contract_end)}<span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${st.tone}`}>{st.label}</span></div>
    </Link>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl bg-mist px-4 py-4 text-center text-[13px] text-mute">{text}</p>;
}
