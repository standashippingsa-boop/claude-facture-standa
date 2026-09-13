"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, HandCoins, Link2, Loader2, Users } from "lucide-react";
import Logo from "@/components/Logo";

/**
 * PWOGRAM AFFILIATION — fòm kandidati (lyen PRIVE).
 * ═══════════════════════════════════════════════════════════════════════
 * Paj sa a PA nan menu piblik sit la (STANDA vle envite moun li chwazi
 * dirèkteman, pa louvri l bay tout piblik la — gade lib/access.ts).
 * Yo POKO fè okenn lekti bazdone: fòm lan poste bay /api/affiliates-apply
 * (sèvè, service role) — pa gen enpòtasyon @/lib/db ni @/lib/supabase isit
 * la, donk zewo risk izolasyon menm san paj la nan lis ZONES verifye a.
 */
const ID_TYPES = ["Carte d'identité nationale", "Passeport", "Permis de conduire"] as const;

const BENEFITS = [
  { icon: Link2, title: "Un lien unique", text: "Partagez votre lien personnel — chaque client qui l'utilise vous reste attaché." },
  { icon: HandCoins, title: "Une commission par facture", text: "Vous êtes payé pour chaque facture générée par vos filleuls, pendant la durée de votre contrat." },
  { icon: Users, title: "Un espace pour suivre vos gains", text: "Un accès personnel montre vos filleuls et vos commissions en temps réel." }
];

export default function AffiliationPage() {
  const [f, setF] = useState({
    fullname: "", email: "", phone: "", whatsapp: "", city: "",
    id_type: "" as string, id_number: "", motivation: "", website: ""
  });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!f.fullname.trim() || !f.email.trim() || !f.phone.trim() || !f.id_type || !f.id_number.trim()) {
      setError("Merci de remplir tous les champs obligatoires.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/affiliates-apply", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f)
      });
      const j = await res.json();
      if (!j.ok) { setError(j.reason || "Une erreur est survenue."); return; }
      setSent(true);
    } catch {
      setError("Impossible d'envoyer votre candidature. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#061937] text-white">
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
        <Link href="/accueil" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/75 transition hover:text-white">
          <ArrowLeft size={15} /> Retour au site
        </Link>

        <div className="mt-8 flex items-center gap-3">
          <Logo size={40} rounded="rounded-xl" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.18em] text-orange-200">Programme Affiliation</p>
            <h1 className="text-[26px] font-black tracking-[-.03em] sm:text-[32px]">Devenez affilié STANDA COMMERCIAL</h1>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-white/15 bg-white/[.06] p-4 backdrop-blur-md">
              <Icon size={20} className="text-orange-300" />
              <p className="mt-3 text-[14px] font-bold">{title}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-white/70">{text}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-[1.75rem] border border-white/15 bg-white/[.08] p-5 backdrop-blur-2xl sm:p-7">
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 size={40} className="text-emerald-300" />
              <h2 className="text-[19px] font-bold">Candidature envoyée</h2>
              <p className="max-w-sm text-[13.5px] text-white/75">
                Merci ! Notre équipe va étudier votre candidature. Si elle est acceptée, vous recevrez un e-mail avec votre lien, votre contrat et vos accès.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
              {/* Honeypot anti-bot — envizib pou moun */}
              <input type="text" name="website" value={f.website} onChange={set("website")} autoComplete="off" tabIndex={-1}
                className="hidden" aria-hidden="true" />

              <Field label="Nom complet *"><Input value={f.fullname} onChange={set("fullname")} required /></Field>
              <Field label="E-mail *"><Input type="email" value={f.email} onChange={set("email")} required /></Field>
              <Field label="Téléphone *"><Input value={f.phone} onChange={set("phone")} required /></Field>
              <Field label="WhatsApp (si différent)"><Input value={f.whatsapp} onChange={set("whatsapp")} /></Field>
              <Field label="Ville / zone"><Input value={f.city} onChange={set("city")} /></Field>
              <Field label="Type de pièce d'identité *">
                <select value={f.id_type} onChange={set("id_type")} required
                  className="w-full rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-[14px] text-white outline-none focus:border-orange-300">
                  <option value="" className="text-navy">Choisir…</option>
                  {ID_TYPES.map((t) => <option key={t} value={t} className="text-navy">{t}</option>)}
                </select>
              </Field>
              <Field label="Numéro de la pièce *"><Input value={f.id_number} onChange={set("id_number")} required /></Field>
              <div className="sm:col-span-2">
                <Field label="Pourquoi voulez-vous devenir affilié ? (optionnel)">
                  <textarea value={f.motivation} onChange={set("motivation")} rows={3}
                    className="w-full rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-[14px] text-white outline-none placeholder:text-white/40 focus:border-orange-300" />
                </Field>
              </div>

              {error && <p className="sm:col-span-2 rounded-xl bg-red-500/15 px-3.5 py-2.5 text-[13px] text-red-200">{error}</p>}

              <button type="submit" disabled={busy}
                className="sm:col-span-2 mt-1 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-orange-500 text-[14px] font-bold text-white transition hover:-translate-y-0.5 hover:bg-orange-600 disabled:opacity-60">
                {busy && <Loader2 size={16} className="animate-spin" />} {busy ? "Envoi en cours…" : "Envoyer ma candidature"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[12px] font-semibold text-white/70">{label}</span>{children}</label>;
}
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props}
    className="w-full rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-[14px] text-white outline-none placeholder:text-white/40 focus:border-orange-300" />;
}
