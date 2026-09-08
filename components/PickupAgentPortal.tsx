"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2, ChevronDown, ClipboardCheck, LogOut, PackageCheck,
  RefreshCw, Search, ShieldCheck, Truck, X
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type PickupPackage = {
  id: string;
  tracking_number: string;
  tracking_manual: string;
  customer_code: string;
  quantity: number;
  content: string;
  created_date: string;
  status: "Disponible";
};

type PortalData = {
  agent: { name: string; username: string };
  zone: { name: string };
  packages: PickupPackage[];
};

function quantityTotal(items: PickupPackage[]) {
  return items.reduce((total, item) => total + (Number(item.quantity) || 1), 0);
}

/**
 * Interface volontairement courte: utilisable avec une main sur téléphone,
 * confortable en deux colonnes sur tablette et laptop, et sans donnée privée.
 */
export default function PickupAgentPortal() {
  const router = useRouter();
  const [data, setData] = useState<PortalData | null>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [releasing, setReleasing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { router.replace("/point-retrait"); return; }
      const response = await fetch("/api/pickup-agent", { headers: { Authorization: `Bearer ${token}` } });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.reason || "Chargement impossible.");
      setData(json as PortalData);
    } catch (error) {
      setData(null);
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Chargement impossible." });
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const map = new Map<string, PickupPackage[]>();
    for (const parcel of data?.packages ?? []) {
      const searchable = [parcel.customer_code, parcel.tracking_number, parcel.tracking_manual, parcel.content].join(" ").toLowerCase();
      if (term && !searchable.includes(term)) continue;
      const current = map.get(parcel.customer_code) ?? [];
      current.push(parcel);
      map.set(parcel.customer_code, current);
    }
    return Array.from(map, ([customerCode, packages]) => ({ customerCode, packages }));
  }, [data?.packages, search]);

  const release = async (parcel: PickupPackage) => {
    if (!confirm(`Konfime remis koli ${parcel.tracking_manual || parcel.tracking_number} pou kliyan ${parcel.customer_code}?`)) return;
    setReleasing(parcel.id); setMessage(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { router.replace("/point-retrait"); return; }
      const response = await fetch("/api/pickup-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "release", package_id: parcel.id })
      });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.reason || "Remise impossible.");
      setData((current) => current ? {
        ...current,
        packages: current.packages.filter((item) => item.id !== parcel.id)
      } : current);
      setMessage({ type: "ok", text: `Koli ${parcel.tracking_manual || parcel.tracking_number} make kòm remis.` });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Remise impossible." });
    } finally {
      setReleasing(null);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/point-retrait");
  };

  const totalQuantity = quantityTotal(data?.packages ?? []);

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <header className="bg-gradient-to-r from-[#071b43] via-[#0d3270] to-[#154b91] text-white shadow-lg">
        <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20"><PackageCheck size={24} /></div>
            <div className="min-w-0"><p className="text-lg font-black tracking-tight">STANDA</p><p className="text-[10px] font-semibold tracking-[0.18em] text-white/70">POINT DE RETRAIT</p></div>
          </div>
          <button onClick={logout} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-white/90 hover:bg-white/10" aria-label="Se déconnecter">
            <LogOut size={18} /><span className="hidden sm:inline">Déconnecter</span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-5 pb-10 sm:px-6 sm:py-8">
        {loading && <div className="grid min-h-[45vh] place-items-center"><div className="text-center"><RefreshCw className="mx-auto mb-3 animate-spin text-[#0d3b7a]" size={30} /><p className="text-sm text-slate-500">Chargement des colis disponibles…</p></div></div>}

        {!loading && !data && <section className="mx-auto max-w-xl rounded-3xl border border-red-100 bg-white p-7 text-center shadow-sm"><ShieldCheck className="mx-auto mb-3 text-red-500" size={36} /><h1 className="text-xl font-extrabold text-[#0a2b61]">Accès à vérifier</h1><p className="mt-2 text-sm text-slate-600">{message?.text || "Impossible de préparer votre espace."}</p><button className="btn mt-5" onClick={() => void load()}>Réessayer</button></section>}

        {!loading && data && <>
          <section className="mb-5 rounded-3xl border border-white/70 bg-white p-5 shadow-[0_10px_35px_rgba(17,54,110,0.08)] sm:p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#e85e19]">Espace de remise sécurisé</p><h1 className="mt-1 text-2xl font-black tracking-tight text-[#09295e] sm:text-3xl">Bonjou, {data.agent.name}</h1><p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500"><Truck size={15} className="text-[#e85e19]" /> Zone: <b className="text-slate-700">{data.zone.name}</b></p></div>
              <button onClick={() => void load()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-[#103a78] hover:bg-slate-50"><RefreshCw size={17} />Actualiser</button>
            </div>
          </section>

          <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat icon={<PackageCheck size={20} />} label="Colis disponibles" value={data.packages.length} tint="bg-blue-50 text-[#0d3b7a]" />
            <Stat icon={<ClipboardCheck size={20} />} label="Clients à servir" value={new Set(data.packages.map((p) => p.customer_code)).size} tint="bg-emerald-50 text-emerald-700" />
            <Stat icon={<Truck size={20} />} label="Quantité totale" value={totalQuantity} tint="bg-orange-50 text-[#e85e19]" />
          </section>

          <section className="rounded-3xl border border-white bg-white p-4 shadow-[0_10px_35px_rgba(17,54,110,0.07)] sm:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-extrabold text-[#0a2b61]">Colis à remettre</h2><p className="text-xs text-slate-500">Vérifiez le code client et le tracking avant de confirmer la remise.</p></div><label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 sm:w-80"><Search size={17} className="text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Code client ou tracking" /></label></div>

            {message && <div className={`mb-4 flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${message.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}><span>{message.text}</span><button onClick={() => setMessage(null)} aria-label="Fermer"><X size={17} /></button></div>}

            {groups.length === 0 ? <div className="py-12 text-center"><CheckCircle2 className="mx-auto mb-3 text-emerald-500" size={38} /><p className="font-bold text-[#0a2b61]">{search ? "Aucun colis ne correspond à la recherche." : "Aucun colis disponible dans votre zone."}</p><p className="mt-1 text-sm text-slate-500">{search ? "Essayez un autre code ou numéro de tracking." : "Actualisez plus tard si une réception arrive."}</p></div> : <div className="grid gap-4 lg:grid-cols-2">{groups.map((group) => {
              const isOpen = expanded === group.customerCode;
              return <article key={group.customerCode} className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><button className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-slate-50" onClick={() => setExpanded(isOpen ? null : group.customerCode)}><div><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Code client</p><p className="mt-0.5 text-xl font-black tracking-tight text-[#0a2b61]">{group.customerCode}</p><p className="mt-1 text-sm font-semibold text-slate-600">{group.packages.length} colis · {quantityTotal(group.packages)} article{quantityTotal(group.packages) > 1 ? "s" : ""}</p></div><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#edf3ff] text-[#0c397a]"><ChevronDown size={20} className={isOpen ? "rotate-180 transition-transform" : "transition-transform"} /></span></button>{isOpen && <div className="space-y-3 border-t border-slate-100 bg-slate-50/70 p-3">{group.packages.map((parcel) => <div key={parcel.id} className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Tracking</p><p className="break-all text-sm font-extrabold text-[#0a2b61]">{parcel.tracking_manual || parcel.tracking_number}</p></div><span className="rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-bold text-[#cf4b0d]">Qté: {parcel.quantity}</span></div>{parcel.content && <p className="mt-2 text-sm text-slate-600"><span className="font-semibold text-slate-800">Marchandise:</span> {parcel.content}</p>}<button onClick={() => void release(parcel)} disabled={releasing === parcel.id} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0b3270] px-3 text-sm font-bold text-white transition hover:bg-[#0f448f] disabled:opacity-60"><CheckCircle2 size={18} />{releasing === parcel.id ? "Confirmation…" : "Confirmer la remise"}</button></div>)}</div>}</article>;
            })}</div>}
          </section>
        </>}
      </div>
    </div>
  );
}

function Stat({ icon, label, value, tint }: { icon: React.ReactNode; label: string; value: number; tint: string }) {
  return <div className="rounded-2xl border border-white bg-white p-4 shadow-sm"><div className={`mb-3 grid h-10 w-10 place-items-center rounded-xl ${tint}`}>{icon}</div><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-0.5 text-2xl font-black text-[#09295e]">{value}</p></div>;
}
