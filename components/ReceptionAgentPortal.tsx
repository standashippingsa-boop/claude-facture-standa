"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ClipboardList, LogOut, MapPin, PackagePlus, Search, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Logo from "@/components/Logo";

import { useNoticeToast } from "@/lib/notify";
import { normalizeMcCode } from "@/lib/utils";
import PwaInstallButton from "@/components/PwaInstallButton";
import {
  clearReceptionOffline, enqueueConduce, loadDirectory, loadQueue, rememberAgent, rememberedAgent,
  saveDirectory, saveQueue, searchDirectory, type QueuedConduce, type ReceptionClient
} from "@/lib/reception-offline";
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
 *
 * V3 — SAN ENTÈNÈT: rechèch la tonbe sou kopi lokal lis kliyan yo, epi yon
 * Conduce anrejistre san rezo rete nan yon fil datant sou telefòn nan; li
 * voye pou kont li depi rezo a tounen (gade lib/reception-offline.ts).
 */
type ClientResult = ReceptionClient;
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
  useNoticeToast(searchError, setSearchError, { tone: "error", title: "Recherche sans résultat" });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [conduceNumber, setConduceNumber] = useState("");
  const [office, setOffice] = useState("");
  const [conduceBusy, setConduceBusy] = useState(false);
  const [conduceMessage, setConduceMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  useNoticeToast(conduceMessage, setConduceMessage);

  const [offline, setOffline] = useState(false);
  const [queue, setQueue] = useState<QueuedConduce[]>([]);
  const [localResults, setLocalResults] = useState(false);
  const flushingRef = useRef(false);

  const authHeader = useCallback(async (): Promise<string | null> => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    return token ? "Bearer " + token : null;
  }, []);

  /** Aksè rezo ki pa janm voye yon erè: null = pa gen rezo (oswa sèvè a pa reponn). */
  const callApi = useCallback(async (body: Record<string, unknown>): Promise<{ status: number; json: any } | null> => {
    try {
      const auth = await authHeader();
      if (!auth) return navigator.onLine ? { status: 401, json: { ok: false, reason: "Session requise." } } : null;
      const res = await fetch("/api/reception", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: auth },
        body: JSON.stringify(body)
      });
      setOffline(false);
      return { status: res.status, json: await res.json().catch(() => ({})) };
    } catch { setOffline(true); return null; }
  }, [authHeader]);

  /** Voye Conduce ki t ap tann yo. Yon nimewo ki deja egziste konte kòm reyisi (sèvè a idanpotan). */
  const flushQueue = useCallback(async () => {
    if (flushingRef.current) return;
    const pending = loadQueue();
    if (!pending.length) { setQueue([]); return; }
    flushingRef.current = true;
    let sent = 0;
    try {
      for (const item of pending) {
        const result = await callApi({ action: "create_conduce", conduce_number: item.number, office: item.office });
        if (!result || result.status === 401 || result.status === 429 || result.status >= 500) break;   // rezo/sesyon: n ap reeseye pita
        // 200 (kreye oswa deja la) oswa 400 (nimewo envalid): li soti nan fil la.
        saveQueue(loadQueue().filter((queued) => queued.number !== item.number));
        if (result.json?.ok) sent++;
      }
    } finally { flushingRef.current = false; }
    setQueue(loadQueue());
    if (sent) setConduceMessage({ type: "ok", text: `${sent} Conduce envoyée${sent > 1 ? "s" : ""} · internet retrouvé.` });
  }, [callApi]);

  /** Mete kopi lokal lis kliyan yo ajou (silansye: san rezo, ansyen kopi a rete). */
  const refreshDirectory = useCallback(async () => {
    const result = await callApi({ action: "directory" });
    if (result?.json?.ok && Array.isArray(result.json.clients)) saveDirectory(result.json.clients as ReceptionClient[]);
  }, [callApi]);

  useEffect(() => {
    (async () => {
      setQueue(loadQueue());
      setOffline(!navigator.onLine);
      setAgentName(rememberedAgent() ?? "");
      try {
        const { data } = await supabase.auth.getUser();
        const { data: staff } = data.user
          ? await supabase.from("staff").select("prenom, nom, username").eq("auth_user_id", data.user.id).maybeSingle()
          : { data: null };
        const s = staff as { prenom?: string; nom?: string; username?: string } | null;
        if (s) {
          const name = [s.prenom, s.nom].filter(Boolean).join(" ") || s.username || "";
          setAgentName(name);
          rememberAgent(name);
        }
      } catch { /* san rezo: non ki sou aparèy la rete */ }
      setReady(true);
      // Mande service worker la kenbe paj la pou li ka louvri san rezo.
      navigator.serviceWorker?.ready.then((reg) => reg.active?.postMessage({ type: "WARM_PAGE", url: "/reception" })).catch(() => undefined);
      void refreshDirectory();
      void flushQueue();
    })();
  }, [refreshDirectory, flushQueue]);

  // Rezo a tounen -> voye fil la epi rafrechi lis la. Yon ti revèy tou, paske
  // evènman "online" pa toujou tire sou telefòn.
  useEffect(() => {
    const onOnline = () => { setOffline(false); void flushQueue(); void refreshDirectory(); };
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const timer = setInterval(() => { if (loadQueue().length) void flushQueue(); }, 30000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(timer);
    };
  }, [flushQueue, refreshDirectory]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) { setResults(null); setSearchError(null); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true); setSearchError(null);
      try {
        const result = await callApi({ action: "lookup_client", query: q });
        if (result?.status === 401) { router.replace("/reception-login"); return; }
        if (result?.json?.ok) {
          setLocalResults(false);
          setResults(result.json.clients as ClientResult[]);
          return;
        }
        // San rezo (oswa sèvè a pa reponn): kopi lokal lis kliyan yo.
        const directory = loadDirectory();
        if (!result && directory) {
          setLocalResults(true);
          setResults(searchDirectory(directory.clients, q, normalizeMcCode(q)));
          return;
        }
        throw new Error(result?.json?.reason || "Pas d'internet et aucune liste enregistrée sur ce téléphone.");
      } catch (e) {
        setResults(null);
        setSearchError(e instanceof Error ? e.message : "Recherche impossible.");
      } finally { setSearching(false); }
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, callApi, router]);

  const submitConduce = async () => {
    const num = conduceNumber.trim();
    if (!num || conduceBusy) return;
    setConduceBusy(true); setConduceMessage(null);
    try {
      const result = await callApi({ action: "create_conduce", conduce_number: num, office: office.trim() });
      if (result?.status === 401) { router.replace("/reception-login"); return; }
      if (!result || result.status >= 500) {
        // San rezo: Conduce la rete sou telefòn nan, l ap voye pou kont li.
        setQueue(enqueueConduce(num, office.trim()));
        setConduceMessage({ type: "ok", text: `Conduce ${num} gardée sur le téléphone · elle sera envoyée dès le retour d'internet.` });
        setConduceNumber(""); setOffice("");
        return;
      }
      const json = result.json;
      if (!json.ok) { setConduceMessage({ type: "error", text: json.reason || "Création impossible." }); return; }
      setConduceMessage({
        type: "ok",
        text: json.alreadyExisted
          ? `Conduce ${json.conduce.conduce_number} · déjà enregistrée.`
          : `Conduce ${json.conduce.conduce_number} · enregistrée.`
      });
      setConduceNumber(""); setOffice("");
    } catch {
      setConduceMessage({ type: "error", text: "Réessayez." });
    } finally { setConduceBusy(false); }
  };

  const logout = async () => {
    if (loadQueue().length && !confirm("Des Conduces ne sont pas encore envoyées. Se déconnecter les supprimera de ce téléphone. Continuer ?")) return;
    clearReceptionOffline();
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
              <Logo size={30} rounded="rounded-full" tone="light" />
              <span className="text-[13px] font-bold text-white">{agentName || "Réception"}</span>
              <span role="status" aria-label={offline ? "Hors ligne" : "Connecté"} title={offline ? "Hors ligne" : "Connecté"}
                className={`h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/70 ${offline ? "bg-red-500" : "bg-emerald-400"}`} />
            </div>
            <div className="flex items-center gap-2">
            <PwaInstallButton appName="STANDA Réception" className="!h-9 !w-9 bg-white/15 backdrop-blur-md hover:!bg-white/25" />
            <button onClick={logout} aria-label="Déconnexion"
              className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white backdrop-blur-md hover:bg-white/25">
              <LogOut size={16} />
            </button>
            </div>
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
                {!searching && results && results.length > 0 && localResults && (
                  <p className="text-[12px] text-mute">Liste enregistrée sur ce téléphone.</p>
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
                placeholder="Office"
                className="w-full rounded-2xl border border-line bg-mist/40 px-4 py-3.5 text-[15px] text-navy outline-none focus:border-accent focus:bg-white" />
              <button onClick={submitConduce} disabled={conduceBusy || !conduceNumber.trim()}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-navy text-[15px] font-bold text-white transition hover:bg-navy/90 disabled:opacity-50">
                {conduceBusy
                  ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  : <PackagePlus size={18} />}
                {conduceBusy ? "Enregistrement…" : "Enregistrer"}
              </button>
              {queue.length > 0 && (
                <ul className="divide-y divide-line rounded-2xl border border-line">
                  {queue.map((item) => (
                    <li key={item.number} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                      <span className="font-mono font-bold text-navy">{item.number}</span>
                      <span className="text-amber-700">En attente d&apos;envoi</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
