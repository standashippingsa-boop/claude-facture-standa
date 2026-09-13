"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import {
  ArrowRight, BarChart3, Check, CheckCircle2, ChevronDown, CreditCard, Link2, MapPin,
  Loader2, Mail, MessageCircle, Phone, ShieldCheck, UserRound, type LucideIcon
} from "lucide-react";
import Logo from "@/components/Logo";

/** Page publique de candidature au programme d’affiliation. */
const ID_TYPES = ["Carte d’identité nationale", "Passeport", "Permis de conduire"] as const;

const BENEFITS: Array<{ icon: LucideIcon; title: string; text: string; tone: string }> = [
  { icon: Link2, title: "Lien personnel", text: "Votre lien unique à partager.", tone: "bg-sky-100 text-[#0c4c9a]" },
  { icon: CreditCard, title: "Commission par facture", text: "Une commission pour chaque facture admissible.", tone: "bg-orange-100 text-[#f05a1a]" },
  { icon: BarChart3, title: "Suivi de vos gains", text: "Consultez vos références et vos gains.", tone: "bg-sky-100 text-[#0c4c9a]" }
];

type AgencyCity = { name: string };

export default function AffiliationPage() {
  const [f, setF] = useState({
    fullname: "", email: "", phone: "", whatsapp: "", city: "",
    id_type: "" as string, id_number: "", motivation: "", website: ""
  });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cities, setCities] = useState<AgencyCity[]>([]);
  const [citiesState, setCitiesState] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    const controller = new AbortController();

    const loadCities = async () => {
      try {
        const response = await fetch("/api/public/agences", { signal: controller.signal });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(payload.cities)) throw new Error("Cities unavailable");

        const available = payload.cities.filter(
          (city: unknown): city is AgencyCity =>
            !!city && typeof city === "object" && typeof (city as AgencyCity).name === "string"
        );
        if (controller.signal.aborted) return;
        setCities(available);
        setCitiesState(available.length ? "ready" : "unavailable");
      } catch {
        if (controller.signal.aborted) return;
        setCities([]);
        setCitiesState("unavailable");
      }
    };

    void loadCities();
    return () => controller.abort();
  }, []);

  const set = (key: keyof typeof f) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF({ ...f, [key]: event.target.value });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!f.fullname.trim() || !f.email.trim() || !f.phone.trim() || !f.city || !f.id_type || !f.id_number.trim()) {
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
    <main className="relative min-h-screen overflow-hidden bg-[#eff8ff] font-sans tracking-[0.008em] text-[#09295e]">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/affiliation-background-v2.png')" }}
        aria-hidden="true"
      />

      <div className="relative mx-auto w-full max-w-xl px-4 py-4 pb-10 sm:px-6 sm:py-7">
        <header className="flex items-center gap-3 py-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <Logo size={48} rounded="rounded-xl" />
            <div className="min-w-0 leading-tight">
              <p className="text-[19px] font-extrabold tracking-[.055em] text-[#0a2b61]">STANDA</p>
              <p className="text-[10px] font-semibold tracking-[.2em] text-[#25497d]">COMMERCIAL</p>
            </div>
          </div>
        </header>

        <section className="relative mt-5 rounded-[2rem] border border-white/75 bg-white/55 px-5 pb-5 pt-6 shadow-[0_18px_45px_rgba(23,78,145,0.12)] backdrop-blur-[2px] sm:mt-7 sm:px-8 sm:pt-9">
          <div className="relative z-10 max-w-md">
            <p className="text-[11px] font-extrabold uppercase tracking-[.2em] text-[#ff671d]">Programme d’affiliation</p>
            <h1 className="mt-3 text-[34px] font-extrabold leading-[1.1] tracking-[-.03em] text-[#082861] sm:text-[45px]">
              Devenez affilié à STANDA COMMERCIAL.
            </h1>
            <p className="mt-5 text-[16px] font-normal leading-[1.75] tracking-[.012em] text-[#50698e] sm:text-[17px]">
              Partagez votre lien personnel. Recevez une commission pour chaque facture admissible.
            </p>
          </div>

        </section>

        <section className="relative z-10 mt-4 grid grid-cols-3 gap-2.5 sm:mt-5 sm:gap-3" aria-label="Avantages du programme">
          {BENEFITS.map(({ icon: Icon, title, text, tone }) => (
            <article key={title} className="rounded-2xl border border-white bg-white/95 p-3 text-center shadow-[0_10px_24px_rgba(29,76,137,0.08)] sm:rounded-3xl sm:p-4">
              <span className={`mx-auto grid h-10 w-10 place-items-center rounded-2xl ${tone} sm:h-12 sm:w-12`}><Icon size={20} /></span>
              <h2 className="mt-2.5 text-[12px] font-bold leading-snug tracking-[.012em] text-[#082861] sm:text-sm">{title}</h2>
              <p className="mt-1.5 text-[10px] leading-relaxed tracking-[.01em] text-[#657a9a] sm:text-xs">{text}</p>
            </article>
          ))}
        </section>

        <section id="formulaire-affiliation" className="relative z-10 mt-5 rounded-[1.8rem] border border-white bg-white p-4 shadow-[0_18px_45px_rgba(23,78,145,0.12)] sm:mt-7 sm:p-7">
          {sent ? (
            <div className="flex flex-col items-center gap-3 px-3 py-10 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-600"><CheckCircle2 size={31} /></span>
              <h2 className="text-xl font-extrabold tracking-[-.01em] text-[#09295e]">Candidature envoyée</h2>
              <p className="max-w-sm text-sm leading-[1.7] tracking-[.01em] text-[#5c7192]">Merci. Notre équipe examinera votre candidature et vous répondra par courriel.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {/* Champ invisible de protection contre les robots. */}
              <input type="text" name="website" value={f.website} onChange={set("website")} autoComplete="off" tabIndex={-1} className="hidden" aria-hidden="true" />

              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky-100 text-[#0a3d81]"><UserRound size={22} /></span>
                <div>
                  <h2 className="text-[24px] font-extrabold leading-tight tracking-[-.02em] text-[#082861] sm:text-[27px]">Vos renseignements</h2>
                  <p className="mt-1 text-[12px] leading-relaxed tracking-[.01em] text-[#647998] sm:text-sm">Remplissez le formulaire pour soumettre votre candidature.</p>
                </div>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-4">
                <FormField label="Nom complet" required><Input icon={UserRound} value={f.fullname} onChange={set("fullname")} placeholder="Votre nom complet" autoComplete="name" required /></FormField>
                <FormField label="Adresse courriel" required><Input icon={Mail} type="email" value={f.email} onChange={set("email")} placeholder="exemple@courriel.com" autoComplete="email" required /></FormField>
                <FormField label="Téléphone" required><Input icon={Phone} type="tel" value={f.phone} onChange={set("phone")} placeholder="(509) 0000-0000" autoComplete="tel" required /></FormField>
                <FormField label="WhatsApp (si différent)"><Input icon={MessageCircle} type="tel" value={f.whatsapp} onChange={set("whatsapp")} placeholder="Numéro WhatsApp" autoComplete="tel" /></FormField>
                <FormField label="Ville ou zone" required>
                  <DropdownField
                    icon={MapPin}
                    label="Ville ou zone"
                    value={f.city}
                    options={cities.map((city) => ({ value: city.name, label: city.name }))}
                    placeholder={citiesState === "loading" ? "Chargement des villes…" : citiesState === "unavailable" ? "Aucune agence active" : "Sélectionnez votre ville"}
                    disabled={citiesState !== "ready"}
                    onValueChange={(city) => setF((current) => ({ ...current, city }))}
                  />
                  {citiesState === "unavailable" && <span className="mt-1.5 block text-[11px] font-medium text-amber-700">Les villes ne sont pas disponibles pour le moment.</span>}
                </FormField>
                <FormField label="Type de pièce d’identité" required>
                  <DropdownField
                    icon={CreditCard}
                    label="Type de pièce d’identité"
                    value={f.id_type}
                    options={ID_TYPES.map((type) => ({ value: type, label: type }))}
                    placeholder="Sélectionnez un type"
                    onValueChange={(id_type) => setF((current) => ({ ...current, id_type }))}
                  />
                </FormField>
                <FormField label="Numéro de pièce" required><Input icon={CreditCard} value={f.id_number} onChange={set("id_number")} placeholder="Numéro de pièce d’identité" required /></FormField>
                <div className="sm:col-span-2"><FormField label="Pourquoi souhaitez-vous devenir affilié? (facultatif)"><textarea value={f.motivation} onChange={set("motivation")} rows={3} placeholder="Parlez-nous brièvement de votre réseau ou de votre expérience." className="w-full resize-y rounded-xl border border-[#d4dfed] bg-white px-3.5 py-3 text-sm font-normal leading-relaxed tracking-[.01em] text-[#27466f] outline-none placeholder:text-[#9aabc2] transition focus:border-[#2563eb] focus:ring-4 focus:ring-blue-100" /></FormField></div>
              </div>

              {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700">{error}</p>}

              <button type="submit" disabled={busy} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#ff671d] px-5 text-[16px] font-bold tracking-[.012em] text-white shadow-[0_14px_22px_rgba(255,103,29,0.24)] transition hover:-translate-y-0.5 hover:bg-[#e85712] disabled:cursor-not-allowed disabled:opacity-60">
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
  return <label className="block"><span className="mb-1.5 block text-[13px] font-semibold tracking-[.012em] text-[#0b2d65]">{label}{required && <span className="ml-1 text-[#ff4f1f]">*</span>}</span>{children}</label>;
}

function Input({ icon: Icon, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { icon: LucideIcon }) {
  return <span className="relative block"><Icon size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7083a1]" /><input {...props} className={`h-12 w-full rounded-xl border border-[#d4dfed] bg-white py-2 pl-10 pr-3 text-[14px] font-normal tracking-[.01em] text-[#27466f] outline-none placeholder:text-[#9aabc2] transition focus:border-[#2563eb] focus:ring-4 focus:ring-blue-100 ${className}`} /></span>;
}

function DropdownField({ icon: Icon, label, value, options, placeholder, disabled = false, onValueChange }: {
  icon: LucideIcon;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return <span className="relative block">
    <button
      type="button"
      aria-label={label}
      aria-haspopup="listbox"
      aria-expanded={open}
      disabled={disabled}
      onClick={() => setOpen((current) => !current)}
      onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
      className="flex h-14 w-full items-center rounded-2xl border border-[#cbdcf1] bg-[#fbfdff] py-2 pl-2 pr-10 text-left text-[14px] font-normal tracking-[.01em] text-[#27466f] shadow-[0_3px_10px_rgba(37,99,235,0.04)] outline-none transition hover:border-[#9dbce3] focus:border-[#2563eb] focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#2563eb]"><Icon size={16} /></span>
      <span className={`ml-2.5 truncate ${selected ? "text-[#27466f]" : "text-[#9aabc2]"}`}>{selected?.label ?? placeholder}</span>
      <ChevronDown size={18} className={`absolute right-3 top-1/2 -translate-y-1/2 text-[#5e7599] transition ${open ? "rotate-180" : ""}`} />
    </button>
    {open && !disabled && <span role="listbox" aria-label={label} className="absolute z-30 mt-2 max-h-60 w-full overflow-y-auto rounded-2xl border border-[#d6e3f3] bg-white p-1.5 shadow-[0_18px_38px_rgba(23,78,145,0.18)]">
      {options.map((option) => {
        const isSelected = option.value === value;
        return <button key={option.value} type="button" role="option" aria-selected={isSelected} onClick={() => { onValueChange(option.value); setOpen(false); }} className={`flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm transition ${isSelected ? "bg-blue-50 font-semibold text-[#1454ac]" : "font-normal text-[#36577f] hover:bg-sky-50"}`}>
          {option.label}{isSelected && <Check size={16} strokeWidth={2.5} />}
        </button>;
      })}
    </span>}
  </span>;
}
