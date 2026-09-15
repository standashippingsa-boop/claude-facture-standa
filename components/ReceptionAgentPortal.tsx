"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ClipboardList, LogOut, MapPin, Package, PackagePlus, Search, User } from "lucide-react";
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
 * Zewo done sansib (telefòn, adrès, fakti) pa parèt isit la — sèlman sa ki
 * nesesè pou wout/verifikasyon. Tout done soti nan /api/reception (kle
 * sèvis kote sèvè a) — RLS pa idantifye agent_reception, donk pa gen lòt chemen.
 */
type ClientResult = { customer_code: string; fullname: string; ville_name: string; miami_count: number };

export default function ReceptionAgentPortal() {
  const router = useRouter();
  const [agentName, setAgentName] = useState("");
  const [ready, setReady] = useState(false);

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
          ? `La Conduce ${json.conduce.conduce_number} existait déjà.`
          : `Conduce ${json.conduce.conduce_number} enregistrée.`
      });
      setConduceNumber(""); setOffice("");
    } catch {
      setConduceMessage({ type: "error", text: "Impossible de joindre le service. Réessayez." });
    } finally { setConduceBusy(false); }
  };

  const logout = async () => {
    await supabase.auth.signOut({ scope: "local" });
    router.replace("/reception-login");
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      {/* ── Hero — antrepo/pakè, pou l atiran e byen brandé ── */}
      <div className="relative overflow-hidden bg-navy">
        <Image src="/parcel-boxes-background.png" alt="" fill priority sizes="100vw" unoptimized
          className="object-cover object-center opacity-45" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(6,25,55,.5) 0%, rgba(6,25,55,.92) 100%)" }} />
        <div className="relative mx-auto max-w-2xl px-4 py-6 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo size={38} rounded="rounded-xl" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[.16em] text-accent-light">Réception</p>
                <h1 className="text-[18px] font-black text-white">{agentName || "Agent de réception"}</h1>
              </div>
            </div>
            <button onClick={logout} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-[13px] font-bold text-white backdrop-blur-sm hover:bg-white/20">
              <LogOut size={15} /> Déconnexion
            </button>
          </div>
          <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-white/75">
            Confirmez un code client et enregistrez l&apos;arrivée d&apos;une Conduce.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6">
        {/* ── Chèche yon kliyan ── */}
        <section className="mt-5 rounded-2xl border border-line bg-white p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Search size={16} className="text-accent" />
            <h2 className="text-[15px] font-bold text-navy">Chercher un client</h2>
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-mute">
            Tapez juste les chiffres du code (ex. 36191, pas besoin de « MC- ») ou le nom
            écrit sur le colis pour voir sa zone et combien de colis il a encore en route depuis Miami.
          </p>
          <input value={query} onChange={(e) => setQuery(e.target.value)} autoCapitalize="none"
            placeholder="Ex. 36191 ou le nom du client…"
            className="mt-3 w-full rounded-xl border border-line px-3.5 py-2.5 text-[14px] outline-none focus:border-accent" />

          {searching && <p className="mt-3 text-[13px] text-mute">Recherche…</p>}
          {searchError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{searchError}</p>}
          {!searching && results && results.length === 0 && (
            <p className="mt-3 text-[13px] text-mute">Aucun client trouvé pour « {query.trim()} ».</p>
          )}
          {!searching && results && results.length > 0 && (
            <div className="mt-3 space-y-2">
              {results.map((c) => (
                <div key={c.customer_code} className="rounded-xl border border-line bg-mist/40 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-[14px] font-bold text-navy">
                        <User size={13} className="shrink-0 text-mute" /> {c.fullname}
                      </p>
                      <p className="mt-0.5 font-mono text-[12.5px] text-mute">{c.customer_code}</p>
                    </div>
                    {c.miami_count > 0 && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[12px] font-bold text-amber-700">
                        {c.miami_count} depuis Miami
                      </span>
                    )}
                  </div>
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[13px] font-bold text-navy">
                    <MapPin size={13} className="text-accent" /> {c.ville_name}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Antre yon Conduce ── */}
        <section className="mt-4 rounded-2xl border border-line bg-white p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-accent" />
            <h2 className="text-[15px] font-bold text-navy">Enregistrer une Conduce</h2>
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-mute">
            Dès que vous avez le numéro entre les mains, le lot est arrivé en Haïti.
          </p>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <input value={conduceNumber} onChange={(e) => setConduceNumber(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitConduce(); }}
              placeholder="Numéro de Conduce (ex. 10534)" className="rounded-xl border border-line px-3.5 py-2.5 text-[14px] font-mono outline-none focus:border-accent" />
            <input value={office} onChange={(e) => setOffice(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitConduce(); }}
              placeholder="Office (optionnel)" className="rounded-xl border border-line px-3.5 py-2.5 text-[14px] outline-none focus:border-accent" />
          </div>
          <button onClick={submitConduce} disabled={conduceBusy || !conduceNumber.trim()}
            className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-navy text-[14px] font-bold text-white transition hover:bg-navy/90 disabled:opacity-50 sm:w-auto sm:px-6">
            <PackagePlus size={16} /> {conduceBusy ? "Enregistrement…" : "Enregistrer"}
          </button>
          {conduceMessage && (
            <p className={`mt-3 rounded-lg px-3 py-2 text-[13px] ${conduceMessage.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              {conduceMessage.text}
            </p>
          )}
        </section>

        <p className="mt-4 flex items-center gap-1.5 text-[11.5px] text-mute">
          <Package size={12} /> Les colis de la Conduce sont ajoutés automatiquement par l&apos;import MCPACK habituel.
        </p>
      </div>
    </div>
  );
}
