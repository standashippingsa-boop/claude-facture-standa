"use client";
/*
 * STANDA COMMERCIAL — FÒM ENSKRIPSYON (konpozan pataje)
 * Menm fòm nan sèvi sou /login (onglè "Créer un compte").
 * Zewo dwaplikaj: yon sèl sous verite pou enskripsyon.
 */
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { registerClientProfile } from "@/lib/db";
import { safeMessage } from "@/lib/safeerror";

type PublicVille = { id: string; name: string };

const schema = z.object({
  fullname: z.string().min(1, "Le prénom est obligatoire"),
  surname: z.string().min(1, "Le nom est obligatoire"),
  email: z.string().email("L'adresse e-mail n'est pas valide"),
  phone: z.string().min(6, "Le téléphone est obligatoire"),
  whatsapp: z.string().min(6, "Le numéro WhatsApp est obligatoire"),
  country: z.string().min(1, "Le pays est obligatoire"),
  city: z.string().min(1, "Sélectionnez votre ville dans la liste"),
  address: z.string().min(1, "L'adresse est obligatoire"),
  id_type: z.enum(["Carte d'identité nationale", "Passeport"], { errorMap: () => ({ message: "Sélectionnez votre pièce d'identité" }) }),
  id_number: z.string().min(1, "Le numéro de pièce d'identité est obligatoire")
});

type Form = z.infer<typeof schema>;

export default function SignupForm({ onGoLogin }: { onGoLogin?: () => void }) {
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [villes, setVilles] = useState<PublicVille[]>([]);
  const [citiesState, setCitiesState] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    const controller = new AbortController();

    // Se sèvè a ki bay sèlman non vil aktif yo. Tarif ak lòt done entèn yo
    // rete pwoteje pa RLS, epi kliyan an pa ka wè yo nan navigatè li.
    const loadCities = async () => {
      try {
        const response = await fetch("/api/public/villes", { signal: controller.signal });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(payload.villes)) throw new Error("Cities unavailable");

        const available = payload.villes.filter(
          (city: unknown): city is PublicVille =>
            !!city
            && typeof city === "object"
            && typeof (city as PublicVille).id === "string"
            && typeof (city as PublicVille).name === "string"
        );

        if (controller.signal.aborted) return;
        setVilles(available);
        setCitiesState(available.length ? "ready" : "unavailable");
      } catch {
        if (controller.signal.aborted) return;
        setVilles([]);
        setCitiesState("unavailable");
      }
    };

    void loadCities();
    return () => controller.abort();
  }, []);
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (f: Form) => {
    setErr(null);
    try {
      // v9: kliyan an PA kreye modpas — kont Auth la ap kreye LÈ admin aktive l ak kòd MC a.
      // Lyen otomatik ak tarification: vil kliyan an chwazi a se yon vil Paramètres
      const villeChoisie = villes.find((v) => v.name === f.city);
      if (!villeChoisie) {
        setErr("Sélectionnez une ville dans la liste avant de continuer.");
        return;
      }
      await registerClientProfile({
        fullname: f.fullname.trim(),
        surname: f.surname.trim(),
        email: f.email.trim(),
        phone: f.phone.trim(),
        whatsapp: f.whatsapp.trim(),
        country: f.country.trim(),
        city: f.city,
        address: f.address.trim(),
        id_type: f.id_type,
        id_number: f.id_number.trim(),
        ville_id: villeChoisie.id
      });
      setDone(true);
    } catch (e: any) {
      setErr(e.message?.includes("already registered")
        ? "Cette adresse e-mail est déjà associée à un compte. Connectez-vous."
        : safeMessage(e));
    }
  };

  if (done) {
    return (
      <div className="rounded-[1.5rem] bg-white p-6 text-center shadow-[0_24px_60px_-36px_rgba(8,30,67,.55)] space-y-4">
        <div>
          <CheckCircle2 className="mx-auto text-emerald-500" size={52} />
          <h1 className="text-xl font-extrabold text-navy">Votre inscription a bien été reçue !</h1>
          <p className="text-sm text-slate-600">
            Votre compte est <b>en attente d&apos;activation</b>. L&apos;équipe STANDA COMMERCIAL
            vérifiera vos informations puis activera votre compte. Vous recevrez sur WhatsApp
            votre adresse de dépôt aux États-Unis, votre <b>nom d&apos;utilisateur (code MC)</b>
            et un <b>mot de passe temporaire</b> pour vous connecter.
          </p>
          <button type="button" onClick={onGoLogin} className="btn justify-center w-full">
            Accéder à la page de connexion
          </button>
        </div>
      </div>
    );
  }

  const F = ({ name, label, type = "text", placeholder = "", help = "" }: {
    name: keyof Form; label: string; type?: string; placeholder?: string; help?: string;
  }) => (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <input type={type} className="input mt-1" placeholder={placeholder} {...register(name)} />
      {help && <span className="text-[11px] text-slate-400">{help}</span>}
      {errors[name] && <span className="block text-xs text-red-600">{String(errors[name]!.message)}</span>}
    </label>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-[1.5rem] bg-white p-5 shadow-[0_24px_60px_-36px_rgba(8,30,67,.55)] md:p-7 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <F name="fullname" label="Prénom *" placeholder="Ex. : Jean" />
            <F name="surname" label="Nom *" placeholder="Ex. : Baptiste" />
            <F name="email" label="E-mail *" type="email" placeholder="vous@exemple.com" />
            <F name="phone" label="Téléphone *" placeholder="+509 ..." />
            <F name="whatsapp" label="Numéro WhatsApp *" placeholder="+509 ..." />
            <F name="country" label="Pays *" placeholder="Ex. : Haïti" />
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Ville *</span>
              <select
                className="input mt-1 text-ink"
                disabled={citiesState !== "ready"}
                aria-describedby="city-status"
                {...register("city")}
              >
                <option value="">
                  {citiesState === "loading" ? "Chargement des villes…" : "— Sélectionnez votre ville —"}
                </option>
                {villes.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
              </select>
              <span id="city-status" aria-live="polite" className="mt-1 block text-[11px] text-slate-500">
                {citiesState === "loading" && "La liste des villes est en cours de chargement."}
                {citiesState === "unavailable" && "La liste des villes est momentanément indisponible. Réessayez dans un instant."}
              </span>
              {errors.city && <span className="block text-xs text-red-600">{errors.city.message}</span>}
            </label>
          </div>

          <F name="address" label="Adresse *" placeholder="Rue ou quartier où vous habitez."
             help="Indiquez votre rue ou votre quartier." />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Pièce d&apos;identité *</span>
              <select className="input mt-1 text-ink" defaultValue="" {...register("id_type")}>
                <option className="bg-white text-ink" value="">— Sélectionnez —</option>
                <option className="bg-white text-ink" value="Carte d'identité nationale">Carte d&apos;identité nationale</option>
                <option className="bg-white text-ink" value="Passeport">Passeport</option>
              </select>
              {errors.id_type && <span className="text-xs text-red-600">{errors.id_type.message}</span>}
            </label>
            <F name="id_number" label="Numéro de pièce d&apos;identité *" placeholder="Numéro du passeport ou de la carte" />
          </div>

          {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{err}</p>}

          <button type="submit" className="btn w-full justify-center py-3" disabled={isSubmitting || citiesState !== "ready"}>
            {isSubmitting ? "Création du compte..." : citiesState === "loading" ? "Chargement des villes..." : "Créer mon compte"}
          </button>

      <p className="text-center text-xs text-slate-500">
        Vous avez déjà un compte ?{" "}
        <button type="button" onClick={onGoLogin} className="text-navy font-semibold underline">Se connecter</button>
      </p>
    </form>
  );
}
