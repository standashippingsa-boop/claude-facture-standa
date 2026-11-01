"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, MapPin, PackageCheck, ShieldCheck, User } from "@/components/icons";
import { clientSignInErrorMessage, signInClientWithCode } from "@/lib/authx";
import { setAuthRealm } from "@/lib/supabase";
import { normalizeMcCode } from "@/lib/utils";
import { SUPPORT_PHONE } from "@/lib/branding";
import PasswordInput from "@/components/PasswordInput";
import Logo from "@/components/Logo";
import { WhatsAppIcon } from "@/components/site/BrandIcons";
import StoreBadges from "@/components/site/StoreBadges";
import ClientInstallCard from "@/components/ClientInstallCard";
import { BusyButton } from "@/components/Loader";

import { useNoticeToast } from "@/lib/notify";
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
  const [needHelp, setNeedHelp] = useState(false);
  useEffect(() => { if (err) setNeedHelp(true); }, [err]);
  useNoticeToast(err, setErr, { tone: "error", title: "Connexion impossible" });
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
    if (!raw) { setErr("Encodez votre code MC."); return; }
    if (!pass) { setErr("Encodez votre mot de passe."); return; }

    setAuthRealm("client");
    setBusy(true);
    try {
      const result = await signInClientWithCode(raw, pass);
      if (!result.ok) { setErr(clientSignInErrorMessage(result.reason, norm)); return; }
      // La porte web est remplacée par l'application : aucune étape publique
      // ne reste derrière le client après sa connexion.
      router.replace("/espace-client");
    } catch {
      setErr("Une erreur imprévue est survenue. Réessayez dans quelques instants.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-compact login-client site-font relative min-h-screen bg-[#eef2f8] text-navy">
      <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex items-center justify-between gap-4">
          <Link href="/accueil" className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[13px] font-medium text-navy/80 shadow-[0_1px_2px_rgba(0,0,0,.05)] transition hover:text-navy"><ArrowLeft size={15} /> Retour au site</Link>
          <Link href="/accueil" className="inline-flex items-center gap-2.5"><Logo size={34} /><span className="leading-none"><b className="block text-[14px] font-extrabold tracking-tight">STANDA</b><span className="mt-0.5 block text-[9px] font-semibold tracking-[.2em] text-accent">COMMERCIAL</span></span></Link>
        </header>

        <main className="mx-auto mt-12 max-w-md pb-10 sm:mt-16">
          <div className="text-center">
            <p className="text-[12px] font-medium tracking-[0.14em] text-accent-dark">ESPACE CLIENT</p>
            <h1 className="mt-4 text-[34px] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[40px]">Bon retour <span className="text-accent">parmi nous</span></h1>
            <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-navy/65">Connectez-vous pour suivre vos colis et voir vos factures.</p>
          </div>

          <form onSubmit={(event) => { event.preventDefault(); void submit(); }} className="mt-8 rounded-[28px] bg-white p-6 sm:p-8">
            <label className="block">
              <span className="text-[13px] font-medium text-navy/70">Code client MC</span>
              <div className="mt-1.5 flex items-center gap-2.5 rounded-2xl bg-[#f2f5fa] px-4 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-navy/80"><User size={18} className="shrink-0 text-navy/45" /><input name="username" autoComplete="username" inputMode="text" autoCapitalize="characters" autoCorrect="off" spellCheck={false} enterKeyHint="next" className="w-full bg-transparent py-3.5 text-[15px] font-semibold uppercase tracking-wide text-navy placeholder:font-normal placeholder:text-navy/35 focus:outline-none" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="MC-XXXXX" /></div>
            </label>

            <div className="mt-4"><PasswordInput label="Mot de passe" value={password} onChange={setPassword} onEnter={submit} /></div>

            {needHelp && <a href={WA} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#1fb857]"><WhatsAppIcon size={14} /> Demander de l&apos;aide sur WhatsApp</a>}

            <BusyButton type="submit" busy={busy} className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent text-[15px] font-semibold text-white transition hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
              busyLabel="Connexion en cours…">Se connecter</BusyButton>
            <p className="mt-4 text-center text-[12.5px] leading-relaxed text-navy/55">Mot de passe oublié ? <a href={WA} target="_blank" rel="noreferrer" className="font-semibold text-navy underline underline-offset-2">Écrivez à STANDA sur WhatsApp</a> pour en recevoir un nouveau.</p>
          </form>

          <div className="mt-4 grid grid-cols-3 gap-2">{[{ icon: MapPin, label: "Adresse à Miami" }, { icon: PackageCheck, label: "Suivi des colis" }, { icon: ShieldCheck, label: "Compte protégé" }].map(({ icon: Icon, label }) => <div key={label} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white px-2 py-3 text-center text-[11.5px] text-navy/70"><Icon size={18} className="text-accent" />{label}</div>)}</div>

          <Link href="/inscription" className="mt-4 flex h-12 w-full items-center justify-center rounded-full border border-navy/15 bg-white text-[14px] font-medium text-navy transition hover:border-navy">Pas encore de compte ? <b className="ml-1 font-semibold">Créer mon compte</b></Link>

          <section className="mt-6 border-t border-navy/10 pt-6 text-center">
            <p className="text-[12px] font-medium tracking-[0.14em] text-accent-dark">APPLICATION MOBILE</p>
            <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-navy/60">Téléchargez l&apos;application STANDA dès sa publication officielle.</p>
            <StoreBadges className="mt-4 justify-center" />
            <ClientInstallCard className="mt-4" />
          </section>
          <p className="mt-5 text-center text-[12px] text-navy/45"><Link href="/confidentialite" className="transition hover:text-navy/80">Politique de confidentialité</Link></p>
        </main>
      </div>
    </div>
  );
}
