"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeDollarSign, CheckCircle2, Clock3, Copy, HandCoins, LogOut, PackageCheck, Settings, UserPlus, Users } from "lucide-react";
import Logo from "@/components/Logo";
import { formatHtg, toPayoutHtg, type AffiliatePayoutMethod } from "@/lib/affiliate-terms";
import { ContractSection, PayoutSection, dateFr } from "@/components/affiliate/AffiliateAccountCards";

import { useNoticeToast } from "@/lib/notify";
import { MessageScreen } from "@/components/Toaster";
/**
 * PÒTAY AFILYE — tablo bò. Zewo enpòtasyon @/lib/db oswa @/lib/supabase:
 * tout done soti nan /api/affiliate-portal (cookie httpOnly, service role
 * kote sèvè a) — RLS pa ka idantifye yon afilye, donk pa gen lòt chemen.
 */
interface Me {
  affiliate: {
    fullname: string; code: string; referral_link: string; website_link: string; contract_start: string;
    contract_end: string; status: string; commission_amount: number; days_left: number;
    payout_method: AffiliatePayoutMethod | null; payout_phone: string; payout_updated_at: string | null;
    signed_contract_uploaded_at: string | null;
  };
  commissions: { id: string; amount: number; status: string; created_at: string; payout_method?: string | null; paid_amount_htg?: number | null }[];
  totalDue: number; totalPaid: number; clientsCount: number;
  referredClients: {
    id: string; fullname: string; customer_code: string; created_at: string;
    stage: "account_created" | "service_started" | "commission_added";
    commission_total: number; commission_count: number;
  }[];
}

/** % tan ki deja pase nan kontra 3 mwa a — pou ba pwogrè a. */
function contractProgress(startISO: string, endISO: string): number {
  const start = new Date(startISO).getTime(), end = new Date(endISO).getTime(), now = Date.now();
  if (!(end > start)) return 100;
  return Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
}

export default function AffiliatePortalPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"signup" | "website" | null>(null);
  const [justDone, setJustDone] = useState<string | null>(null);
  useNoticeToast(justDone, setJustDone, { tone: "success" });

  useEffect(() => {
    let active = true;
    const load = () => fetch("/api/affiliate-portal", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "me" })
    }).then((r) => r.json()).then((j) => {
      if (!active) return;
      if (!j.ok) { router.replace("/espace-affilie/login"); return; }
      setMe(j);
      setError(null);
    }).catch(() => { if (active) setError("Impossible de charger votre espace."); });
    void load();
    const refresh = window.setInterval(() => void load(), 30000);
    return () => { active = false; window.clearInterval(refresh); };
  }, [router]);

  const logout = async () => {
    await fetch("/api/affiliate-portal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    router.replace("/espace-affilie/login");
  };

  const copyLink = async (which: "signup" | "website") => {
    if (!me) return;
    const value = which === "signup" ? me.affiliate.referral_link : me.affiliate.website_link;
    try { await navigator.clipboard.writeText(value); setCopied(which); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ }
  };

  if (error) return <MessageScreen tone="error" title="Espace indisponible" text={error} fullPage />;

  if (!me) {
    return (
      <div className="min-h-screen bg-[#F4F6F9]">
        <div className="mx-auto max-w-4xl animate-pulse px-5 py-8 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-mist" />
            <div className="h-5 w-40 rounded bg-mist" />
          </div>
          <div className="mt-5 h-24 rounded-2xl bg-mist" />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-mist" />)}
          </div>
          <div className="mt-6 h-40 rounded-xl bg-mist" />
        </div>
      </div>
    );
  }

  const { affiliate, commissions, totalDue, totalPaid, clientsCount, referredClients } = me;
  const pct = contractProgress(affiliate.contract_start, affiliate.contract_end);
  const urgent = affiliate.status === "active" && affiliate.days_left <= 14;
  const needsContract = !affiliate.signed_contract_uploaded_at;
  const needsPayout = !affiliate.payout_method;

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={40} rounded="rounded-xl" />
            <div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-accent">Espace Affilié</p><h1 className="text-[20px] font-black text-navy">{affiliate.fullname}</h1></div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/espace-affilie/parametres" className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[13px] font-bold text-navy shadow-card hover:bg-mist">
              <Settings size={15} /> <span className="hidden sm:inline">Paramètres</span>
            </Link>
            <button onClick={logout} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[13px] font-bold text-navy shadow-card hover:bg-mist">
              <LogOut size={15} /> <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>

        {affiliate.status !== "active" && (
          <div className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
            Votre contrat n'est plus actif ({affiliate.status}). Contactez Standa Commercial pour un renouvellement.
          </div>
        )}
        {affiliate.status === "active" && affiliate.contract_end < new Date().toISOString().slice(0, 10) && (
          <div className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
            Votre contrat est terminé depuis le {dateFr(affiliate.contract_end)} : les nouvelles factures de vos clients ne génèrent plus de commission.
            Vos commissions déjà gagnées restent payables. Contactez Standa Commercial (+509 4673 8117) pour renouveler votre contrat.
          </div>
        )}

        <div className="mt-5 rounded-2xl bg-navy p-5 text-white">
          <p className="text-[11px] font-bold uppercase tracking-[.18em] text-white/50">Vos liens personnels</p>
          <ShareLink
            title="Lien d’inscription"
            hint="Ouvre directement la page où votre contact crée son compte client. À envoyer quand la personne est prête à s’inscrire."
            value={affiliate.referral_link} copied={copied === "signup"} onCopy={() => void copyLink("signup")}
          />
          <ShareLink
            title="Lien du site"
            hint="Pour une personne qui veut d’abord mieux connaître le service : le site explique tout. Si elle crée son compte ensuite depuis le site, sur le même téléphone et dans les 30 jours, elle vous est quand même rattachée."
            value={affiliate.website_link} copied={copied === "website"} onCopy={() => void copyLink("website")}
          />
          <p className="mt-3 text-[11.5px] leading-relaxed text-white/60">Important : partagez toujours un de ces deux liens. Une personne qui tape elle-même l’adresse du site, sans votre lien, ne peut pas vous être rattachée.</p>

          {affiliate.status === "active" && (
            <div className="mt-4">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                <div className={`h-full rounded-full ${urgent ? "bg-amber-400" : "bg-accent"}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[12px] text-white/60">
                <span>{dateFr(affiliate.contract_start)} → {dateFr(affiliate.contract_end)}</span>
                <span className={`inline-flex items-center gap-1 font-bold ${urgent ? "text-amber-300" : "text-white/80"}`}>
                  <Clock3 size={12} /> {affiliate.days_left} jour{affiliate.days_left > 1 ? "s" : ""} restant{affiliate.days_left > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat icon={Users} label="Clients parrainés" value={String(clientsCount)} />
          <Stat icon={HandCoins} label="Commissions à venir" value={`${totalDue.toFixed(2)} USD`} sub={`= ${formatHtg(toPayoutHtg(totalDue))}`} tone="amber" />
          <Stat icon={CheckCircle2} label="Déjà payé" value={`${totalPaid.toFixed(2)} USD`} sub={`= ${formatHtg(toPayoutHtg(totalPaid))}`} tone="emerald" />
        </div>

        {/* Etap ki poko fèt SÈLMAN. Depi yon etap fèt, kat li soti sou tablo bò a
            (li rete disponib nan Paramètres pou modifye l). */}
        {(needsContract || needsPayout) && (
          <div className="mt-5">
            <p className="text-[11px] font-bold uppercase tracking-[.14em] text-accent">À compléter</p>
            <div className={`mt-2 grid gap-4 ${needsContract && needsPayout ? "lg:grid-cols-2" : ""}`}>
              {needsContract && (
                <ContractSection
                  uploadedAt={affiliate.signed_contract_uploaded_at}
                  onUploaded={(at) => { setJustDone("Contrat signé reçu."); setMe((cur) => cur ? { ...cur, affiliate: { ...cur.affiliate, signed_contract_uploaded_at: at } } : cur); }}
                />
              )}
              {needsPayout && (
                <PayoutSection
                  method={affiliate.payout_method}
                  phone={affiliate.payout_phone}
                  updatedAt={affiliate.payout_updated_at}
                  onSaved={(payout_method, payout_phone, payout_updated_at) => { setJustDone("Mode de paiement enregistré."); setMe((cur) => cur ? { ...cur, affiliate: { ...cur.affiliate, payout_method, payout_phone, payout_updated_at } } : cur); }}
                />
              )}
            </div>
          </div>
        )}

        <section className="mt-6 rounded-2xl border border-line bg-white p-4 sm:p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.14em] text-accent">Vos références</p>
              <h2 className="mt-1 text-lg font-bold text-navy">Clients inscrits avec votre lien</h2>
            </div>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[12px] font-semibold text-blue-700">{clientsCount}</span>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-mute">Les nouveaux comptes apparaissent ici automatiquement. Cette liste se met à jour toutes les 30 secondes.</p>

          <div className="mt-4 space-y-2.5">
            {referredClients.map((client) => <ReferralClientRow key={client.id} client={client} />)}
            {!referredClients.length && <p className="rounded-xl bg-mist px-4 py-5 text-center text-[13px] text-mute">Aucun client n’est encore inscrit avec votre lien.</p>}
          </div>
        </section>

        <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-[13px]">
            <thead className="bg-mist text-left text-[11px] uppercase text-mute">
              <tr><th className="px-4 py-2.5">Date</th><th className="px-4 py-2.5">Montant</th><th className="px-4 py-2.5">Statut</th></tr>
            </thead>
            <tbody>
              {commissions.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-4 py-3 text-mute">{dateFr(c.created_at)}</td>
                  <td className="px-4 py-3 font-semibold text-navy">{c.amount.toFixed(2)} USD<span className="block text-[11px] font-normal text-mute">{formatHtg(c.status === "paid" && c.paid_amount_htg != null ? Number(c.paid_amount_htg) : toPayoutHtg(c.amount))}</span></td>
                  <td className="px-4 py-3">
                    {c.status === "paid"
                      ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700"><CheckCircle2 size={11} /> Payé{c.payout_method ? ` (${c.payout_method})` : ""}</span>
                      : <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700"><Clock3 size={11} /> En attente</span>}
                  </td>
                </tr>
              ))}
              {!commissions.length && (
                <tr><td colSpan={3} className="px-4 py-10 text-center">
                  <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-mist text-mute"><HandCoins size={19} /></span>
                  <p className="mt-2 text-mute">Aucune commission pour le moment — partagez votre lien !</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ReferralClientRow({ client }: { client: Me["referredClients"][number] }) {
  const status = client.stage === "commission_added"
    ? { icon: BadgeDollarSign, label: `Commission ajoutée · ${client.commission_total.toFixed(2)} USD`, tone: "bg-emerald-100 text-emerald-700", note: `${client.commission_count} utilisation${client.commission_count > 1 ? "s" : ""} confirmée${client.commission_count > 1 ? "s" : ""}` }
    : client.stage === "service_started"
      ? { icon: PackageCheck, label: "Service commencé", tone: "bg-amber-100 text-amber-800", note: "Premier colis détecté" }
      : { icon: UserPlus, label: "Compte créé", tone: "bg-blue-50 text-blue-700", note: "En attente du premier colis" };
  const Icon = status.icon;
  return <article className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3">
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${status.tone}`}><Icon size={18} /></span>
    <div className="min-w-0 flex-1">
      <p className="truncate text-[14px] font-semibold text-navy">{client.fullname}</p>
      <p className="mt-0.5 text-[12px] text-mute">{client.customer_code || "Compte en cours d’activation"} · Inscrit le {dateFr(client.created_at)}</p>
    </div>
    <div className="max-w-[130px] text-right">
      <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${status.tone}`}>{status.label}</span>
      <p className="mt-1 text-[10px] text-mute">{status.note}</p>
    </div>
  </article>;
}

function Stat({ icon: Icon, label, value, sub, tone }: { icon: typeof Users; label: string; value: string; sub?: string; tone?: "amber" | "emerald" }) {
  const tones: Record<string, string> = { amber: "text-amber-600 bg-amber-100", emerald: "text-emerald-600 bg-emerald-100" };
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <span className={`grid h-9 w-9 place-items-center rounded-lg ${tone ? tones[tone] : "bg-accent-light text-accent"}`}><Icon size={17} /></span>
      <p className="mt-2 text-[20px] font-black text-navy">{value}</p>
      {sub && <p className="text-[12px] font-semibold text-navy/70">{sub}</p>}
      <p className="text-[12px] text-mute">{label}</p>
    </div>
  );
}

function ShareLink({ title, hint, value, copied, onCopy }: { title: string; hint: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="mt-3 rounded-xl bg-white/[.06] p-3">
      <p className="text-[13px] font-bold">{title}</p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-white/65">{hint}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="rounded-lg bg-white/10 px-3 py-2 text-[12.5px] break-all">{value}</code>
        <button onClick={onCopy} className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-[12px] font-bold hover:bg-white/25">
          {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />} {copied ? "Copié" : "Copier"}
        </button>
      </div>
    </div>
  );
}
