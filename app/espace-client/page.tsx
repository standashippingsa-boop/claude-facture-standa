"use client";
/*
 * STANDA COMMERCIAL — ESPACE CLIENT (V11)
 * ═══════════════════════════════════════
 * Refonte konplè sou modèl aplikasyon mobil kliyan an mande a.
 *
 * ACCUEIL
 *   • Header: KÒD KLIYAN an sèlman (gwo) + non kliyan anba l.
 *     Bouton Actualiser = yon ICÒN sèlman, anwo. Pa gen "Bonjou", pa gen rezime.
 *   • 4 liy klikab ak konte nan yon boul adwat:
 *       Disponibles · Réceptions · Factures · Historique
 *
 * LOJIK KOLI (jan kliyan an espesifye l)
 *   RÉCEPTIONS  = tout koli ki rive pou kliyan an epi ki POKO fakti.
 *                 Koli DISPONIBLE yo parèt ANLÈ ak PRI yo.
 *   DISPONIBLES = sou-ansanm Réceptions (yo rete nan Réceptions tou).
 *   Lè yon koli fakti -> li SOTI nan Réceptions ak Disponibles
 *                     -> li ale nan HISTORIQUE.
 *
 * Klike sou yon koli = fenèt detay ak TOUT enfòmasyon sistèm nan genyen.
 *
 * BARE ANBA (navigasyon)
 *   Factures · Mon adresse (📍) · Accueil · Calculatrice · WhatsApp
 *   Adrès depo a PA sou paj dakèy la ankò — li gen pwòp paj li (icòn GPS la).
 *
 * ⚠️ TOUT hooks yo deklare ANVAN nenpòt `return` kondisyonèl (règ React).
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, Box, Calculator, ChevronDown, ChevronLeft, ChevronRight, Clock, FileText,
  History, KeyRound, LogOut, MapPin, MessageCircle, Package, RefreshCw, User, X
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { safeMessage } from "@/lib/safeerror";
import { createRetrait, getClientByAuthId, getClientPackagesAndInvoices, getClientRetraits } from "@/lib/db";
import { Client, Invoice, Pkg, Retrait } from "@/lib/types";
import { DEPOT } from "@/lib/depot";
import { SUPPORT_PHONE } from "@/lib/branding";
import { computePrice, round2 } from "@/lib/pricing";
import { dateFr, usd } from "@/lib/utils";
import StatusBadge from "@/components/StatusBadge";
import { StatusTimeline } from "@/components/StatusFlow";

type View = "home" | "disponibles" | "receptions" | "factures" | "historique" | "adresse" | "calc";

const WA_LINK = `https://wa.me/${SUPPORT_PHONE.replace(/\D/g, "")}`;

/** Yon koli "fini" (fakti oswa livre) -> li ale nan Historique. */
const isDone = (p: Pkg) => p.status === "Facturé" || p.status === "Livré" || !!p.invoice_id;

export default function EspaceClientPage() {
  // ── HOOKS (tout ansanm, anvan tout return) ──────────────────────────────
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [invs, setInvs] = useState<Invoice[]>([]);
  const [retraits, setRetraits] = useState<Retrait[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [view, setView] = useState<View>("home");
  const [detail, setDetail] = useState<Pkg | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [pwd1, setPwd1] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [pwdBusy, setPwdBusy] = useState(false);

  const [calcW, setCalcW] = useState("");

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
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [router]);

  // ── Aksyon ──────────────────────────────────────────────────────────────
  const refresh = async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } };
  const logout = async () => { await supabase.auth.signOut(); router.replace("/login"); };

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
    } catch (e: unknown) { setPwdMsg(safeMessage(e)); }
    finally { setPwdBusy(false); }
  };

  const toggleSel = (id: string) =>
    setSel((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const notifierRetrait = async () => {
    if (!client || !sel.size) return;
    setBusy(true);
    try {
      const chosen = pkgs.filter((p) => sel.has(p.id));
      await createRetrait(client, chosen);
      setRetraits(await getClientRetraits(client.customer_code));
      setSel(new Set());
      setMsg(`Demann ou an voye (${chosen.length} koli). STANDA COMMERCIAL ap prepare yo.`);
    } catch (e: unknown) { setMsg(safeMessage(e)); }
    finally { setBusy(false); }
  };

  // ── Gad kondisyonèl (apre TOUT hooks) ───────────────────────────────────
  if (loading) return <div className="min-h-screen bg-mist grid place-items-center text-slate-400">Ap chaje...</div>;

  if (!client) return (
    <div className="min-h-screen bg-mist grid place-items-center p-6">
      <div className="card p-8 max-w-md text-center space-y-4">
        <p className="text-sm text-slate-600">Nou pa jwenn pwofil ou. Kontakte STANDA COMMERCIAL.</p>
        <button className="btn justify-center w-full" onClick={logout}>Dekonekte</button>
      </div>
    </div>
  );

  const non = [client.fullname, client.surname].filter(Boolean).join(" ").trim();

  if (client.account_status !== "Actif" || !client.customer_code) {
    return (
      <div className="min-h-screen bg-mist grid place-items-center p-6">
        <div className="card p-8 max-w-md w-full text-center space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="mx-auto h-14 object-contain" />
          <Clock className="mx-auto text-amber-500" size={44} />
          <h1 className="text-lg font-extrabold text-navy">Kont ou an attente d&apos;activation</h1>
          <p className="text-sm text-slate-600">
            {non} — ekip STANDA COMMERCIAL ap verifye enfòmasyon ou yo. Lè kont ou aktive,
            w ap resevwa adrès depo ou Ozetazini epi w ap ka itilize tout sèvis shipping yo.
          </p>
          <a className="btn btn-wa justify-center w-full" href={WA_LINK} target="_blank" rel="noreferrer">
            <MessageCircle size={15} /> Kontakte nou sou WhatsApp
          </a>
          <button className="btn btn-ghost justify-center w-full" onClick={logout}>
            <LogOut size={15} /> Dekonekte
          </button>
        </div>
      </div>
    );
  }

  // ── Klasman koli yo ─────────────────────────────────────────────────────
  const historique = pkgs.filter(isDone);
  const receptionsAll = pkgs.filter((p) => !isDone(p));
  const disponibles = receptionsAll.filter((p) => p.status === "Disponible");
  const autres = receptionsAll.filter((p) => p.status !== "Disponible");
  const receptions = [...disponibles, ...autres]; // DISPONIBLE yo anlè

  /** Pri yon koli: sa admin nan fikse, sinon estimasyon tarif vil la. */
  const prixKoli = (p: Pkg): { total: number; estime: boolean } | null => {
    const t = Number(p.total_usd);
    if (Number.isFinite(t) && t > 0) return { total: t, estime: false };
    const r = computePrice(Number(p.weight) || 0, client.account_type, client.ville);
    return r ? { total: round2(r.price + r.taxFix), estime: true } : null;
  };

  // ── Ti konpozan ─────────────────────────────────────────────────────────
  const MenuRow = ({ icon: Icon, label, count, to, accent }: {
    icon: typeof Package; label: string; count: number; to: View; accent?: boolean;
  }) => (
    <button onClick={() => setView(to)}
      className="w-full card card-hover px-4 py-4 flex items-center gap-3 text-left">
      <Icon size={20} className={accent ? "text-brand-dark shrink-0" : "text-navy shrink-0"} />
      <span className="flex-1 text-[15px] font-semibold text-ink">{label}</span>
      <span className={`w-8 h-8 rounded-full grid place-items-center text-sm font-bold text-white shrink-0
        ${accent ? "bg-brand" : "bg-navy"}`}>{count}</span>
      <ChevronRight size={16} className="text-slate-300 shrink-0" />
    </button>
  );

  const PkgCard = ({ p, showPrice }: { p: Pkg; showPrice?: boolean }) => {
    const pr = showPrice ? prixKoli(p) : null;
    return (
      <button onClick={() => setDetail(p)} className="w-full card card-hover p-4 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[13px] font-bold text-ink truncate">{p.tracking_number || "—"}</p>
            {p.tracking_manual && <p className="font-mono text-[11px] text-mute truncate mt-0.5">{p.tracking_manual}</p>}
          </div>
          <StatusBadge status={p.status} />
        </div>
        <div className="mt-2.5"><StatusTimeline status={p.status} compact /></div>
        <div className="flex items-center justify-between gap-2 mt-2.5">
          <span className="text-xs text-mute truncate">{p.content || "—"}</span>
          <span className="text-xs font-semibold text-ink shrink-0">
            {Number(p.weight) > 0 ? `${Number(p.weight).toFixed(2)} lb` : "—"}
          </span>
        </div>
        {pr && (
          <div className="mt-2.5 pt-2.5 border-t border-line flex items-center justify-between">
            <span className="text-[11px] text-mute">{pr.estime ? "Prix estimé" : "Prix"}</span>
            <span className="text-base font-extrabold text-navy">{usd(pr.total)}</span>
          </div>
        )}
      </button>
    );
  };

  const Empty = ({ t }: { t: string }) => (
    <div className="card p-10 text-center text-mute text-sm">{t}</div>
  );

  const SubHeader = ({ title, sub }: { title: string; sub?: string }) => (
    <div className="flex items-center gap-2 mb-4">
      <button onClick={() => setView("home")} className="w-9 h-9 rounded-xl border border-line bg-white grid place-items-center text-navy shrink-0">
        <ChevronLeft size={18} />
      </button>
      <div className="min-w-0">
        <h1 className="text-lg font-extrabold text-ink leading-tight truncate">{title}</h1>
        {sub && <p className="text-xs text-mute truncate">{sub}</p>}
      </div>
    </div>
  );

  // ── Kalkilatris ─────────────────────────────────────────────────────────
  const w = Number(calcW.replace(",", "."));
  const calcOk = Number.isFinite(w) && w > 0;
  const calcRes = calcOk ? computePrice(w, client.account_type, client.ville) : null;

  // ── Bare navigasyon anba ────────────────────────────────────────────────
  const NavBtn = ({ icon: Icon, label, to, href }: {
    icon: typeof Package; label: string; to?: View; href?: string;
  }) => {
    const active = to && view === to;
    const cls = `flex-1 flex flex-col items-center gap-0.5 py-2 ${active ? "text-navy" : "text-slate-400"}`;
    const inner = <><Icon size={20} /><span className="text-[10px] font-semibold">{label}</span></>;
    return href
      ? <a href={href} target="_blank" rel="noreferrer" className={cls}>{inner}</a>
      : <button className={cls} onClick={() => to && setView(to)}>{inner}</button>;
  };

  return (
    <div className="min-h-screen bg-mist pb-24">

      {/* ══ HEADER: KÒD KLIYAN sèlman + non anba ══ */}
      <header className="bg-navy text-white sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white grid place-items-center overflow-hidden shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-8 object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-lg leading-tight truncate">{client.customer_code}</p>
            <p className="text-[12px] text-white/65 truncate">{non || "—"}</p>
          </div>

          {/* Actualiser — ICÒN SÈLMAN */}
          <button onClick={refresh} disabled={refreshing} aria-label="Actualiser"
            className="w-9 h-9 rounded-lg grid place-items-center text-white/85 hover:text-white hover:bg-white/10 disabled:opacity-50">
            <RefreshCw size={19} className={refreshing ? "animate-spin" : ""} />
          </button>

          <a href={WA_LINK} target="_blank" rel="noreferrer" aria-label="WhatsApp"
            className="w-9 h-9 rounded-lg grid place-items-center text-white/85 hover:text-white hover:bg-white/10">
            <MessageCircle size={19} />
          </a>

          <div className="relative">
            <button aria-label="Mon compte" onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-1 text-white/85 hover:text-white rounded-lg px-1.5 py-1.5 hover:bg-white/10">
              <div className="w-7 h-7 rounded-full bg-white/15 grid place-items-center"><User size={15} /></div>
              <ChevronDown size={14} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl shadow-lift border border-line py-1 z-20 text-ink">
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

      <div className="max-w-3xl mx-auto p-4 space-y-4">

        {/* ═══════════ ACCUEIL ═══════════ */}
        {view === "home" && (
          <>
            {/* Banyè: rapèl kòd la */}
            <div className="rounded-2xl bg-navy-dark text-white px-5 py-6 text-center">
              <Bell size={30} className="mx-auto mb-2 text-white/80" />
              <p className="text-[11px] tracking-[.18em] font-bold text-white/60 uppercase">Adrès 2 sou koli ou yo</p>
              <p className="text-3xl font-extrabold tracking-tight mt-1">{client.customer_code}</p>
              <p className="text-[12px] text-white/60 mt-1.5">San kòd sa a nou pa ka idantifye koli ou.</p>
            </div>

            <MenuRow icon={Bell} label="Disponibles" count={disponibles.length} to="disponibles" accent />
            <MenuRow icon={Box} label="Réceptions" count={receptions.length} to="receptions" />
            <MenuRow icon={FileText} label="Factures" count={invs.length} to="factures" />
            <MenuRow icon={History} label="Historique" count={historique.length} to="historique" />

            {retraits.length > 0 && (
              <section className="space-y-2 pt-1">
                <h2 className="h-sec">Demandes de retrait</h2>
                {retraits.map((r) => (
                  <div key={r.id} className="card p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">
                        {r.package_count} colis · {Number(r.total_weight).toFixed(2)} lb
                      </p>
                      <p className="text-xs text-mute mt-0.5">{dateFr(r.created_at)}</p>
                    </div>
                    <span className={`pill shrink-0 ${r.status === "Remis" ? "pill-green" : r.status === "Préparé" ? "pill-blue" : "pill-amber"}`}>
                      <span className="pill-dot" /> {r.status}
                    </span>
                  </div>
                ))}
              </section>
            )}
          </>
        )}

        {/* ═══════════ DISPONIBLES ═══════════ */}
        {view === "disponibles" && (
          <>
            <SubHeader title="Disponibles" sub={`${disponibles.length} koli pare pou w vin pran`} />
            {disponibles.length === 0 ? <Empty t="Pa gen koli disponib pou kounye a." /> : (
              <div className="space-y-3">
                {disponibles.map((p) => (
                  <div key={p.id} className="relative">
                    <label className="absolute top-4 right-4 z-10 flex items-center gap-1.5 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="w-4 h-4" checked={sel.has(p.id)} onChange={() => toggleSel(p.id)} />
                    </label>
                    <PkgCard p={p} showPrice />
                  </div>
                ))}
              </div>
            )}
            {sel.size > 0 && (
              <div className="sticky bottom-24 z-20">
                <button className="btn btn-brand w-full justify-center shadow-lift" onClick={notifierRetrait} disabled={busy}>
                  <Bell size={15} /> Notifier mon retrait ({sel.size})
                </button>
              </div>
            )}
            {msg && <p className="card px-4 py-3 text-sm text-navy">{msg}</p>}
          </>
        )}

        {/* ═══════════ RÉCEPTIONS ═══════════ */}
        {view === "receptions" && (
          <>
            <SubHeader title="Réceptions" sub={`${receptions.length} koli rive pou ou · poko fakti`} />
            {receptions.length === 0 ? <Empty t="Poko gen koli ki rive." /> : (
              <div className="space-y-3">
                {disponibles.length > 0 && (
                  <p className="text-[11px] font-bold uppercase tracking-wide text-brand-dark">
                    Disponibles ({disponibles.length})
                  </p>
                )}
                {disponibles.map((p) => <PkgCard key={p.id} p={p} showPrice />)}
                {autres.length > 0 && (
                  <p className="text-[11px] font-bold uppercase tracking-wide text-mute pt-2">
                    En cours ({autres.length})
                  </p>
                )}
                {autres.map((p) => <PkgCard key={p.id} p={p} />)}
              </div>
            )}
          </>
        )}

        {/* ═══════════ HISTORIQUE ═══════════ */}
        {view === "historique" && (
          <>
            <SubHeader title="Historique" sub={`${historique.length} koli fakti oswa livre`} />
            {historique.length === 0 ? <Empty t="Poko gen koli nan istorik la." /> : (
              <div className="space-y-3">{historique.map((p) => <PkgCard key={p.id} p={p} showPrice />)}</div>
            )}
          </>
        )}

        {/* ═══════════ FACTURES ═══════════ */}
        {view === "factures" && (
          <>
            <SubHeader title="Factures" sub={`${invs.length} fakti`} />
            {invs.length === 0 ? <Empty t="Poko gen fakti." /> : (
              <div className="card divide-y divide-line">
                {invs.map((f) => (
                  <div key={f.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-navy">{f.invoice_number}</p>
                      <p className="text-xs text-mute mt-0.5">{dateFr(f.created_at)} · {f.package_count} koli</p>
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
          </>
        )}

        {/* ═══════════ MON ADRESSE (icòn GPS la) ═══════════ */}
        {view === "adresse" && (
          <>
            <SubHeader title="Mon adresse" sub="Adrès depo ou Ozetazini" />
            <div className="card p-5">
              {([["Full Name / Nombre completo", non || "—"],
                 ["Address 1", DEPOT.address1],
                 ["Address 2", client.customer_code],
                 ["City", DEPOT.city],
                 ["State", DEPOT.state],
                 ["ZIP Code", DEPOT.zip],
                 ["Phone", DEPOT.phone]] as const).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-line py-2.5 last:border-0">
                  <span className="text-mute text-sm">{k}</span>
                  <span className={`font-semibold text-sm text-right ${k === "Address 2" ? "text-navy" : "text-ink"}`}>{v}</span>
                </div>
              ))}
              <p className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                Toujou mete kòd <b>{client.customer_code}</b> la sou <b>Address 2</b> chak fwa w ap voye
                yon pakè — se kòd sa a ki pèmèt nou idantifye koli ou yo.
              </p>
            </div>
          </>
        )}

        {/* ═══════════ CALCULATRICE ═══════════ */}
        {view === "calc" && (
          <>
            <SubHeader title="Calculatrice" sub="Estime konbyen shipping ou ap koute" />
            <div className="card p-5 space-y-4">
              <label className="block">
                <span className="text-xs font-semibold text-mute">Pwa koli a (LB)</span>
                <input className="input mt-1.5 text-lg font-semibold" inputMode="decimal" placeholder="Ex: 4.5"
                  value={calcW} onChange={(e) => setCalcW(e.target.value)} />
              </label>

              {!client.ville?.active && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                  Vil ou a poko konfigire nan sistèm nan. Kontakte nou sou WhatsApp pou tarif ou.
                </p>
              )}

              {calcRes && (
                <div className="rounded-xl border border-line divide-y divide-line">
                  <div className="flex justify-between px-4 py-2.5 text-sm">
                    <span className="text-mute">Prix transport</span>
                    <span className="font-semibold text-ink">{usd(calcRes.price)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5 text-sm">
                    <span className="text-mute">Frais &amp; taxes</span>
                    <span className="font-semibold text-ink">{usd(calcRes.taxFix)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3 bg-mist rounded-b-xl">
                    <span className="font-bold text-ink text-sm">Total estimé</span>
                    <span className="font-extrabold text-navy text-lg">{usd(round2(calcRes.price + calcRes.taxFix))}</span>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-mute">
                Sa se yon <b>estimasyon</b> dapre tarif vil ou a
                {client.ville?.name ? ` (${client.ville.name})` : ""} ak tip kont ou an ({client.account_type}).
                Pri final la fikse lè koli a peze nan depo a.
              </p>
            </div>
          </>
        )}
      </div>

      {/* ══ DETAY KOLI — TOUT enfòmasyon sistèm nan genyen ══ */}
      {detail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => setDetail(null)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-line px-4 py-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink">Détails du colis</h2>
              <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-navy"><X size={19} /></button>
            </div>
            <div className="p-4 space-y-3">
              <StatusTimeline status={detail.status} />
              <div className="divide-y divide-line">
                {([
                  ["Tracking ID", detail.tracking_number],
                  ["Tracking Number", detail.tracking_manual],
                  ["Contenu", detail.content],
                  ["Poids", Number(detail.weight) > 0 ? `${Number(detail.weight).toFixed(2)} lb` : ""],
                  ["Quantité", detail.quantity ? String(detail.quantity) : ""],
                  ["Statut", detail.status],
                  ["Statut MCPACK", detail.status_mcpack],
                  ["Date création", dateFr(detail.created_date)],
                  ["Date réception", detail.received_at ? dateFr(detail.received_at) : ""],
                  ["Méthode réception", detail.received_method],
                  ["Prix", Number(detail.price_usd) > 0 ? usd(detail.price_usd) : ""],
                  ["Taxes", Number(detail.tax_usd) > 0 ? usd(detail.tax_usd) : ""],
                  ["Total", Number(detail.total_usd) > 0 ? usd(detail.total_usd) : ""],
                  ["Facturé", isDone(detail) ? "Oui" : "Non"],
                  ["Vérifié", detail.verified ? "Oui" : "Non"]
                ] as const).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2.5">
                    <span className="text-mute text-[13px] shrink-0">{k}</span>
                    <span className="font-semibold text-[13px] text-ink text-right break-all">
                      {String(v ?? "").trim() || "—"}
                    </span>
                  </div>
                ))}
              </div>
              {!Number(detail.total_usd) && prixKoli(detail) && (
                <div className="rounded-xl bg-mist px-4 py-3 flex justify-between items-center">
                  <span className="text-[12px] text-mute">Prix estimé</span>
                  <span className="font-extrabold text-navy">{usd(prixKoli(detail)!.total)}</span>
                </div>
              )}
              <a href={WA_LINK} target="_blank" rel="noreferrer" className="btn btn-wa w-full justify-center">
                <MessageCircle size={15} /> Poze yon kesyon sou koli sa a
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal: chanje modpas ══ */}
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

      {/* ══ BARE NAVIGASYON ANBA ══ */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-line">
        <div className="max-w-3xl mx-auto flex items-stretch px-2 pb-[env(safe-area-inset-bottom)]">
          <NavBtn icon={FileText} label="Factures" to="factures" />
          <NavBtn icon={MapPin} label="Adresse" to="adresse" />
          <button onClick={() => setView("home")} aria-label="Accueil"
            className="flex-1 flex flex-col items-center -mt-5">
            <span className={`w-14 h-14 rounded-full grid place-items-center border-4 border-white shadow-lift
              ${view === "home" ? "bg-navy text-white" : "bg-navy-light text-white"}`}>
              <Package size={24} />
            </span>
            <span className="text-[10px] font-semibold text-navy mt-0.5">Accueil</span>
          </button>
          <NavBtn icon={Calculator} label="Calcul" to="calc" />
          <NavBtn icon={MessageCircle} label="WhatsApp" href={WA_LINK} />
        </div>
      </nav>
    </div>
  );
}
