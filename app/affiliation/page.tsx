"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import {
  ArrowRight, BarChart3, Check, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, CreditCard, Link2, MapPin,
  Loader2, Mail, MessageCircle, Phone, ShieldCheck, UserRound, X, type LucideIcon
} from "lucide-react";
import Logo from "@/components/Logo";

/** Page publique de candidature au programme d’affiliation. */
const ID_TYPES = ["Carte d’identité nationale", "Passeport", "Permis de conduire"] as const;

const BENEFITS: Array<{ icon: LucideIcon; title: string; text: string; tone: string }> = [
  { icon: Link2, title: "Lien personnel", text: "Votre lien unique à partager.", tone: "bg-sky-100 text-[#0c4c9a]" },
  { icon: CreditCard, title: "Commission par service", text: "Une commission pour chaque service admissible.", tone: "bg-orange-100 text-[#f05a1a]" },
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
  const [showProgramInfo, setShowProgramInfo] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const loadCities = async () => {
      try {
        // Cette liste provient du serveur et ne contient que les agences
        // actives; elle ne dépend donc pas de la clé publique du navigateur.
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
    <main className="affiliate-type relative min-h-screen overflow-hidden bg-[#eff8ff] text-[#09295e]">
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
              <p className="text-[19px] font-bold tracking-[.02em] text-[#0a2b61]">Standa</p>
              <p className="text-[11px] font-semibold tracking-[.06em] text-[#25497d]">Commercial</p>
            </div>
          </div>
        </header>

        <section className="relative mt-5 rounded-[2rem] border border-white/75 bg-white/55 px-5 pb-5 pt-6 shadow-[0_18px_45px_rgba(23,78,145,0.12)] backdrop-blur-[2px] sm:mt-7 sm:px-8 sm:pt-9">
          <div className="relative z-10 max-w-md">
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#ff671d]">Programme d’affiliation</p>
            <h1 className="mt-3 text-[33px] font-bold leading-[1.16] tracking-[-.025em] text-[#082861] sm:text-[44px]">
              Devenez affilié à Standa Commercial.
            </h1>
            <p className="mt-5 text-[15px] font-normal leading-[1.7] text-[#50698e] sm:text-[17px]">
              Partagez votre lien personnel. Recevez une commission pour chaque utilisation admissible du service.
            </p>
          </div>

        </section>

        <button
          type="button"
          onClick={() => setShowProgramInfo(true)}
          className="relative z-10 mt-4 flex w-full items-center gap-3 rounded-2xl border border-white bg-white/95 p-4 text-left shadow-[0_10px_24px_rgba(29,76,137,0.08)] transition hover:border-[#c6dcf7] hover:shadow-[0_14px_28px_rgba(29,76,137,0.12)]"
          aria-haspopup="dialog"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky-100 text-[#0d4b99]"><CircleHelp size={22} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-[#082861]">Comment fonctionne le programme?</span>
            <span className="mt-0.5 block text-[12px] leading-relaxed text-[#627a9d]">Découvrez Standa, votre rôle, les utilisations du service et les commissions.</span>
          </span>
          <ChevronRight size={21} className="shrink-0 text-[#6380a6]" />
        </button>

        <section className="relative z-10 mt-4 grid grid-cols-3 gap-2.5 sm:mt-5 sm:gap-3" aria-label="Avantages du programme">
          {BENEFITS.map(({ icon: Icon, title, text, tone }) => (
            <article key={title} className="rounded-2xl border border-white bg-white/95 p-3 text-center shadow-[0_10px_24px_rgba(29,76,137,0.08)] sm:rounded-3xl sm:p-4">
              <span className={`mx-auto grid h-10 w-10 place-items-center rounded-2xl ${tone} sm:h-12 sm:w-12`}><Icon size={20} /></span>
              <h2 className="mt-2.5 text-[12px] font-semibold leading-snug text-[#082861] sm:text-sm">{title}</h2>
              <p className="mt-1.5 text-[10px] leading-relaxed text-[#657a9a] sm:text-xs">{text}</p>
            </article>
          ))}
        </section>

        <section id="formulaire-affiliation" className="relative z-10 mt-5 rounded-[1.8rem] border border-white bg-white p-4 shadow-[0_18px_45px_rgba(23,78,145,0.12)] sm:mt-7 sm:p-7">
          {sent ? (
            <div className="flex flex-col items-center gap-3 px-3 py-10 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-600"><CheckCircle2 size={31} /></span>
              <h2 className="text-xl font-bold tracking-[-.01em] text-[#09295e]">Candidature envoyée</h2>
              <p className="max-w-sm text-sm leading-[1.7] text-[#5c7192]">Merci. Notre équipe examinera votre candidature et vous répondra par courriel.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {/* Champ invisible de protection contre les robots. */}
              <input type="text" name="website" value={f.website} onChange={set("website")} autoComplete="off" tabIndex={-1} className="hidden" aria-hidden="true" />

              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky-100 text-[#0a3d81]"><UserRound size={22} /></span>
                <div>
                  <h2 className="text-[24px] font-bold leading-tight tracking-[-.02em] text-[#082861] sm:text-[27px]">Vos renseignements</h2>
                  <p className="mt-1 text-[12px] leading-relaxed text-[#647998] sm:text-sm">Remplissez le formulaire pour soumettre votre candidature.</p>
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
                <div className="sm:col-span-2"><FormField label="Pourquoi souhaitez-vous devenir affilié? (facultatif)"><textarea value={f.motivation} onChange={set("motivation")} rows={3} placeholder="Parlez-nous brièvement de votre réseau ou de votre expérience." className="w-full resize-y rounded-xl border border-[#d4dfed] bg-white px-3.5 py-3 text-sm font-normal leading-relaxed text-[#27466f] outline-none placeholder:text-[#9aabc2] transition focus:border-[#2563eb] focus:ring-4 focus:ring-blue-100" /></FormField></div>
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

      {showProgramInfo && <ProgramInfoDialog onClose={() => setShowProgramInfo(false)} />}
    </main>
  );
}

function ProgramInfoDialog({ onClose }: { onClose: () => void }) {
  return <div role="dialog" aria-modal="true" aria-labelledby="programme-explique" className="fixed inset-0 z-50 flex items-end bg-[#061737]/55 p-0 sm:items-center sm:justify-center sm:p-5" onClick={onClose}>
    <section className="max-h-[88vh] w-full overflow-y-auto rounded-t-[2rem] bg-white px-5 pb-7 pt-5 shadow-2xl sm:max-w-xl sm:rounded-[2rem] sm:p-7" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.15em] text-[#ff671d]">Guide du programme</p>
          <h2 id="programme-explique" className="mt-2 text-[25px] font-bold leading-[1.18] tracking-[-.02em] text-[#082861] sm:text-[30px]">Le programme d’affiliation, en détail</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Fermer" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-[#385778] transition hover:bg-slate-200"><X size={20} /></button>
      </div>

      <section className="mt-4 rounded-2xl bg-[#0b3675] p-4 text-white">
        <p className="text-[11px] font-bold uppercase tracking-[.14em] text-sky-200">Standa Commercial, c’est quoi?</p>
        <p className="mt-2 text-[14px] leading-[1.7] text-white/90">
          Standa Commercial est un service d’expédition de colis des États-Unis vers Haïti. Le client reçoit une adresse de dépôt à Miami et un code personnel, suit ses colis, puis les récupère dans son agence en Haïti.
        </p>
      </section>

      <section className="mt-4">
        <h3 className="text-[17px] font-bold text-[#12386f]">Pourquoi ce programme existe?</h3>
        <p className="mt-1.5 text-[14px] leading-[1.7] text-[#516b90]">
          Standa Commercial veut développer son réseau par la recommandation de personnes de confiance. Le programme permet à un affilié de faire connaître le service dans son entourage, tout en recevant une commission lorsque les personnes qu’il a référées utilisent réellement le service.
        </p>
      </section>

      <section className="mt-4 rounded-2xl border border-[#e0eaf7] bg-white p-4 shadow-sm">
        <h3 className="text-[15px] font-semibold text-[#0b3778]">Avant de commencer</h3>
        <p className="mt-1.5 text-[13px] leading-[1.65] text-[#4f6b91]">
          Vous soumettez d’abord votre demande. Après l’approbation, vous recevez vos accès, votre lien personnel et votre contrat. C’est ce lien qui permet au système de reconnaître automatiquement les nouveaux clients que vous avez référés.
        </p>
        <p className="mt-2 text-[13px] leading-[1.65] text-[#4f6b91]">
          Pour être associé à votre dossier, le client doit ouvrir son compte à partir de votre lien. Votre espace vous permet ensuite de voir son avancement sans avoir à demander une vérification à l’équipe.
        </p>
      </section>

      <section className="mt-4 rounded-2xl border border-[#d7e7fb] bg-[#f7fbff] p-4">
        <h3 className="text-[15px] font-semibold text-[#0b3778]">Ce que vous aurez comme affilié</h3>
        <ul className="mt-2.5 space-y-2 text-[13px] leading-[1.55] text-[#4f6b91]">
          <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-[#2563eb]" />Un lien personnel à partager avec les personnes que vous recommandez.</li>
          <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-[#2563eb]" />Un espace affilié pour voir les comptes créés avec votre lien et leur progression.</li>
          <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-[#2563eb]" />Le suivi des commissions à recevoir et des commissions déjà payées.</li>
          <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-[#2563eb]" />Vos accès et votre contrat, qui présente les conditions de votre entente.</li>
        </ul>
      </section>

      <section className="mt-4">
        <h3 className="text-[17px] font-bold text-[#12386f]">Votre rôle comme affilié</h3>
        <p className="mt-1.5 text-[14px] leading-[1.7] text-[#516b90]">
          Votre rôle est simple : présenter Standa Commercial, partager votre lien et accompagner votre contact jusqu’à son inscription. Standa Commercial garde la responsabilité de l’adresse de Miami, de la réception, du suivi, de la tarification, des paiements et de la remise des colis.
        </p>
      </section>

      <h3 className="mt-5 text-[17px] font-bold text-[#12386f]">Voici exactement ce qui se passe</h3>

      <ol className="mt-3 space-y-4" aria-label="Étapes du programme d’affiliation">
        <ProgramStep number="1" title="Votre client crée son compte avec votre lien">
          Le client clique sur votre lien, puis remplit son inscription. Dès que son compte est créé, il apparaît dans votre espace avec le statut « Compte créé ». Il est bien rattaché à votre dossier, mais aucune commission n’est encore créée à cette étape.
        </ProgramStep>
        <ProgramStep number="2" title="Le client commence à utiliser le service">
          Le client reçoit son adresse de dépôt à Miami et son code personnel. Lorsqu’il envoie un premier colis à cette adresse et que le colis est pris en charge dans le système, un signe « Service commencé » apparaît dans votre dossier. Vous savez alors qu’il utilise réellement Standa Commercial.
        </ProgramStep>
        <ProgramStep number="3" title="Une utilisation confirmée ajoute votre commission">
          Lorsqu’une utilisation du service est confirmée par les opérations de Standa Commercial — par exemple, lors d’une expédition prise en charge ou d’un règlement confirmé — la commission prévue au contrat est ajoutée automatiquement à votre compte. Exemple : si la commission est de 10 USD, vous voyez 10 USD à recevoir.
        </ProgramStep>
        <ProgramStep number="4" title="Vous suivez les paiements">
          Dans votre espace affilié, vous voyez le nom et le code du client, son étape actuelle, les commissions à recevoir et les commissions déjà payées. La liste se met à jour automatiquement : vous n’avez pas besoin de créer ces suivis à la main.
        </ProgramStep>
      </ol>

      <section className="mt-5 rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
        <h3 className="text-[15px] font-semibold text-[#9a3a0e]">Comment la commission est comptée?</h3>
        <p className="mt-1.5 text-[13px] leading-[1.65] text-[#8a542f]">
          La commission ne se calcule pas pour chaque colis pris séparément. Elle correspond à une utilisation confirmée du service par un client que vous avez référé. Si plusieurs colis font partie de la même utilisation, ils ne créent pas plusieurs commissions. Si ce client utilise Standa Commercial de nouveau dans une autre utilisation confirmée, une nouvelle commission peut être ajoutée selon les conditions de votre contrat.
        </p>
      </section>

      <div className="mt-5 rounded-2xl border border-[#d7e7fb] bg-[#eef7ff] p-4">
        <h3 className="text-[14px] font-semibold text-[#0b3778]">À retenir</h3>
        <ul className="mt-2.5 space-y-2 text-[13px] leading-[1.55] text-[#4f6b91]">
          <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-[#2563eb]" />Créer un compte avec votre lien rattache le client à votre dossier, mais ne donne pas encore de commission.</li>
          <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-[#2563eb]" />La commission est créée lorsqu’une utilisation du service est confirmée, pendant que votre contrat est actif. Elle ne se calcule pas pour chaque colis séparément.</li>
          <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-[#2563eb]" />Vous n’avez pas à gérer les colis, les montants ou les remises : Standa Commercial s’en charge.</li>
          <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-[#2563eb]" />Les modalités de votre entente et de son renouvellement sont indiquées dans votre contrat.</li>
          <li className="flex gap-2"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-[#2563eb]" />Votre mot de passe et votre lien sont personnels : ne les partagez avec personne.</li>
        </ul>
      </div>
    </section>
  </div>;
}

function ProgramStep({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return <li className="flex gap-3">
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#0a3d81] text-[12px] font-bold text-white shadow-sm">{number}</span>
    <div className="min-w-0 pb-0.5">
      <h3 className="text-[15px] font-semibold leading-snug text-[#12386f]">{title}</h3>
      <p className="mt-1 text-[13px] leading-[1.6] text-[#607797]">{children}</p>
    </div>
  </li>;
}

function FormField({ label, required = false, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[13px] font-semibold text-[#0b2d65]">{label}{required && <span className="ml-1 text-[#ff4f1f]">*</span>}</span>{children}</label>;
}

function Input({ icon: Icon, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { icon: LucideIcon }) {
  return <span className="relative block"><Icon size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7083a1]" /><input {...props} className={`h-12 w-full rounded-xl border border-[#d4dfed] bg-white py-2 pl-10 pr-3 text-[14px] font-normal text-[#27466f] outline-none placeholder:text-[#9aabc2] transition focus:border-[#2563eb] focus:ring-4 focus:ring-blue-100 ${className}`} /></span>;
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
  const dropdownRef = useRef<HTMLSpanElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  return <span ref={dropdownRef} className="relative block">
    <button
      type="button"
      aria-label={label}
      aria-haspopup="listbox"
      aria-expanded={open}
      disabled={disabled}
      onClick={() => setOpen((current) => !current)}
      onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
      className="flex h-14 w-full items-center rounded-2xl border border-[#cbdcf1] bg-[#fbfdff] py-2 pl-2 pr-10 text-left text-[14px] font-normal text-[#27466f] shadow-[0_3px_10px_rgba(37,99,235,0.04)] outline-none transition hover:border-[#9dbce3] focus:border-[#2563eb] focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
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
