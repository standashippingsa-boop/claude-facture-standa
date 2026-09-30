"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { CheckCircle2, Package, RotateCcw, Search, X } from "lucide-react";
import { dateFr } from "@/lib/utils";

import { useNoticeToast } from "@/lib/notify";
/**
 * STANDA COMMERCIAL — BWAT TRACKING PIBLIK
 * ═════════════════════════════════════════
 * Vizitè a tape yon nimewo tracking epi li wè kote koli l ye — SAN KONEKTE.
 *
 * ⚠️ SEKIRITE — KIJAN SA MACHE:
 *   Konpozan sa a PA janm rele Supabase. Li rele /api/track sèlman, ki kouri
 *   sou sèvè Vercel la. Sèvè a chwazi 6 kolòn epi li voye yo tounen.
 *   Non kliyan, KÒD KLIYAN, adrès, telefòn, pri, fakti — yo pa janm kite
 *   sèvè a (yo pa menm nan repons lan): pa gen anyen pou "kache" isit la.
 *
 *   ❌ PA JANM enpòte `supabase` nan fichye sa a. Si yon jou yon moun fè sa
 *      pou "al pi vit", tout done kliyan yo ta vwayaje nan navigatè vizitè a.
 *
 * Rate limit la (10 rechèch / 5 min) jere sou sèvè a — pa isit.
 */

/** Etap vwayaj yon koli, nan lòd — pou liy pwogrè a. */
const STEPS: Array<{ status: string; text: string }> = [
  { status: "Reçu à Miami", text: "Votre colis est arrivé à notre dépôt de Miami." },
  { status: "En préparation", text: "Votre colis est préparé pour l’expédition vers Haïti." },
  { status: "En transit", text: "Votre colis voyage vers Haïti." },
  { status: "Arrivé en Haïti", text: "Votre colis est arrivé en Haïti." },
  { status: "En route vers agence", text: "Votre colis est en route vers votre agence." },
  { status: "Disponible", text: "Votre colis vous attend à votre agence : vous pouvez venir le récupérer." },
  { status: "Livré", text: "Votre colis vous a été remis." },
];

/** "Facturé" = fakti kolekte a pare, koli a toujou disponib nan ajans lan. */
function stepIndex(status: string): number {
  const s = status === "Facturé" ? "Disponible" : status;
  return STEPS.findIndex((step) => step.status === s);
}

type Found = {
  tracking_number: string;
  tracking_manual: string;
  status: string;
  weight: number;
  created_date: string;
  received_at: string | null;
};

export default function TrackBox() {
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Found | null>(null);
  const [message, setMessage] = useState("");
  useNoticeToast(message, setMessage, { tone: "error", title: "Suivi indisponible" });

  async function search() {
    const q = value.trim();
    if (!q || busy) return;

    setBusy(true);
    setResult(null);
    setMessage("");

    try {
      const res = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracking: q })
      });

      // 429 = twòp rechèch (rate limit sèvè a)
      if (res.status === 429) {
        setMessage("Trop de recherches. Patientez quelques minutes puis réessayez.");
        return;
      }

      const data = await res.json();

      if (data?.ok && data?.found && data?.package) {
        setResult(data.package as Found);
      } else {
        setMessage(data?.reason || "Aucun colis trouvé avec ce numéro.");
      }
    } catch {
      setMessage("Connexion impossible. Vérifiez votre internet et réessayez.");
    } finally {
      setBusy(false);
    }
  }

  /** Efase nimewo a EPI rezilta a — pou yon lòt rechèch. */
  function clearAll() {
    setValue("");
    setResult(null);
    setMessage("");
    input.current?.focus();
  }

  /** Fèmen rezilta a / mesaj la (nimewo a rete nan chan an). */
  function closeResult() {
    setResult(null);
    setMessage("");
  }

  return (
    <div className="w-full">

      {/* ══════════ FÒM LAN ══════════ */}
      <form
        onSubmit={(e) => { e.preventDefault(); void search(); }}
        className="bg-white rounded-2xl shadow-lift p-4 sm:p-5"
      >
        <div className="flex items-center gap-2.5 mb-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-light text-accent-dark">
            <Package size={18} />
          </span>
          <div>
            <label htmlFor="track-input" className="block text-[15px] font-bold text-navy leading-tight">
              Suivre un colis
            </label>
            <p className="text-[12px] text-mute">Sans compte · résultat immédiat</p>
          </div>
        </div>

        {/* Sou telefòn: anpile. Sou òdinatè: kòt a kòt. */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mute" />
            <input
              ref={input}
              id="track-input"
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Collez votre numéro de tracking"
              className="w-full h-12 pl-10 pr-11 rounded-xl border border-line bg-mist
                         text-[15px] text-ink placeholder:text-mute font-mono tracking-wide
                         focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent
                         focus:bg-white transition"
            />
            {value && (
              <button
                type="button"
                onClick={clearAll}
                aria-label="Effacer le numéro de tracking"
                title="Effacer"
                className="absolute right-2 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center
                           rounded-lg text-mute hover:bg-slate-200 hover:text-navy transition"
              >
                <X size={17} />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={busy || !value.trim()}
            className="h-12 px-6 rounded-xl bg-accent hover:bg-accent-dark
                       disabled:bg-slate-300 disabled:cursor-not-allowed
                       text-white font-bold text-[15px] transition
                       inline-flex items-center justify-center gap-2 shrink-0"
          >
            {busy ? (
              <>
                <span className="inline-block h-4 w-4 rounded-full border-2
                                 border-white/40 border-t-white animate-spin" />
                Recherche…
              </>
            ) : "Suivre"}
          </button>
        </div>

        <p className="mt-2.5 text-[12px] text-mute leading-relaxed">
          Numéro Standa (WR…) ou numéro du transporteur (UPS, FedEx, USPS, Amazon…).
        </p>
      </form>

      {/* ══════════ MESAJ (pa jwenn / erè) ══════════ */}

      {/* ══════════ REZILTA ══════════ */}
      {result && <ResultCard result={result} onClose={closeResult} onNewSearch={clearAll} />}
    </div>
  );
}

function ResultCard({ result, onClose, onNewSearch }: { result: Found; onClose: () => void; onNewSearch: () => void }) {
  const current = stepIndex(result.status);
  const delivered = result.status === "Livré";

  return (
    <div className="mt-3 bg-white rounded-2xl shadow-lift overflow-hidden">

      {/* Tèt: nimewo a + bouton pou fèmen */}
      <div className="flex items-start justify-between gap-3 px-4 sm:px-5 pt-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-mute">Colis trouvé</p>
          <p className="mt-0.5 font-mono text-[14px] font-bold text-navy break-all">{result.tracking_number || "—"}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-mute
                     hover:bg-mist hover:text-navy transition"
        >
          <X size={15} /> Fermer
        </button>
      </div>

      {/* Statut aktyèl la + sa l vle di */}
      <div className="px-4 sm:px-5 pt-3 pb-4 border-b border-line">
        <span className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[14px] font-bold ring-1
          ${delivered ? "bg-slate-100 text-slate-700 ring-slate-300" : "bg-accent-light text-accent-dark ring-accent/30"}`}>
          <span className="w-2 h-2 rounded-full bg-current" />
          {result.status === "Facturé" ? "Disponible" : (result.status || "—")}
        </span>
        {current >= 0 && <p className="mt-2 text-[13px] leading-relaxed text-ink">{STEPS[current].text}</p>}
      </div>

      {/* Liy pwogrè: 7 etap, soti Miami rive nan remiz */}
      {current >= 0 && (
        <ol className="px-4 sm:px-5 py-4 border-b border-line space-y-0">
          {STEPS.map((step, i) => {
            const done = i < current || (i === current && delivered);
            const active = i === current && !delivered;
            return (
              <li key={step.status} className="relative flex items-center gap-3 pb-3 last:pb-0">
                {i < STEPS.length - 1 && (
                  <span aria-hidden="true"
                    className={`absolute left-[9px] top-5 h-[calc(100%-10px)] w-0.5 ${i < current ? "bg-accent" : "bg-line"}`} />
                )}
                <span className={`relative z-10 grid h-5 w-5 shrink-0 place-items-center rounded-full
                  ${done ? "bg-accent text-white" : active ? "bg-white ring-4 ring-accent/25 border-2 border-accent" : "bg-white border-2 border-line"}`}>
                  {done && <CheckCircle2 size={13} strokeWidth={3} />}
                </span>
                <span className={`text-[13px] ${active ? "font-bold text-navy" : done ? "font-semibold text-ink" : "text-mute"}`}>
                  {step.status}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {/* Detay yo — PA GEN kòd kliyan (sèvè a pa voye l ditou). */}
      <dl className="divide-y divide-line">
        {result.tracking_manual && result.tracking_manual !== result.tracking_number && (
          <Row label="Référence transporteur" value={result.tracking_manual} mono />
        )}
        {result.weight > 0 && <Row label="Poids" value={`${result.weight} lb`} />}
        {result.received_at
          ? <Row label="Reçu à Miami le" value={dateFr(result.received_at)} />
          : result.created_date && <Row label="Enregistré le" value={dateFr(result.created_date)} />}
      </dl>

      {/* Aksyon yo */}
      <div className="bg-mist px-4 sm:px-5 py-4 border-t border-line">
        <button
          type="button"
          onClick={onNewSearch}
          className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-white ring-1 ring-line
                     text-navy font-bold text-[14px] hover:ring-accent transition"
        >
          <RotateCcw size={15} /> Nouvelle recherche
        </button>
        <p className="mt-3 text-[13px] text-ink leading-relaxed">
          <span className="font-bold">Pas encore de compte ?</span>{" "}
          Créez-en un gratuitement pour recevoir votre adresse à Miami et suivre tous vos colis au même endroit.{" "}
          <Link href="/inscription" className="font-bold text-accent-dark underline underline-offset-2">Créer mon compte</Link>
        </p>
      </div>
    </div>
  );
}

/** Yon liy detay nan kat rezilta a */
function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="px-4 sm:px-5 py-3 flex items-start justify-between gap-4">
      <dt className="text-[13px] text-mute shrink-0">{label}</dt>
      <dd className={`text-[14px] font-semibold text-ink text-right break-all ${mono ? "font-mono text-[13px]" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
