import type { Metadata } from "next";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import { SITE } from "@/lib/site";
import { getAgences, Agence } from "@/lib/agences";

/**
 * STANDA COMMERCIAL — PAJ NOS AGENCES (PIBLIK)
 * ═══════════════════════════════════════════
 * Menm règ ak /accueil ak /contact:
 *   - Pa gen koneksyon obligatwa (li nan PUBLIC_PREFIXES nan lib/access.ts).
 *   - Header/Footer VINN nan components/site/ — PATAJE ak /accueil, /contact.
 *   - Enfòmasyon jeneral (WhatsApp/imèl/Instagram) soti nan SITE (lib/site.ts).
 *   - Lis ajans yo soti nan Supabase (lib/agences.ts) — pou modifye yon
 *     ajans, sèvi ak paj admin /settings/agences (PA touche fichye sa a).
 *   - SEO: layout.tsx jeneral la bloke endeksman; isit nou ranvèse règ la
 *     POU PAJ SA A SÈLMAN, menm jan ak /accueil ak /contact.
 */
export const metadata: Metadata = {
  title: "Nos agences — STANDA COMMERCIAL",
  description:
    "Retrouvez toutes les agences et points de retrait STANDA COMMERCIAL en Haïti : adresses, téléphones, WhatsApp et horaires d'ouverture.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/agences" }
};

// Rafrechi lis la a chak vizit (pa mete an kachèt twòp tan) — chanjman
// admin fè nan /settings/agences parèt vit sou sit piblik la.
export const revalidate = 60;

function mapsHref(a: Agence): string {
  const q = encodeURIComponent(`${a.nom}, ${a.adresse}, Haïti`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export default async function AgencesPage() {
  let agences: Agence[] = [];
  let loadError = false;
  try {
    agences = await getAgences();
  } catch {
    loadError = true;
  }

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      {/* ══════════════ BANYÈ TÈT PAJ LA ══════════════ */}
      <section className="relative bg-navy overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{
            background: "radial-gradient(70% 55% at 78% 8%, #E4650A 0%, transparent 62%)"
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 pt-12 pb-10 sm:pt-16 sm:pb-14">
          <span className="inline-flex items-center gap-2 rounded-full
                           bg-accent/15 ring-1 ring-accent/30 px-3 py-1.5
                           text-[12px] font-bold text-accent">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            {agences.length > 0 ? `${agences.length} agences en Haïti` : "Nos points de retrait"}
          </span>

          <h1 className="mt-4 text-[30px] leading-[1.15] sm:text-[42px] sm:leading-[1.1]
                         font-black text-white tracking-tight">
            Nos agences
          </h1>
          <p className="mt-3 text-[15px] sm:text-[17px] leading-relaxed text-white/75 max-w-lg">
            Retrouvez l&apos;agence STANDA COMMERCIAL la plus proche de vous : adresse,
            téléphone, WhatsApp et horaires d&apos;ouverture.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <a
              href={`tel:${SITE.whatsapp}`}
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl
                         bg-white/10 hover:bg-white/20 ring-1 ring-white/25
                         text-white font-bold text-[15px] transition"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
              </svg>
              {SITE.phone}
            </a>
            <a
              href={`https://wa.me/${SITE.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl
                         bg-[#25D366] hover:bg-[#1fb857] text-white font-bold text-[15px] transition shadow-lift"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.8 14.3c-.25.7-1.4 1.3-2 1.4-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-5-4.3-5.1-4.5-.15-.2-1.2-1.6-1.2-3.1 0-1.5.8-2.2 1.1-2.5.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5.25.6.8 2 .9 2.2.1.2.15.4 0 .6-.1.2-.2.3-.4.5-.2.2-.4.5-.5.6-.2.2-.4.4-.2.8.2.4.9 1.5 1.9 2.4 1.3 1.2 2.4 1.5 2.8 1.7.4.2.6.15.8-.1.2-.25.9-1 1.1-1.4.2-.4.4-.3.7-.2.3.1 1.9.9 2.2 1 .3.15.5.2.6.35.1.15.1.85-.15 1.55Z" />
              </svg>
              Écrire sur WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* ══════════════ LIS AJANS YO ══════════════ */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        {loadError && (
          <p className="mb-8 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-sm">
            Impossible de charger la liste des agences pour le moment. Contactez-nous directement
            par téléphone ou WhatsApp ci-dessus.
          </p>
        )}

        {!loadError && agences.length === 0 && (
          <p className="rounded-xl bg-mist border border-line text-mute px-4 py-6 text-sm text-center">
            Aucune agence n&apos;est disponible pour le moment.
          </p>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {agences.map((a) => (
            <AgenceCard key={a.id ?? a.nom} agence={a} />
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function AgenceCard({ agence: a }: { agence: Agence }) {
  const telHref = `tel:${a.telephone.replace(/[^\d+]/g, "")}`;
  const waHref = a.whatsapp ? `https://wa.me/${a.whatsapp}` : "";

  return (
    <div className="rounded-2xl overflow-hidden ring-1 ring-line shadow-card bg-white flex flex-col">
      <div className="bg-navy px-5 py-4">
        <h3 className="text-white font-bold text-[15px]">{a.nom}</h3>
      </div>

      <dl className="divide-y divide-line">
        <Row label="Adresse" value={a.adresse} />
        <Row label="Téléphone" value={a.telephone} />
        {a.horaire_1 && <Row label="Horaires" value={a.horaire_1} />}
        {a.horaire_2 && <Row label="" value={a.horaire_2} />}
      </dl>

      {a.note && (
        <p className="mx-5 mb-4 mt-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 text-[12.5px] leading-relaxed">
          {a.note}
        </p>
      )}

      <div className="mt-auto px-5 py-4 border-t border-line flex flex-wrap gap-2">
        <a
          href={telHref}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-bold
                     bg-navy/5 text-navy hover:bg-navy/10 transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
            <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
          </svg>
          Appeler
        </a>
        {waHref && (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-bold
                       bg-[#25D366]/10 text-[#128C4A] hover:bg-[#25D366]/20 transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.8 14.3c-.25.7-1.4 1.3-2 1.4-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-5-4.3-5.1-4.5-.15-.2-1.2-1.6-1.2-3.1 0-1.5.8-2.2 1.1-2.5.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5.25.6.8 2 .9 2.2.1.2.15.4 0 .6-.1.2-.2.3-.4.5-.2.2-.4.5-.5.6-.2.2-.4.4-.2.8.2.4.9 1.5 1.9 2.4 1.3 1.2 2.4 1.5 2.8 1.7.4.2.6.15.8-.1.2-.25.9-1 1.1-1.4.2-.4.4-.3.7-.2.3.1 1.9.9 2.2 1 .3.15.5.2.6.35.1.15.1.85-.15 1.55Z" />
            </svg>
            WhatsApp
          </a>
        )}
        <a
          href={mapsHref(a)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-bold
                     bg-mist text-navy hover:bg-line transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
            <path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 1 1 18 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          Google Maps
        </a>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-3 flex items-start justify-between gap-4">
      {label && <dt className="text-[13px] text-mute shrink-0">{label}</dt>}
      <dd className={`text-right break-words text-[13.5px] font-semibold text-ink ${!label ? "ml-auto" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
