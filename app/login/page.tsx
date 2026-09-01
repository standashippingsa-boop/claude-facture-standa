"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, MapPin, PackageCheck, ShieldCheck, User } from "lucide-react";
import { clientSignInErrorMessage, signInClientWithCode } from "@/lib/authx";
import { normalizeMcCode } from "@/lib/utils";
import { SUPPORT_PHONE } from "@/lib/branding";
import PasswordInput from "@/components/PasswordInput";
import Logo from "@/components/Logo";
import AuthBackdrop from "@/components/site/AuthBackdrop";
import { WhatsAppIcon } from "@/components/site/BrandIcons";

const WA = `https://wa.me/${SUPPORT_PHONE.replace(/\D/g, "")}`;

export default function LoginPage() {
  return <Suspense fallback={null}><LoginInner /></Suspense>;
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (params.get("tab") === "signup") router.replace("/inscription");
  }, [params, router]);

  const submit = async () => {
    if (busy) return;
    setErr(null);
    const raw = username.trim();
    const norm = normalizeMcCode(raw);
    const pass = password;
    if (!raw) { setErr("Saisissez votre code MC (exemple : MC-36191)."); return; }
    if (!pass) { setErr("Saisissez votre mot de passe."); return; }

    setBusy(true);
    try {
      const result = await signInClientWithCode(raw, pass);
      if (!result.ok) { setErr(clientSignInErrorMessage(result.reason, norm)); return; }
      router.push("/espace-client");
    } catch {
      setErr("Une erreur imprévue est survenue. Réessayez dans quelques instants.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#061937] text-white">
      <AuthBackdrop />
      <div className="relative mx-auto max-w-5xl px-5 py-6 sm:px-8 sm:py-9">
        <header className="flex items-center justify-between gap-4">
          <Link href="/accueil" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/75 transition hover:text-white"><ArrowLeft size={15} /> Retour au site</Link>
          <div className="inline-flex items-center gap-2.5"><Logo size={38} rounded="rounded-xl" /><span className="leading-none"><b className="block text-[13px] tracking-[.08em]">STANDA</b><span className="block mt-1 text-[8px] font-bold tracking-[.2em] text-accent">COMMERCIAL</span></span></div>
        </header>

        <main className="mx-auto mt-16 max-w-md pb-10 sm:mt-20">
          <section className="relative rounded-[2rem] border border-white/40 bg-white/[.13] p-3 pt-14 shadow-[0_32px_90px_-35px_rgba(0,0,0,.8)] backdrop-blur-2xl sm:p-5 sm:pt-14">
            <div className="absolute left-1/2 top-0 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[5px] border-[#dbeafa] bg-navy shadow-[0_15px_35px_-10px_rgba(0,0,0,.65)]"><Logo size={56} rounded="rounded-xl" /></div>
            <div className="pb-5 text-center"><p className="text-[11px] font-bold uppercase tracking-[.18em] text-orange-200">Espace personnel</p><h1 className="mt-3 text-[31px] font-black tracking-[-.04em] text-white">Connectez-vous</h1><p className="mt-2 text-[14px] leading-relaxed text-white/72">Retrouvez vos colis et vos factures en toute simplicité.</p></div>

            <form onSubmit={(event) => { event.preventDefault(); void submit(); }} className="rounded-[1.5rem] bg-white p-5 text-ink shadow-[0_24px_60px_-36px_rgba(8,30,67,.55)] sm:p-7">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Code client MC</span>
                <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-line bg-mist px-3 transition focus-within:border-accent focus-within:bg-white focus-within:ring-2 focus-within:ring-accent/15"><User size={16} className="shrink-0 text-navy" /><input name="username" autoComplete="username" inputMode="text" autoCapitalize="characters" className="w-full bg-transparent py-3 text-sm font-semibold text-ink placeholder:text-slate-400 focus:outline-none uppercase" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="MC-XXXXX" /></div>
              </label>

              <div className="mt-4"><PasswordInput label="Mot de passe" value={password} onChange={setPassword} onEnter={submit} /></div>

              {err && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3"><p className="text-[13px] leading-relaxed text-red-700">{err}</p><a href={WA} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#1fb857]"><WhatsAppIcon size={14} /> Demander de l&apos;aide sur WhatsApp</a></div>}

              <button type="submit" disabled={busy} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3.5 text-sm font-bold text-white shadow-[0_14px_26px_-14px_rgba(228,101,10,.95)] transition hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Connexion en cours..." : "Se connecter"}</button>
              <p className="mt-4 text-center text-[11.5px] leading-relaxed text-slate-500">Mot de passe oublié ? Contactez-nous sur WhatsApp pour recevoir un nouveau mot de passe temporaire.</p>
            </form>
          </section>

          <div className="mt-5 grid grid-cols-3 gap-2.5">{[{ icon: MapPin, label: "Miami" }, { icon: PackageCheck, label: "Suivi" }, { icon: ShieldCheck, label: "Sécurité" }].map(({ icon: Icon, label }) => <div key={label} className="flex items-center justify-center gap-1.5 rounded-2xl border border-white/15 bg-navy/35 px-2 py-3 text-[11px] font-semibold text-white/80 backdrop-blur-md"><Icon size={14} className="text-orange-300" />{label}</div>)}</div>
          <Link href="/inscription" className="mt-5 flex w-full items-center justify-center rounded-xl border border-white/25 bg-white/[.08] py-3.5 text-sm font-bold text-white transition hover:bg-white/[.16]">Vous n&apos;avez pas encore de compte ? Créez-en un</Link>
          <p className="mt-5 text-center text-[11px] text-white/45"><Link href="/confidentialite" className="transition hover:text-white/80">Politique de confidentialité</Link></p>
        </main>
      </div>
    </div>
  );
}
