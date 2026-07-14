"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
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
  id_number: z.string().min(1, "Nimewo idantifikasyon obligatwa"),
  password: z.string().default(""),
  confirm: z.string().default("")
});

type Form = z.infer<typeof schema>;

export default function InscriptionPage() {
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [villes, setVilles] = useState<Ville[]>([]);
  const [oauthUid, setOauthUid] = useState<string | null>(null);   // Google/Apple: konplete pwofil sèlman
  const [oauthEmail, setOauthEmail] = useState("");
  useEffect(() => {
    // Si moun nan fenk konekte ak Google/Apple men li poko gen pwofil,
    // fòm sa a sèvi pou KONPLETE enskripsyon an (san modpas).
    supabase.auth.getUser().then(async ({ data }: { data: { user: { id: string; email?: string | null } | null } }) => {
      if (!data.user) return;
      const existing = await getClientByAuthId(data.user.id);
      if (!existing) { setOauthUid(data.user.id); setOauthEmail(data.user.email ?? ""); }
    }).catch(() => {});
  }, []);
  useEffect(() => {
    // Kliyan an chwazi vil li nan lis vil aktif yo (tab villes) — li pa ka tape yon vil ki pa egziste
    getVilles().then((v) => setVilles(v.filter((x) => x.active))).catch(() => setVilles([]));
  }, []);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } =
    useForm<Form>({ resolver: zodResolver(schema) });
  useEffect(() => { if (oauthEmail) setValue("email", oauthEmail); }, [oauthEmail, setValue]);

  const onSubmit = async (f: Form) => {
    if (!oauthUid) {
      if ((f.password ?? "").length < 6) { setErr("Modpas la dwe gen omwen 6 karaktè."); return; }
      if (f.password !== f.confirm) { setErr("De modpas yo pa menm."); return; }
    }
    setErr(null);
    try {
      let uid: string;
      if (oauthUid) {
        uid = oauthUid;   // kont Google/Apple la deja kreye — nou konplete pwofil la sèlman
      } else {
        const { data, error } = await supabase.auth.signUp({ email: f.email, password: f.password });
        if (error) throw error;
        if (!data.user?.id) throw new Error("Kreyasyon kont lan echwe — eseye ankò.");
        uid = data.user.id;
      }
      // Lyen otomatik ak tarification: vil kliyan an chwazi a se yon vil Paramètres
      const villeChoisie = villes.find((v) => v.name === f.city);
      await registerClientProfile({
        auth_user_id: uid,
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
            enfòmasyon ou yo epi aktive kont ou — w ap resevwa adrès depo ou Ozetazini
            sou WhatsApp lè kont lan fin aktive.
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
            {!oauthUid && <F name="password" label="Modpas *" type="password" />}
            {!oauthUid && <F name="confirm" label="Konfimasyon modpas *" type="password" />}
          </div>

          {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{err}</p>}

          <button type="submit" className="btn w-full justify-center py-3" disabled={isSubmitting}>
            {isSubmitting ? "Ap kreye kont lan..." : oauthUid ? "Konplete enskripsyon mwen" : "Kreye kont mwen"}
          </button>

          {!oauthUid && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-line" /><span className="text-xs text-slate-400">oswa</span><div className="flex-1 h-px bg-line" />
              </div>
              <button type="button"
                onClick={() => supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${SITE_URL}/inscription` } })}
                className="w-full flex items-center justify-center gap-2 border border-line rounded-lg py-2.5 text-sm font-semibold hover:bg-mist">
                <svg width="17" height="17" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                Continuer avec Google
              </button>
              <button type="button"
                onClick={() => supabase.auth.signInWithOAuth({ provider: "apple", options: { redirectTo: `${SITE_URL}/inscription` } })}
                className="w-full flex items-center justify-center gap-2 bg-black text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-black/85">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.86-3.08.43-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.43C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                Continuer avec Apple
              </button>
            </>
          )}

          <p className="text-center text-xs text-slate-500">
            Ou gen yon kont deja? <Link href="/login" className="text-navy font-semibold underline">Konekte</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
