"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { getVilles, registerClientProfile, getClientByAuthId } from "@/lib/db";
import { SITE_URL } from "@/lib/branding";
import { Ville } from "@/lib/types";

const schema = z.object({
  fullname: z.string().min(1, "Non obligatwa"),
  surname: z.string().min(1, "Siyati obligatwa"),
  email: z.string().email("Imèl pa valid"),
  phone: z.string().min(6, "Telefòn obligatwa"),
  whatsapp: z.string().min(6, "Nimewo WhatsApp obligatwa"),
  country: z.string().min(1, "Peyi obligatwa"),
  city: z.string().min(1, "Chwazi vil ou nan lis la"),
  city2: z.string().default(""),
  address: z.string().min(1, "Adrès obligatwa"),
  id_type: z.enum(["Kat Idantite Nasyonal", "Paspò"], { errorMap: () => ({ message: "Chwazi kalite idantifikasyon an" }) }),
  id_number: z.string().min(1, "Nimewo idantifikasyon obligatwa")
});

type Form = z.infer<typeof schema>;

export default function InscriptionPage() {
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [villes, setVilles] = useState<Ville[]>([]);
  useEffect(() => {
    // Kliyan an chwazi vil li nan lis vil aktif yo (tab villes) — li pa ka tape yon vil ki pa egziste
    getVilles().then((v) => setVilles(v.filter((x) => x.active))).catch(() => setVilles([]));
  }, []);
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (f: Form) => {
    setErr(null);
    try {
      // v9: kliyan an PA kreye modpas — kont Auth la ap kreye LÈ admin aktive l ak kòd MC a.
      // Lyen otomatik ak tarification: vil kliyan an chwazi a se yon vil Paramètres
      const villeChoisie = villes.find((v) => v.name === f.city);
      await registerClientProfile({
        fullname: f.fullname.trim(),
        surname: f.surname.trim(),
        email: f.email.trim(),
        phone: f.phone.trim(),
        whatsapp: f.whatsapp.trim(),
        country: f.country.trim(),
        city: f.city,
        city2: f.city2,
        address: f.address.trim(),
        id_type: f.id_type,
        id_number: f.id_number.trim(),
        ville_id: villeChoisie?.id ?? null
      });
      setDone(true);
    } catch (e: any) {
      setErr(e.message?.includes("already registered")
        ? "Imèl sa a gen yon kont deja. Eseye konekte pito."
        : "Erè: " + (e.message ?? String(e)));
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-mist flex items-center justify-center p-6">
        <div className="card p-8 max-w-md w-full text-center space-y-4">
          <CheckCircle2 className="mx-auto text-emerald-500" size={52} />
          <h1 className="text-xl font-extrabold text-navy">Enskripsyon ou resevwa!</h1>
          <p className="text-sm text-slate-600">
            Kont ou an <b>En attente d&apos;activation</b>. Ekip STANDA COMMERCIAL ap verifye
            enfòmasyon ou yo epi aktive kont ou — w ap resevwa sou WhatsApp: adrès depo ou
            Ozetazini, <b>nom d&apos;utilisateur ou (kòd MC ou)</b> ak yon <b>modpas tanporè</b>
            pou w konekte.
          </p>
          <Link href="/login" className="btn justify-center w-full">Ale nan paj koneksyon an</Link>
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
    <div className="min-h-screen bg-mist py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="STANDA COMMERCIAL" className="mx-auto h-20 object-contain" />
          <h1 className="text-2xl font-extrabold text-navy">Kreye kont ou</h1>
          <p className="text-sm text-slate-500">
            Ranpli fòm sa a — ekip nou an ap aktive kont ou epi voye adrès depo ou Ozetazini.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="card p-6 md:p-8 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <F name="fullname" label="Non *" placeholder="Ex: Jean" />
            <F name="surname" label="Siyati *" placeholder="Ex: Baptiste" />
            <F name="email" label="Imèl *" type="email" placeholder="ou@egzanp.com" />
            <F name="phone" label="Telefòn *" placeholder="+509 ..." />
            <F name="whatsapp" label="Nimewo WhatsApp *" placeholder="+509 ..." />
            <F name="country" label="Peyi *" placeholder="Ex: Haïti" />
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Vil *</span>
              <select className="input mt-1" {...register("city")}>
                <option value="">— Chwazi vil ou —</option>
                {villes.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
              </select>
              {errors.city && <span className="block text-xs text-red-600">{errors.city.message}</span>}
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">2yèm vil (opsyonèl)</span>
              <select className="input mt-1" {...register("city2")}>
                <option value="">— Okenn —</option>
                {villes.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
              </select>
            </label>
          </div>

          <F name="address" label="Adrès *" placeholder="Ruelle oswa katye kote ou rete."
             help="Ruelle oswa katye kote ou rete." />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Kalite idantifikasyon *</span>
              <select className="input mt-1" {...register("id_type")}>
                <option value="">— Chwazi —</option>
                <option value="Kat Idantite Nasyonal">Kat Idantite Nasyonal</option>
                <option value="Paspò">Paspò</option>
              </select>
              {errors.id_type && <span className="text-xs text-red-600">{errors.id_type.message}</span>}
            </label>
            <F name="id_number" label="Nimewo idantifikasyon *" placeholder="Nimewo paspò a oswa nimewo kat la" />
          </div>

          {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{err}</p>}

          <button type="submit" className="btn w-full justify-center py-3" disabled={isSubmitting}>
            {isSubmitting ? "Ap kreye kont lan..." : "Créer mon compte"}
          </button>

          <p className="text-center text-xs text-slate-500">
            Ou gen yon kont deja? <Link href="/login" className="text-navy font-semibold underline">Konekte</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
