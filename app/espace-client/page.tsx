"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, Clock, FileText, KeyRound, LogOut, MapPin, Package, Truck, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { createRetrait, getClientByAuthId, getClientPackagesAndInvoices, getClientRetraits } from "@/lib/db";
import { Client, Invoice, Pkg, Retrait } from "@/lib/types";
import { DEPOT } from "@/lib/depot";
import { dateFr, usd } from "@/lib/utils";
import StatusBadge from "@/components/StatusBadge";
import RefreshButton from "@/components/RefreshButton";
import { StatusTimeline } from "@/components/StatusFlow";

export default function EspaceClientPage() {
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [invs, setInvs] = useState<Invoice[]>([]);
  const [retraits, setRetraits] = useState<Retrait[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) { router.replace("/login"); return; }
    const c = await getClientByAuthId(data.user.id);
    setClient(c);
    if (c?.customer_code) {
      const [{ pkgs: p, invs: i }, rs] = await Promise.all([
        getClientPackagesAndInvoices(c.customer_code),
        getClientRetraits(c.customer_code)
      ]);
      setPkgs(p); setInvs(i); setRetraits(rs);
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [router]);

  const logout = async () => { await supabase.auth.signOut(); router.replace("/login"); };

  // ===== Changer mon mot de passe (V8.5 §13) =====
  const [showPwd, setShowPwd] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwd1, setPwd1] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [pwdBusy, setPwdBusy] = useState(false);

  const changePassword = async () => {
    setPwdMsg(null);
    if (pwd1.length < 6) { setPwdMsg("Modpas la dwe gen omwen 6 karaktè."); return; }
    if (pwd1 !== pwd2) { setPwdMsg("De modpas yo pa menm."); return; }
    setPwdBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd1 });
      if (error) throw error;
      setPwdMsg("✅ Modpas ou chanje avèk siksè.");
      setPwd1(""); setPwd2("");
      setTimeout(() => { setShowPwd(false); setPwdMsg(null); }, 1500);
    } catch (e: any) { setPwdMsg("Erè: " + (e.message ?? String(e))); }
    finally { setPwdBusy(false); }
  };

  const toggleSel = (id: string) =>
    setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  /** "Notifier mon retrait" — di STANDA davans ki koli w ap vin pran (pa chanje statut koli yo) */
  const notifierRetrait = async () => {
    if (!client || !sel.size) return;
    setBusy(true);
    try {
      const chosen = pkgs.filter((p) => sel.has(p.id));
      await createRetrait(client, chosen);
      setRetraits(await getClientRetraits(client.customer_code));
      setSel(new Set());
      setMsg(`Demann ou an voye (${chosen.length} koli). STANDA COMMERCIAL ap prepare yo — w ap wè estati a anba a.`);
    } catch (e: any) {
      setMsg("Erè: " + (e.message ?? String(e)));
    } finally { setBusy(false); }
  };

  const RETRAIT_BADGE: Record<string, string> = {
    "En attente": "bg-amber-100 text-amber-700",
    "Préparé": "bg-blue-100 text-blue-700",
    "Remis": "bg-emerald-100 text-emerald-700"
  };

  if (loading) return <div className="min-h-screen bg-mist grid place-items-center text-slate-400">Ap chaje...</div>;

  if (!client) return (
    <div className="min-h-screen bg-mist grid place-items-center p-6">
      <div className="card p-8 max-w-md text-center space-y-4">
        <p className="text-sm text-slate-600">Nou pa jwenn pwofil ou. Kontakte STANDA COMMERCIAL.</p>
        <button className="btn justify-center w-full" onClick={logout}>Dekonekte</button>
      </div>
    </div>
  );

  const non = [client.fullname, client.surname].filter(Boolean).join(" ");

  // ===== En attente d'activation =====
  if (client.account_status !== "Actif" || !client.customer_code) {
    return (
      <div className="min-h-screen bg-mist grid place-items-center p-6">
        <div className="card p-8 max-w-md w-full text-center space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="mx-auto h-14 object-contain" />
          <Clock className="mx-auto text-amber-500" size={44} />
          <h1 className="text-lg font-extrabold text-navy">Kont ou an attente d&apos;activation</h1>
          <p className="text-sm text-slate-600">
            Bonjou {non} — ekip STANDA COMMERCIAL ap verifye enfòmasyon ou yo.
            Lè kont ou aktive, w ap resevwa adrès depo ou Ozetazini sou WhatsApp
            epi w ap ka itilize tout sèvis shipping yo.
          </p>
          <button className="btn btn-ghost justify-center w-full" onClick={logout}>
            <LogOut size={15} /> Dekonekte
          </button>
        </div>
      </div>
    );
  }

  // ===== Kont Actif =====
  const disponibles = pkgs.filter((p) => p.status === "Disponible");
  const enTransit = pkgs.filter((p) => !["Disponible", "Facturé", "Livré"].includes(p.status));
  const stats = [
    { label: "Total colis", value: pkgs.length, icon: Package, tint: "bg-blue-50 text-blue-600" },
    { label: "Disponibles", value: disponibles.length, icon: Bell, tint: "bg-brand-light text-brand-dark" },
    { label: "En transit", value: enTransit.length, icon: Truck, tint: "bg-amber-50 text-amber-600" },
    { label: "Factures", value: invs.length, icon: FileText, tint: "bg-indigo-50 text-indigo-600" }
  ];

  return (
    <div className="min-h-screen bg-mist pb-10">
      {/* ===== Header ===== */}
      <header className="bg-navy text-white sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white grid place-items-center overflow-hidden shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" className="h-8 object-contain" />
            </div>
            <div className="min-w-0">
              <p className="font-extrabold text-sm leading-tight truncate">STANDA COMMERCIAL</p>
              <p className="text-[11px] text-white/60 truncate">{non} · {client.customer_code}</p>
            </div>
          </div>
          <div className="relative">
            <button className="flex items-center gap-1.5 text-white/85 hover:text-white text-sm rounded-lg px-2 py-1.5 hover:bg-white/10"
              onClick={() => setMenuOpen((v) => !v)}>
              <div className="w-7 h-7 rounded-full bg-white/15 grid place-items-center text-xs font-bold">
                {non.slice(0, 1).toUpperCase()}
              </div>
              <ChevronDown size={15} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-lift border border-line py-1 z-20 text-ink">
                  <button className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-mist text-left"
                    onClick={() => { setMenuOpen(false); setShowPwd(true); }}>
                    <KeyRound size={15} className="text-mute" /> Changer mon mot de passe
                  </button>
                  <button className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-mist text-left text-red-600"
                    onClick={logout}>
                    <LogOut size={15} /> Dekonekte
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ===== Modal: Changer mot de passe ===== */}
      {showPwd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowPwd(false)}>
          <div className="card p-6 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="h-sec">Changer mon mot de passe</h2>
              <button className="text-slate-400 hover:text-navy" onClick={() => setShowPwd(false)}><X size={18} /></button>
            </div>
            <label className="block">
              <span className="text-xs font-semibold text-mute">Nouveau mot de passe</span>
              <input type="password" className="input mt-1" value={pwd1} onChange={(e) => setPwd1(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-mute">Confirmer le mot de passe</span>
              <input type="password" className="input mt-1" value={pwd2}
                onChange={(e) => setPwd2(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && changePassword()} />
            </label>
            {pwdMsg && <p className={`text-sm rounded-lg px-3 py-2 ${pwdMsg.startsWith("✅")
              ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
              : "text-red-600 bg-red-50 border border-red-200"}`}>{pwdMsg}</p>}
            <button className="btn w-full justify-center" onClick={changePassword} disabled={pwdBusy}>
              {pwdBusy ? "Ap chanje..." : "Enregistrer"}
            </button>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-5">
        {/* ===== Salutation ===== */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="h-page">Bonjou, {client.fullname || non} 👋</h1>
            <p className="text-sm text-mute mt-0.5">Men rezime kont ou an.</p>
          </div>
          <RefreshButton onRefresh={load} />
        </div>

        {/* ===== KPI (istwa a) ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map(({ label, value, icon: Icon, tint }) => (
            <div key={label} className="stat">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-1 ${tint}`}>
                <Icon size={18} />
              </div>
              <p className="stat-label">{label}</p>
              <p className="stat-value">{value}</p>
            </div>
          ))}
        </div>

        {/* ===== Adrès depo ===== */}
        <section className="card p-5 md:p-6">
          <h2 className="h-sec flex items-center gap-2 mb-4">
            <MapPin size={16} className="text-navy" /> Adrès depo ou Ozetazini
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0.5 text-sm">
            {([["Full Name / Nombre completo", non],
               ["Address 1", DEPOT.address1],
               ["Address 2", client.customer_code],
               ["City", DEPOT.city],
               ["State", DEPOT.state],
               ["ZIP Code", DEPOT.zip],
               ["Phone", DEPOT.phone]] as const).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-line py-2">
                <span className="text-mute">{k}</span>
                <span className={`font-semibold text-right ${k === "Address 2" ? "text-navy" : "text-ink"}`}>{v}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            ⚠️ Toujou mete kòd <b>{client.customer_code}</b> la sou <b>Address 2</b> chak fwa w ap voye
            yon pakè — se kòd sa a ki pèmèt nou idantifye tout koli ou yo.
          </p>
        </section>

        {/* ===== Koli (kat responsive) ===== */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="h-sec flex items-center gap-2">
              <Package size={16} className="text-navy" /> Koli ou yo <span className="text-mute font-normal">({pkgs.length})</span>
            </h2>
          </div>
          {disponibles.length > 0 && (
            <p className="text-xs text-mute">
              Make koli <b className="text-brand-dark">Disponible</b> yo epi peze &quot;Notifier mon retrait&quot; pou n prepare yo anvan ou rive.
            </p>
          )}

          {pkgs.length === 0 ? (
            <div className="card p-8 text-center text-mute text-sm">Poko gen koli.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {pkgs.map((p) => {
                const selectable = p.status === "Disponible";
                const on = sel.has(p.id);
                return (
                  <div key={p.id}
                    className={`card p-4 card-hover ${on ? "ring-2 ring-navy/30" : ""} ${selectable ? "cursor-pointer" : ""}`}
                    onClick={() => selectable && toggleSel(p.id)}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-bold text-ink truncate">{p.tracking_number}</p>
                        {p.tracking_manual && <p className="font-mono text-[11px] text-mute truncate mt-0.5">{p.tracking_manual}</p>}
                      </div>
                      {selectable && (
                        <input type="checkbox" checked={on} onChange={() => toggleSel(p.id)}
                          onClick={(e) => e.stopPropagation()} className="mt-0.5 shrink-0 w-4 h-4" />
                      )}
                    </div>
                    <div className="my-2.5">
                      <StatusTimeline status={p.status} compact />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge status={p.status} />
                      <span className="text-xs text-mute">{Number(p.weight || 0).toFixed(2)} lb</span>
                    </div>
                    {p.content && <p className="text-xs text-mute mt-2 truncate">{p.content}</p>}
                  </div>
                );
              })}
            </div>
          )}

          {sel.size > 0 && (
            <div className="sticky bottom-4 z-20">
              <div className="card shadow-lift p-3 flex items-center gap-3 flex-wrap">
                <button className="btn btn-brand" onClick={notifierRetrait} disabled={busy}>
                  <Bell size={15} /> Notifier mon retrait ({sel.size})
                </button>
                <span className="text-xs text-mute flex-1">STANDA ap prepare koli yo anvan ou rive.</span>
              </div>
            </div>
          )}
          {msg && <p className="card px-4 py-3 text-sm text-navy">{msg}</p>}
        </section>

        {/* ===== Demandes de retrait ===== */}
        {retraits.length > 0 && (
          <section className="space-y-3">
            <h2 className="h-sec">Demandes de retrait <span className="text-mute font-normal">({retraits.length})</span></h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {retraits.map((r) => (
                <div key={r.id} className="card p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ink">{r.package_count} colis · {Number(r.total_weight).toFixed(2)} lb</p>
                    <p className="text-xs text-mute mt-0.5">{new Date(r.created_at).toLocaleDateString("fr-FR")}</p>
                  </div>
                  <span className={`pill ${r.status === "Remis" ? "pill-green" : r.status === "Préparé" ? "pill-blue" : "pill-amber"}`}>
                    <span className="pill-dot" /> {r.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ===== Factures ===== */}
        <section className="space-y-3">
          <h2 className="h-sec flex items-center gap-2">
            <FileText size={16} className="text-navy" /> Fakti ou yo <span className="text-mute font-normal">({invs.length})</span>
          </h2>
          {invs.length === 0 ? (
            <div className="card p-8 text-center text-mute text-sm">Poko gen fakti.</div>
          ) : (
            <div className="card divide-y divide-line">
              {invs.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-navy">{f.invoice_number}</p>
                    <p className="text-xs text-mute mt-0.5">{dateFr(f.created_at)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-extrabold text-ink">{usd(f.grand_total)}</p>
                    {f.pdf_url
                      ? <a href={f.pdf_url} target="_blank" rel="noreferrer" className="text-xs text-navy underline font-semibold">Telechaje PDF</a>
                      : <span className="text-xs text-slate-400">—</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
