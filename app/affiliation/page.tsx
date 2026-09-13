"use client";

import { useState, type ChangeEvent, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, BarChart3, CheckCircle2, CreditCard, Link2,
  Loader2, Mail, MapPin, MessageCircle, Phone, ShieldCheck, UserRound, type LucideIcon
} from "lucide-react";
import Logo from "@/components/Logo";

/** Page publique de candidature au programme d’affiliation. */
const ID_TYPES = ["Carte d’identité nationale", "Passeport", "Permis de conduire"] as const;

const BENEFITS: Array<{ icon: LucideIcon; title: string; text: string; tone: string }> = [
  { icon: Link2, title: "Lien personnel", text: "Votre lien unique à partager.", tone: "bg-sky-100 text-[#0c4c9a]" },
  { icon: CreditCard, title: "Commission par facture", text: "Une commission pour chaque facture admissible.", tone: "bg-orange-100 text-[#f05a1a]" },
  { icon: BarChart3, title: "Suivi de vos gains", text: "Consultez vos références et vos gains.", tone: "bg-sky-100 text-[#0c4c9a]" }
];

export default function AffiliationPage() {
  const [f, setF] = useState({
    fullname: "", email: "", phone: "", whatsapp: "", city: "",
    id_type: "" as string, id_number: "", motivation: "", website: ""
  });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof f) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF({ ...f, [key]: event.target.value });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!f.fullname.trim() || !f.email.trim() || !f.phone.trim() || !f.id_type || !f.id_number.trim()) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/affiliates-apply", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f)
      });
      const json = await response.json();
      if (!json.ok) { setError(json.reason || "Une erreur est survenue."); return; }
      setSent(true);
    } catch {
      setError("Impossible d’envoyer votre candidature. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#eff8ff] text-[#09295e]">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/affiliation-background-v2.png')" }}
        aria-hidden="true"
      />

      <div className="relative mx-auto w-full max-w-xl px-4 py-4 pb-10 sm:px-6 sm:py-7">
        <header className="flex items-center justify-between gap-3 py-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <Logo size={48} rounded="rounded-xl" />
            <div className="min-w-0 leading-tight">
              <p className="text-[19px] font-black tracking-[.04em] text-[#0a2b61]">STANDA</p>
              <p className="text-[10px] font-bold tracking-[.18em] text-[#25497d]">COMMERCIAL</p>
            </div>
          </div>
          <Link href="/accueil" className="inline-flex min-h-10 items-center gap-1 rounded-xl px-2 text-xs font-bold text-[#355582] transition hover:bg-white hover:text-[#0a2b61]">
            <ArrowLeft size={15} /> Retour
          </Link>
        </header>

        <section className="relative mt-5 rounded-[2rem] border border-white/75 bg-white/55 px-5 pb-5 pt-6 shadow-[0_18px_45px_rgba(23,78,145,0.12)] backdrop-blur-[2px] sm:mt-7 sm:px-8 sm:pt-9">
          <div className="relative z-10 max-w-md">
            <p className="text-[11px] font-black uppercase tracking-[.17em] text-[#ff671d]">Programme d’affiliation</p>
            <h1 className="mt-3 text-[34px] font-black leading-[1.04] tracking-[-.045em] text-[#082861] sm:text-[45px]">
              Devenez affilié à STANDA COMMERCIAL.
            </h1>
            <p className="mt-4 text-[16px] leading-relaxed text-[#50698e] sm:text-[17px]">
              Partagez votre lien personnel. Recevez une commission pour chaque facture admissible.
            </p>
          </div>

          <div className="relative z-10 mt-8 max-w-sm">
            <a href="#formulaire-affiliation" className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#ff671d] px-5 text-[16px] font-extrabold text-white shadow-[0_14px_22px_rgba(255,103,29,0.24)] transition hover:-translate-y-0.5 hover:bg-[#e85712] focus:outline-none focus:ring-4 focus:ring-orange-200">
              Soumettre ma candidature <ArrowRight size={19} />
            </a>
            <p className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-[#526b90]">
              <Mail size={18} className="text-[#0a3d81]" /> Inscription simple · Réponse par courriel
            </p>
          </div>
        </section>

        <section className="relative z-10 mt-4 grid grid-cols-3 gap-2.5 sm:mt-5 sm:gap-3" aria-label="Avantages du programme">
          {BENEFITS.map(({ icon: Icon, title, text, tone }) => (
            <article key={title} className="rounded-2xl border border-white bg-white/95 p-3 text-center shadow-[0_10px_24px_rgba(29,76,137,0.08)] sm:rounded-3xl sm:p-4">
              <span className={`mx-auto grid h-10 w-10 place-items-center rounded-2xl ${tone} sm:h-12 sm:w-12`}><Icon size={20} /></span>
              <h2 className="mt-2.5 text-[12px] font-extrabold leading-tight text-[#082861] sm:text-sm">{title}</h2>
              <p className="mt-1 text-[10px] leading-snug text-[#657a9a] sm:text-xs">{text}</p>
            </article>
          ))}
        </section>

        <section id="formulaire-affiliation" className="relative z-10 mt-5 rounded-[1.8rem] border border-white bg-white p-4 shadow-[0_18px_45px_rgba(23,78,145,0.12)] sm:mt-7 sm:p-7">
          {sent ? (
            <div className="flex flex-col items-center gap-3 px-3 py-10 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-600"><CheckCircle2 size={31} /></span>
              <h2 className="text-xl font-black text-[#09295e]">Candidature envoyée</h2>
              <p className="max-w-sm text-sm leading-relaxed text-[#5c7192]">Merci. Notre équipe examinera votre candidature et vous répondra par courriel.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {/* Champ invisible de protection contre les robots. */}
              <input type="text" name="website" value={f.website} onChange={set("website")} autoComplete="off" tabIndex={-1} className="hidden" aria-hidden="true" />

              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky-100 text-[#0a3d81]"><UserRound size={22} /></span>
                <div>
                  <h2 className="text-[24px] font-black tracking-[-.035em] text-[#082861] sm:text-[27px]">Vos renseignements</h2>
                  <p className="mt-0.5 text-[12px] text-[#647998] sm:text-sm">Remplissez le formulaire pour soumettre votre candidature.</p>
                </div>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-4">
                <FormField label="Nom complet" required><Input icon={UserRound} value={f.fullname} onChange={set("fullname")} placeholder="Votre nom complet" autoComplete="name" required /></FormField>
                <FormField label="Adresse courriel" required><Input icon={Mail} type="email" value={f.email} onChange={set("email")} placeholder="exemple@courriel.com" autoComplete="email" required /></FormField>
                <FormField label="Téléphone" required><Input icon={Phone} type="tel" value={f.phone} onChange={set("phone")} placeholder="(509) 0000-0000" autoComplete="tel" required /></FormField>
                <FormField label="WhatsApp (si différent)"><Input icon={MessageCircle} type="tel" value={f.whatsapp} onChange={set("whatsapp")} placeholder="Numéro WhatsApp" autoComplete="tel" /></FormField>
                <FormField label="Ville ou zone"><Input icon={MapPin} value={f.city} onChange={set("city")} placeholder="Votre ville ou zone" autoComplete="address-level2" /></FormField>
                <FormField label="Type de pièce d’identité" required>
                  <select value={f.id_type} onChange={set("id_type")} required className="h-12 w-full rounded-xl border border-[#d4dfed] bg-white px-3 text-[14px] font-medium text-[#27466f] outline-none transition focus:border-[#2563eb] focus:ring-4 focus:ring-blue-100">
                    <option value="">Sélectionnez un type</option>
                    {ID_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </FormField>
                <FormField label="Numéro de pièce" required><Input icon={CreditCard} value={f.id_number} onChange={set("id_number")} placeholder="Numéro de pièce d’identité" required /></FormField>
                <div className="sm:col-span-2"><FormField label="Pourquoi souhaitez-vous devenir affilié? (facultatif)"><textarea value={f.motivation} onChange={set("motivation")} rows={3} placeholder="Parlez-nous brièvement de votre réseau ou de votre expérience." className="w-full resize-y rounded-xl border border-[#d4dfed] bg-white px-3.5 py-3 text-sm text-[#27466f] outline-none placeholder:text-[#9aabc2] transition focus:border-[#2563eb] focus:ring-4 focus:ring-blue-100" /></FormField></div>
              </div>

              {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700">{error}</p>}

              <button type="submit" disabled={busy} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#ff671d] px-5 text-[16px] font-extrabold text-white shadow-[0_14px_22px_rgba(255,103,29,0.24)] transition hover:-translate-y-0.5 hover:bg-[#e85712] disabled:cursor-not-allowed disabled:opacity-60">
                {busy && <Loader2 size={18} className="animate-spin" />}{busy ? "Envoi en cours…" : "Soumettre ma candidature"}<ArrowRight size={19} />
              </button>
              <p className="flex items-center justify-center gap-1.5 text-center text-[11px] font-medium text-[#6a7e9c]"><ShieldCheck size={14} /> Vos renseignements sont protégés.</p>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

function FormField({ label, required = false, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[13px] font-extrabold text-[#0b2d65]">{label}{required && <span className="ml-1 text-[#ff4f1f]">*</span>}</span>{children}</label>;
}

function Input({ icon: Icon, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { icon: LucideIcon }) {
  return <span className="relative block"><Icon size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7083a1]" /><input {...props} className={`h-12 w-full rounded-xl border border-[#d4dfed] bg-white py-2 pl-10 pr-3 text-[14px] font-medium text-[#27466f] outline-none placeholder:text-[#9aabc2] transition focus:border-[#2563eb] focus:ring-4 focus:ring-blue-100 ${className}`} /></span>;
}
