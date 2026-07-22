"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Clock, KeyRound, LogOut, MapPin, Package, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { createRetrait, getClientByAuthId, getClientPackagesAndInvoices, getClientRetraits } from "@/lib/db";
import { Client, Invoice, Pkg, Retrait } from "@/lib/types";
import { DEPOT } from "@/lib/depot";
import { dateFr, usd } from "@/lib/utils";

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

  useEffect(() => {
    (async () => {
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
    })();
  }, [router]);

  const logout = async () => { await supabase.auth.signOut(); router.replace("/login"); };

  // ===== Changer mon mot de passe (V8.5 §13) =====
  const [showPwd, setShowPwd] = useState(false);
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
  return (
    <div className="min-h-screen bg-mist">
      <div className="bg-navy text-white">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white grid place-items-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" className="h-8 object-contain" />
            </div>
            <div>
              <p className="font-extrabold text-sm">STANDA COMMERCIAL</p>
              <p className="text-xs text-white/70">{non} — {client.customer_code}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="text-white/80 hover:text-white text-sm flex items-center gap-1"
              onClick={() => setShowPwd(true)}>
              <KeyRound size={15} /> Changer mon mot de passe
            </button>
            <button className="text-white/80 hover:text-white text-sm flex items-center gap-1" onClick={logout}>
              <LogOut size={15} /> Dekonekte
            </button>
          </div>
        </div>
      </div>

      {/* ===== Modal: Changer mon mot de passe ===== */}
      {showPwd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowPwd(false)}>
          <div className="card p-6 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-navy uppercase tracking-wide">Changer mon mot de passe</h2>
              <button className="text-slate-400 hover:text-navy" onClick={() => setShowPwd(false)}><X size={18} /></button>
            </div>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Nouveau mot de passe</span>
              <input type="password" className="input mt-1" value={pwd1} onChange={(e) => setPwd1(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Confirmer le mot de passe</span>
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
            <p className="text-[11px] text-slate-400 text-center">
              Si w bliye modpas ou, kontakte STANDA COMMERCIAL — administratè a ap jenere yon nouvo pou ou.
            </p>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-5">
        {/* Adrès depo */}
        <section className="card p-6">
          <h2 className="text-sm font-bold text-navy uppercase tracking-wide flex items-center gap-2 mb-4">
            <MapPin size={15} /> Adrès depo ou Ozetazini
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {([["Full Name / Nombre completo", non],
               ["Address 1", DEPOT.address1],
               ["Address 2", client.customer_code],
               ["City", DEPOT.city],
               ["State", DEPOT.state],
               ["ZIP Code", DEPOT.zip],
               ["Phone", DEPOT.phone]] as const).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-line py-1.5">
                <span className="text-slate-500">{k}</span>
                <span className={`font-semibold text-right ${k === "Address 2" ? "text-navy" : ""}`}>{v}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ⚠️ Toujou mete kòd <b>{client.customer_code}</b> la sou <b>Address 2</b> chak fwa w ap voye
            yon pakè — se kòd sa a ki pèmèt nou idantifye tout koli ou yo.
          </p>
        </section>

        {/* Koli */}
        <section className="card overflow-x-auto">
          <h2 className="text-sm font-bold text-navy uppercase tracking-wide flex items-center gap-2 p-4 pb-2">
            <Package size={15} /> Koli ou yo ({pkgs.length})
          </h2>
          <p className="px-4 pb-2 text-xs text-slate-500">
            Make koli ki <b>Disponible</b> yo epi peze "Notifier mon retrait" pou n prepare yo anvan ou rive.
          </p>
          <table className="w-full text-sm">
            <thead><tr>
              <th className="th"></th>
              {["Tracking ID (Guía)", "Tracking No", "Date", "Weight (lb)", "Content", "Status"].map((h) => <th key={h} className="th">{h}</th>)}
            </tr></thead>
            <tbody>
              {pkgs.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">Poko gen koli.</td></tr>
              ) : pkgs.map((p, i) => (
                <tr key={p.id} className={`${i % 2 ? "bg-mist" : ""} ${sel.has(p.id) ? "!bg-blue-50" : ""}`}>
                  <td className="td">
                    {p.status === "Disponible" && (
                      <input type="checkbox" checked={sel.has(p.id)} onChange={() => toggleSel(p.id)} />
                    )}
                  </td>
                  <td className="td font-mono text-xs">{p.tracking_number}</td>
                  <td className="td font-mono text-xs">{p.tracking_manual || "—"}</td>
                  <td className="td">{p.created_date}</td>
                  <td className="td">{p.weight}</td>
                  <td className="td">{p.content}</td>
                  <td className="td">
                    <span className={`badge ${p.status === "Disponible" ? "bg-emerald-100 text-emerald-700"
                      : p.status === "Facturé" || p.status === "Livré" ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600"}`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sel.size > 0 && (
            <div className="p-4 border-t border-line flex items-center gap-3 flex-wrap">
              <button className="btn" onClick={notifierRetrait} disabled={busy}>
                <Bell size={15} /> Notifier mon retrait ({sel.size} koli)
              </button>
              <span className="text-xs text-slate-500">STANDA COMMERCIAL ap prepare koli yo anvan ou rive.</span>
            </div>
          )}
          {msg && <p className="px-4 pb-4 text-sm text-navy">{msg}</p>}
        </section>

        {/* Demandes de retrait */}
        {retraits.length > 0 && (
          <section className="card overflow-x-auto">
            <h2 className="text-sm font-bold text-navy uppercase tracking-wide p-4 pb-2">
              Demandes de retrait ({retraits.length})
            </h2>
            <table className="w-full text-sm">
              <thead><tr>
                {["Date", "Colis", "Poids (lb)", "Statut"].map((h) => <th key={h} className="th">{h}</th>)}
              </tr></thead>
              <tbody>
                {retraits.map((r, i) => (
                  <tr key={r.id} className={i % 2 ? "bg-mist" : ""}>
                    <td className="td">{new Date(r.created_at).toLocaleDateString("fr-FR")}</td>
                    <td className="td text-right">{r.package_count}</td>
                    <td className="td text-right">{Number(r.total_weight).toFixed(2)}</td>
                    <td className="td">
                      <span className={`badge ${RETRAIT_BADGE[r.status] ?? "bg-slate-100 text-slate-600"}`}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Fakti */}
        <section className="card overflow-x-auto">
          <h2 className="text-sm font-bold text-navy uppercase tracking-wide p-4 pb-2">Fakti ou yo ({invs.length})</h2>
          <table className="w-full text-sm">
            <thead><tr>
              {["No Facture", "Date", "Total (USD)", "PDF"].map((h) => <th key={h} className="th">{h}</th>)}
            </tr></thead>
            <tbody>
              {invs.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-slate-400">Poko gen fakti.</td></tr>
              ) : invs.map((f, i) => (
                <tr key={f.id} className={i % 2 ? "bg-mist" : ""}>
                  <td className="td font-semibold text-navy">{f.invoice_number}</td>
                  <td className="td">{dateFr(f.created_at)}</td>
                  <td className="td">{usd(f.grand_total)}</td>
                  <td className="td">
                    {f.pdf_url
                      ? <a href={f.pdf_url} target="_blank" className="text-navy underline text-xs font-semibold">Telechaje</a>
                      : <span className="text-xs text-slate-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
