"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ClipboardList, LogOut, MapPin, PackagePlus, Search, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Logo from "@/components/Logo";

/**
 * PÒTAY AJAN RESEPSYON — Conduce + chèche kliyan.
 * ═══════════════════════════════════════════════════════════════════
 * Yon Conduce (manifest Caribe Tours) rive an Ayiti; moun ki resevwa
 * machandiz la wè kòd kliyan ekri sou chak pakè. Paj sa a reponn de bezwen:
 *   1. Konfime yon kòd kliyan ki "parèt etranj" — non li, zòn li, epi
 *      konbyen lòt koli li gen k ap toujou soti Miami (pa ko rive).
 *   2. Anrejistre nimewo Conduce a lè l rive.
 * Zewo done sansib (telefòn, adrès, fakti) pa parèt isit la. Tout done soti
 * nan /api/reception (kle sèvis kote sèvè a) — RLS pa idantifye agent_reception.
 *
 * V2 — FÒMA APP TELEFÒN: max-w-md (pa yon lajè sit dèsktòp), gwo ilistrasyon
 * anlè (mwatye ekran an), tab olye 2 katab anpile, ak ZEWO tèks eksplikasyon
 * — ajan an deja konnen kisa l ap fè, li pa bezwen yon manyèl.
 */
type ClientResult = { customer_code: string; fullname: string; ville_name: string; miami_count: number };
type Tab = "search" | "conduce";

export default function ReceptionAgentPortal() {
  const router = useRouter();
  const [agentName, setAgentName] = useState("");
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("search");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [conduceNumber, setConduceNumber] = useState("");
  const [office, setOffice] = useState("");
  const [conduceBusy, setConduceBusy] = useState(false);
  const [conduceMessage, setConduceMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const authHeader = useCallback(async (): Promise<string | null> => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    return token ? "Bearer " + token : null;
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const { data: staff } = data.user
        ? await supabase.from("staff").select("prenom, nom, username").eq("auth_user_id", data.user.id).maybeSingle()
        : { data: null };
      const s = staff as { prenom?: string; nom?: string; username?: string } | null;
      setAgentName(s ? [s.prenom, s.nom].filter(Boolean).join(" ") || s.username || "" : "");
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) { setResults(null); setSearchError(null); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true); setSearchError(null);
      try {
        const auth = await authHeader();
        if (!auth) { router.replace("/reception-login"); return; }
        const res = await fetch("/api/reception", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: auth },
          body: JSON.stringify({ action: "lookup_client", query: q })
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.reason || "Recherche impossible.");
        setResults(json.clients as ClientResult[]);
      } catch (e) {
        setResults(null);
        setSearchError(e instanceof Error ? e.message : "Recherche impossible.");
      } finally { setSearching(false); }
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, authHeader, router]);

  const submitConduce = async () => {
    const num = conduceNumber.trim();
    if (!num || conduceBusy) return;
    setConduceBusy(true); setConduceMessage(null);
    try {
      const auth = await authHeader();
      if (!auth) { router.replace("/reception-login"); return; }
      const res = await fetch("/api/reception", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: auth },
        body: JSON.stringify({ action: "create_conduce", conduce_number: num, office: office.trim() })
      });
      const json = await res.json();
      if (!json.ok) { setConduceMessage({ type: "error", text: json.reason || "Création impossible." }); return; }
      setConduceMessage({
        type: "ok",
        text: json.alreadyExisted
          ? `Conduce ${json.conduce.conduce_number} — déjà enregistrée.`
          : `Conduce ${json.conduce.conduce_number} — enregistrée.`
      });
      setConduceNumber(""); setOffice("");
    } catch {
      setConduceMessage({ type: "error", text: "Réessayez." });
    } finally { setConduceBusy(false); }
  };

  const logout = async () => {
    await supabase.auth.signOut({ scope: "local" });
    router.replace("/reception-login");
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-md">
        {/* ── Gwo ilistrasyon — mwatye tèt ekran an ── */}
        <div className="relative h-[42vh] min-h-[280px] overflow-hidden bg-navy">
          <Image src="/account-agent-hero.png" alt="" fill priority sizes="(max-width: 448px) 100vw, 448px"
            unoptimized className="object-cover object-[70%_20%]" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(6,25,55,.35) 0%, rgba(6,25,55,.15) 45%, #FFFFFF 100%)" }} />

          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
            <div className="flex items-center gap-2.5 rounded-full bg-white/15 py-1.5 pl-1.5 pr-3.5 backdrop-blur-md">
              <Logo size={30} rounded="rounded-full" />
              <span className="text-[13px] font-bold text-white">{agentName || "Réception"}</span>
            </div>
            <button onClick={logout} aria-label="Déconnexion"
              className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white backdrop-blur-md hover:bg-white/25">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* ── Fèy blanch ki chevoche ilistrasyon an ── */}
        <div className="relative -mt-8 rounded-t-[2rem] bg-white px-4 pb-10 pt-5 sm:px-6">
          {/* ── Segmented control ── */}
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-mist p-1">
            <button onClick={() => setTab("search")}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13.5px] font-bold transition ${
                tab === "search" ? "bg-navy text-white shadow-card" : "text-mute"}`}>
              <Search size={15} /> Client
            </button>
            <button onClick={() => setTab("conduce")}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13.5px] font-bold transition ${
                tab === "conduce" ? "bg-navy text-white shadow-card" : "text-mute"}`}>
              <ClipboardList size={15} /> Conduce
            </button>
          </div>

          {tab === "search" ? (
            <div className="mt-5">
              <div className="relative">
                <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mute" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} autoCapitalize="none" autoFocus
                  placeholder="36191…"
                  className="w-full rounded-2xl border border-line bg-mist/40 py-3.5 pl-10 pr-4 text-[16px] font-semibold text-navy outline-none focus:border-accent focus:bg-white" />
              </div>

              <div className="mt-4 space-y-2.5">
                {searching && (
                  <div className="flex justify-center py-6">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  </div>
                )}
                {searchError && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">{searchError}</p>}
                {!searching && results && results.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-10 text-center">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-mist text-mute"><Search size={20} /></span>
                    <p className="text-[13px] text-mute">« {query.trim()} »</p>
                  </div>
                )}
                {!searching && !results && (
                  <div className="flex flex-col items-center gap-2 py-12 text-center opacity-70">
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-accent-light text-accent-dark"><User size={22} /></span>
                  </div>
                )}
                {!searching && results && results.map((c) => (
                  <div key={c.customer_code} className="rounded-2xl border border-line bg-white p-4 shadow-[0_2px_10px_-6px_rgba(15,23,42,.15)]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[16px] font-black text-navy">{c.fullname}</p>
                        <p className="mt-0.5 font-mono text-[12.5px] font-semibold text-accent-dark">{c.customer_code}</p>
                      </div>
                      {c.miami_count > 0 && (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[12px] font-bold text-amber-700">
                          {c.miami_count} · Miami
                        </span>
                      )}
                    </div>
                    <p className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-mist px-3 py-2 text-[14px] font-bold text-navy">
                      <MapPin size={14} className="text-accent" /> {c.ville_name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              <input value={conduceNumber} onChange={(e) => setConduceNumber(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitConduce(); }} autoFocus
                placeholder="Numéro de Conduce…"
                className="w-full rounded-2xl border border-line bg-mist/40 px-4 py-3.5 text-[16px] font-bold font-mono text-navy outline-none focus:border-accent focus:bg-white" />
              <input value={office} onChange={(e) => setOffice(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitConduce(); }}
                placeholder="Office (optionnel)"
                className="w-full rounded-2xl border border-line bg-mist/40 px-4 py-3.5 text-[15px] text-navy outline-none focus:border-accent focus:bg-white" />
              <button onClick={submitConduce} disabled={conduceBusy || !conduceNumber.trim()}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-navy text-[15px] font-bold text-white transition hover:bg-navy/90 disabled:opacity-50">
                {conduceBusy
                  ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  : <PackagePlus size={18} />}
                {conduceBusy ? "Enregistrement…" : "Enregistrer"}
              </button>
              {conduceMessage && (
                <p className={`rounded-2xl px-4 py-3 text-center text-[14px] font-semibold ${conduceMessage.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                  {conduceMessage.text}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
