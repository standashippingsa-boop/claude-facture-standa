"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Bell, BellRing, CheckCheck, LoaderCircle, ReceiptText, Truck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type StaffNotification = {
  id: string;
  kind: "agency_payment" | "bon_remise_created";
  title: string;
  message: string;
  href: string;
  created_at: string;
  read_at: string | null;
};
type Variant = "sidebar" | "icon" | "section";

const formatDate = (value: string) => new Intl.DateTimeFormat("fr-CA", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
}).format(new Date(value));

export default function StaffNotifications({ variant = "icon" }: { variant?: Variant }) {
  const router = useRouter();
  const [items, setItems] = useState<StaffNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) { setItems([]); return; }
      const response = await fetch("/api/staff-notifications?limit=30", {
        cache: "no-store", headers: { Authorization: `Bearer ${token}` }
      });
      const json = await response.json().catch(() => null);
      if (response.ok && json?.ok && Array.isArray(json.notifications)) setItems(json.notifications as StaffNotification[]);
    } catch {
      // Une indisponibilité temporaire ne doit jamais casser l'écran de
      // l'agent ou de l'administration. Le prochain rafraîchissement réessaie.
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => { if (document.visibilityState === "visible") void load(true); };
    const timer = window.setInterval(refresh, 15_000);
    window.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("visibilitychange", refresh); window.removeEventListener("focus", refresh); };
  }, [load]);

  const unread = items.filter((item) => !item.read_at);
  const markRead = useCallback(async (ids?: string[]) => {
    if (!items.length) return;
    setUpdating(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) return;
      const response = await fetch("/api/staff-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(ids?.length ? { action: "mark_read", ids } : { action: "mark_all_read" })
      });
      if (!response.ok) return;
      const now = new Date().toISOString();
      setItems((current) => current.map((item) => !ids || ids.includes(item.id) ? { ...item, read_at: now } : item));
    } finally { setUpdating(false); }
  }, [items.length]);

  const openNotification = async (item: StaffNotification) => {
    if (!item.read_at) await markRead([item.id]);
    setOpen(false);
    if (item.href) router.push(item.href);
  };

  const Icon = ({ kind }: { kind: StaffNotification["kind"] }) => kind === "agency_payment"
    ? <ReceiptText size={17} /> : <Truck size={17} />;

  if (variant === "section") {
    if (!loading && !unread.length) return null;
    return <section className="card overflow-hidden border border-blue-100">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2"><BellRing size={17} className="text-brand" /><div><h2 className="h-sec">Notifications d&apos;opérations</h2><p className="mt-0.5 text-xs text-mute">Paiements reçus en agence et Bons de remise à traiter.</p></div></div>
        {unread.length > 0 && <button type="button" disabled={updating} onClick={() => void markRead()} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 text-xs font-bold text-navy hover:bg-slate-50 disabled:opacity-50"><CheckCheck size={15} />Tout lire</button>}
      </div>
      {loading ? <div className="grid min-h-24 place-items-center"><LoaderCircle size={20} className="animate-spin text-slate-400" /></div> : <div className="divide-y divide-line">{unread.slice(0, 6).map((item) => <NotificationRow key={item.id} item={item} icon={<Icon kind={item.kind} />} onOpen={openNotification} />)}</div>}
    </section>;
  }

  const trigger = variant === "sidebar"
    ? <><Bell size={17} /><span className="flex-1 text-left text-sm font-semibold">Notifications</span></>
    : <Bell size={20} />;
  const triggerClass = variant === "sidebar"
    ? "flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-white/85 transition hover:bg-white/10 hover:text-white"
    : "relative grid h-10 w-10 place-items-center rounded-xl text-white/90 transition hover:bg-white/10 hover:text-white";
  return <div className="relative">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-label="Notifications" aria-expanded={open} className={triggerClass}>
      {trigger}{unread.length > 0 && <span className={variant === "sidebar" ? "grid h-5 min-w-5 place-items-center rounded-full bg-orange-500 px-1 text-[10px] font-black text-white" : "absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-orange-500 px-1 text-[9px] font-black text-white"}>{unread.length > 9 ? "9+" : unread.length}</span>}
    </button>
    {open && <div className={variant === "sidebar" ? "absolute left-0 top-11 z-[90] w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl" : "absolute right-0 top-11 z-[90] w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl"}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3"><div><p className="text-sm font-black text-navy">Notifications</p><p className="text-xs text-slate-500">{unread.length ? `${unread.length} non lue${unread.length > 1 ? "s" : ""}` : "Tout est à jour"}</p></div><div className="flex items-center gap-1">{unread.length > 0 && <button type="button" disabled={updating} onClick={() => void markRead()} title="Tout marquer comme lu" className="rounded-lg p-2 text-navy hover:bg-slate-100 disabled:opacity-50"><CheckCheck size={17} /></button>}<button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={17} /></button></div></div>
      <div className="max-h-[min(65vh,32rem)] overflow-y-auto">{loading ? <div className="grid min-h-28 place-items-center"><LoaderCircle size={20} className="animate-spin text-slate-400" /></div> : items.length ? items.map((item) => <NotificationRow key={item.id} item={item} icon={<Icon kind={item.kind} />} onOpen={openNotification} />) : <p className="px-4 py-8 text-center text-sm text-slate-500">Aucune notification pour le moment.</p>}</div>
    </div>}
  </div>;
}

function NotificationRow({ item, icon, onOpen }: { item: StaffNotification; icon: ReactNode; onOpen: (item: StaffNotification) => void }) {
  return <button type="button" onClick={() => void onOpen(item)} className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${item.read_at ? "opacity-70" : "bg-blue-50/35"}`}>
    <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${item.kind === "agency_payment" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>{icon}</span>
    <span className="min-w-0 flex-1"><span className="flex items-start gap-2"><b className="flex-1 text-sm text-navy">{item.title}</b>{!item.read_at && <i className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange-500" />}</span><small className="mt-0.5 block text-xs leading-relaxed text-slate-600">{item.message}</small><small className="mt-1 block text-[11px] font-medium text-slate-400">{formatDate(item.created_at)}</small></span>
  </button>;
}
