"use client";

import Link from "next/link";
import { useState } from "react";
import { dateFr } from "@/lib/utils";

/**
 * STANDA COMMERCIAL — BWAT TRACKING PIBLIK
 * ═════════════════════════════════════════
 * Vizitè a tape yon nimewo tracking epi li wè kote koli l ye — SAN KONEKTE.
 *
 * ⚠️ SEKIRITE — KIJAN SA MACHE:
 *   Konpozan sa a PA janm rele Supabase. Li rele /api/track sèlman, ki kouri
 *   sou sèvè Vercel la. Sèvè a chwazi 6 kolòn epi li voye yo tounen.
 *   Non kliyan, adrès, telefòn, pri, fakti — yo pa janm kite sèvè a.
 *
 *   ❌ PA JANM enpòte `supabase` nan fichye sa a. Si yon jou yon moun fè sa
 *      pou "al pi vit", tout done kliyan yo ta vwayaje nan navigatè vizitè a.
 *
 * Rate limit la (10 rechèch / 5 min) jere sou sèvè a — pa isit.
 */

/* ⚠️ "Disponible" itilize koulè AKSAN sit piblik la (orange), PA menm vèt
   ak dashboard admin lan ankò — desizyon itilizatè a, 2026-08-24. Si yon jou
   yo vle re-senkwonize de koulè yo, gade lib/branding.ts ak dashboard la. */
const STATUS_STYLES: Record<string, string> = {
  "Reçu à Miami": "bg-sky-50 text-sky-700 ring-sky-200",
  "En préparation": "bg-amber-50 text-amber-700 ring-amber-200",
  "En transit": "bg-indigo-50 text-indigo-700 ring-indigo-200",
  "Arrivé en Haïti": "bg-teal-50 text-teal-700 ring-teal-200",
  "En route vers agence": "bg-violet-50 text-violet-700 ring-violet-200",
  "Disponible": "bg-accent-light text-accent-dark ring-accent/30",
  "Facturé": "bg-blue-50 text-blue-700 ring-blue-200",
  "Livré": "bg-slate-100 text-slate-600 ring-slate-300"
};

type Found = {
  tracking_number: string;
  tracking_manual: string;
  status: string;
  weight: number;
  created_date: string;
  received_at: string | null;
};

export default function TrackBox() {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Found | null>(null);
  const [message, setMessage] = useState("");

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

  const statusCls =
    (result && STATUS_STYLES[result.status]) || "bg-slate-100 text-slate-600 ring-slate-300";

  return (
    <div className="w-full">

      {/* ══════════ FÒM LAN ══════════ */}
      <div className="bg-white rounded-2xl shadow-lift p-4 sm:p-5">
        <label htmlFor="track-input"
          className="block text-[13px] font-bold text-navy mb-2">
          Suivre un colis
        </label>

        {/* Sou telefòn: anpile. Sou òdinatè: kòt a kòt. */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            id="track-input"
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") search(); }}
            placeholder="Entrez votre numéro de tracking"
            className="flex-1 h-12 px-4 rounded-xl border border-line bg-mist
                       text-[15px] text-ink placeholder:text-mute
                       focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent
                       focus:bg-white transition"
          />
          <button
            type="button"
            onClick={search}
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
                Recherche...
              </>
            ) : "Suivre"}
          </button>
        </div>

        <p className="mt-2.5 text-[12px] text-mute leading-relaxed">
          Aucun compte nécessaire. Entrez le numéro complet de votre colis.
        </p>
      </div>

      {/* ══════════ MESAJ (pa jwenn / erè) ══════════ */}
      {message && (
        <div className="mt-3 rounded-xl bg-amber-50 ring-1 ring-amber-200 px-4 py-3.5">
          <p className="text-[14px] text-amber-800 leading-relaxed">{message}</p>
        </div>
      )}

      {/* ══════════ REZILTA ══════════ */}
      {result && (
        <div className="mt-3 bg-white rounded-2xl shadow-lift overflow-hidden">

          {/* Tèt: statut la — se enfòmasyon prensipal la */}
          <div className="px-4 sm:px-5 py-4 border-b border-line">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-mute mb-2">
              Statut du colis
            </p>
            <span className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5
                              text-[14px] font-bold ring-1 ${statusCls}`}>
              <span className="w-2 h-2 rounded-full bg-current" />
              {result.status || "—"}
            </span>
          </div>

          {/* Detay yo */}
          <dl className="divide-y divide-line">
            <Row label="Numéro de tracking" value={result.tracking_number || "—"} mono />

            {result.tracking_manual &&
             result.tracking_manual !== result.tracking_number && (
              <Row label="Référence transporteur" value={result.tracking_manual} mono />
            )}

            {result.weight > 0 && (
              <Row label="Poids" value={`${result.weight} lb`} />
            )}

            {result.created_date && (
              <Row label="Date d'enregistrement" value={dateFr(result.created_date)} />
            )}

            {result.received_at && (
              <Row label="Reçu le" value={dateFr(result.received_at)} />
            )}
          </dl>

          {/* Envitasyon pou kreye kont — moun sa a gentan gen yon koli */}
          <div className="bg-mist px-4 sm:px-5 py-4 border-t border-line">
            <p className="text-[13px] text-ink leading-relaxed">
              <span className="font-bold">Vous n&apos;avez pas encore de compte ?</span>{" "}
              Créez-en un gratuitement pour recevoir votre adresse de dépôt à Miami
              et suivre tous vos colis au même endroit.
            </p>
            <Link
              href="/inscription"
              className="mt-3 inline-flex items-center justify-center h-11 px-5
                         rounded-xl bg-navy hover:bg-navy-light text-white
                         font-bold text-[14px] transition"
            >
              Créer mon compte
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/** Yon liy detay nan kat rezilta a */
function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="px-4 sm:px-5 py-3.5 flex items-start justify-between gap-4">
      <dt className="text-[13px] text-mute shrink-0">{label}</dt>
      <dd className={`text-[14px] font-semibold text-ink text-right break-all
                      ${mono ? "font-mono text-[13px]" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
