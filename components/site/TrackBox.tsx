"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { RotateCcw, X } from "lucide-react";
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

      {/* ══════════ FÒM LAN — menm prensip ak USPS: yon chan, yon bouton ══════════ */}
      <form
        onSubmit={(e) => { e.preventDefault(); void search(); }}
        className="bg-white p-5 sm:p-6"
      >
        <label htmlFor="track-input" className="block text-[22px] font-bold leading-tight text-navy">
          Suivre un colis
        </label>
        <p className="mt-1 text-[14px] text-ink">Encodez votre numéro de suivi.</p>

        {/* Sou telefòn: anpile. Sou òdinatè: kòt a kòt. */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
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
              className="h-12 w-full border border-slate-500 bg-white pl-3 pr-11
                         font-mono text-[15px] text-ink
                         focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
            {value && (
              <button
                type="button"
                onClick={clearAll}
                aria-label="Effacer le numéro de suivi"
                title="Effacer"
                className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center
                           text-mute hover:text-navy"
              >
                <X size={17} />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={busy || !value.trim()}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 bg-navy px-8
                       text-[15px] font-bold text-white transition-colors hover:bg-navy-dark
                       disabled:cursor-not-allowed disabled:bg-slate-400"
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

        <p className="mt-2.5 text-[12px] leading-relaxed text-mute">
          Numéro Standa ou numéro du transporteur.
        </p>
      </form>

      {/* ══════════ REZILTA ══════════ */}
      {result && <ResultCard result={result} onClose={closeResult} onNewSearch={clearAll} />}
    </div>
  );
}

function ResultCard({ result, onClose, onNewSearch }: { result: Found; onClose: () => void; onNewSearch: () => void }) {
  const current = stepIndex(result.status);
  const delivered = result.status === "Livré";
  const label = result.status === "Facturé" ? "Disponible" : (result.status || "·");
  // Istorik la: etap koli a deja pase yo, pi resan an anlè (tankou USPS).
  const history = current >= 0 ? STEPS.slice(0, current + 1).reverse() : [];
  const receivedDate = result.received_at ? dateFr(result.received_at) : "";

  return (
    <div className="mt-px bg-white">

      {/* Tèt: nimewo a + bouton pou fèmen */}
      <div className="flex items-start justify-between gap-3 border-t border-line px-5 pt-5 sm:px-6">
        <div className="min-w-0">
          <p className="text-[13px] text-mute">Numéro de suivi :</p>
          <p className="mt-0.5 break-all font-mono text-[15px] font-bold text-ink">{result.tracking_number || "·"}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex shrink-0 items-center gap-1 text-[13px] font-bold text-navy underline-offset-2 hover:underline"
        >
          <X size={15} /> Fermer
        </button>
      </div>

      {/* Statut aktyèl la an gwo + sa l vle di */}
      <div className="px-5 pb-5 pt-4 sm:px-6">
        <p className="text-[13px] text-mute">Dernier statut</p>
        <p className={`mt-1 text-[26px] font-bold leading-tight ${delivered ? "text-green-700" : "text-navy"}`}>{label}</p>
        {current >= 0 && <p className="mt-2 text-[14px] leading-relaxed text-ink">{STEPS[current].text}</p>}

        {/* Ba pwogrè: yon segman pa etap, soti Miami rive nan remiz */}
        {current >= 0 && (
          <div className="mt-5">
            <div className="flex gap-1" role="img" aria-label={`Étape ${current + 1} sur ${STEPS.length}`}>
              {STEPS.map((step, i) => (
                <span key={step.status} className={`h-2 flex-1 ${i <= current ? (delivered ? "bg-green-700" : "bg-navy") : "bg-slate-200"}`} />
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[12px] text-mute">
              <span>Miami</span>
              <span>Livré</span>
            </div>
          </div>
        )}
      </div>

      {/* Istorik: etap ki fèt yo, pi resan an anlè */}
      {history.length > 0 && (
        <div className="border-t border-line px-5 py-5 sm:px-6">
          <h3 className="text-[16px] font-bold text-navy">Historique du suivi</h3>
          <ol className="mt-4">
            {history.map((step, i) => (
              <li key={step.status} className="relative flex gap-3 pb-4 last:pb-0">
                {i < history.length - 1 && <span aria-hidden="true" className="absolute left-[5px] top-4 h-full w-0.5 bg-slate-300" />}
                <span className={`relative z-10 mt-1 h-3 w-3 shrink-0 rounded-full ${i === 0 ? (delivered ? "bg-green-700" : "bg-navy") : "bg-slate-400"}`} />
                <div className="min-w-0">
                  <p className={`text-[14px] text-ink ${i === 0 ? "font-bold" : "font-semibold"}`}>{step.status}</p>
                  <p className="text-[13px] leading-relaxed text-mute">{step.text}</p>
                  {step.status === "Reçu à Miami" && receivedDate && <p className="text-[13px] text-mute">{receivedDate}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Detay yo — PA GEN kòd kliyan (sèvè a pa voye l ditou). */}
      <dl className="divide-y divide-line border-t border-line">
        {result.tracking_manual && result.tracking_manual !== result.tracking_number && (
          <Row label="Référence transporteur" value={result.tracking_manual} mono />
        )}
        {result.weight > 0 && <Row label="Poids" value={`${result.weight} lb`} />}
        {result.received_at
          ? <Row label="Reçu à Miami le" value={dateFr(result.received_at)} />
          : result.created_date && <Row label="Enregistré le" value={dateFr(result.created_date)} />}
      </dl>

      {/* Aksyon yo */}
      <div className="border-t border-line bg-mist px-5 py-4 sm:px-6">
        <button
          type="button"
          onClick={onNewSearch}
          className="inline-flex h-11 items-center justify-center gap-2 border border-navy bg-white px-5
                     text-[14px] font-bold text-navy transition-colors hover:bg-navy hover:text-white"
        >
          <RotateCcw size={15} /> Nouvelle recherche
        </button>
        <p className="mt-3 text-[13px] leading-relaxed text-ink">
          <span className="font-bold">Pas encore de compte ?</span>{" "}
          Créez votre compte gratuitement pour recevoir votre adresse à Miami et suivre tous vos colis au même endroit.{" "}
          <Link href="/inscription" className="font-bold text-navy underline underline-offset-2">Créer mon compte</Link>
        </p>
      </div>
    </div>
  );
}

/** Yon liy detay nan kat rezilta a */
function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="px-5 sm:px-6 py-3 flex items-start justify-between gap-4">
      <dt className="text-[13px] text-mute shrink-0">{label}</dt>
      <dd className={`text-[14px] font-semibold text-ink text-right break-all ${mono ? "font-mono text-[13px]" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
