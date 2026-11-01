"use client";
/*
 * STANDA COMMERCIAL — KONEKSYON APLIKASYON AN
 * ═══════════════════════════════════════════
 * ⚠️ PAJ SA A SE POU APLIKASYON AN SÈLMAN.
 *
 * RÈG BIZNIS — KREYE KONT SE SOU SIT WÈB LA SÈLMAN
 * ────────────────────────────────────────────────
 * App la PA gen fòm enskripsyon. Bouton "Créer un compte" la louvri sit
 * wèb la NAN NAVIGATÈ A (target="_blank" + adrès absoli). Adrès sa a deyò
 * `scope` PWA a ("/espace-client"), donk Android sòti nan app la epi li
 * louvri Chrome — egzakteman jan BoxPaq fè l.
 *
 * Konsa app la ak sit la rete DE PWODWI apa, menm si yo pataje MENM MOTÈ a
 * (menm kont, menm modpas, menm bazdone). Anyen nan motè a pa chanje isit:
 * se sèlman abiman an.
 *
 * KOULÈ: menm dekorasyon ble STANDA ak paj Mon compte sou sit la. Sa kenbe
 * ilistrasyon, liy wout ak logo yo vizib sou tout gwosè telefòn.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, MessageCircle, User } from "@/components/icons";
import { clientSignInErrorMessage, signInClientWithCode } from "@/lib/authx";
import { setAuthRealm } from "@/lib/supabase";
import { normalizeMcCode } from "@/lib/utils";
import { SITE_URL, SUPPORT_PHONE } from "@/lib/branding";

import { useNoticeToast } from "@/lib/notify";
const WA = `https://wa.me/${SUPPORT_PHONE.replace(/\D/g, "")}`;
/** Adrès ABSOLI: fòse sòti nan app la epi louvri navigatè a. */
const SITE_INSCRIPTION = `${SITE_URL}/inscription`;

export default function AppConnexionPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useNoticeToast(err, setErr, { tone: "error", title: "Connexion impossible" });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setErr(null);
    const raw = username.trim();
    const norm = normalizeMcCode(raw);
    // Le mot de passe doit rester strictement identique à la saisie de l'utilisateur.
    const pass = password;
    if (!raw) { setErr("Encodez votre code MC."); return; }
    if (!pass) { setErr("Encodez votre mot de passe."); return; }

    setAuthRealm("client");
    setBusy(true);
    try {
      const result = await signInClientWithCode(raw, pass);
      if (!result.ok) { setErr(clientSignInErrorMessage(result.reason, norm)); return; }
      router.replace("/espace-client");
    } catch {
      setErr("Une erreur imprévue est survenue. Réessayez dans quelques instants.");
    } finally { setBusy(false); }
  };

  return (
    <div className="login-compact login-client site-font relative flex min-h-screen flex-col bg-[#eef2f8] text-navy">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-10">

        {/* Logo + akèy */}
        <div className="text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-[24px] bg-white shadow-[0_12px_30px_-16px_rgba(18,43,92,.45)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="STANDA COMMERCIAL" className="h-14 object-contain" />
          </div>
          <p className="mt-6 text-[12px] font-medium tracking-[0.14em] text-accent-dark">ESPAS KLIYAN</p>
          <h1 className="mt-2 text-[32px] font-semibold leading-tight tracking-[-0.03em]">Byenvini <span className="text-accent">ankò</span></h1>
          <p className="mt-2 text-[14px] text-navy/60">Konekte pou w wè koli ak fakti ou yo</p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="mt-8 space-y-4 rounded-[28px] bg-white p-6">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-navy/70">Kòd kliyan</span>
            <div className="flex items-center gap-3 rounded-2xl bg-[#f2f5fa] px-4 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-navy/80">
              <User size={18} className="shrink-0 text-navy/45" />
              <input
                name="username" autoComplete="username" autoCapitalize="characters"
                autoCorrect="off" spellCheck={false} enterKeyHint="next"
                placeholder="MC-XXXXX"
                className="w-full bg-transparent py-3.5 text-[15px] font-semibold uppercase tracking-wide text-navy placeholder:font-normal placeholder:text-navy/35 focus:outline-none"
                value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-navy/70">Modpas</span>
            <div className="flex items-center gap-3 rounded-2xl bg-[#f2f5fa] px-4 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-navy/80">
              <Lock size={18} className="shrink-0 text-navy/45" />
              <input
                type={show ? "text" : "password"} name="password" autoComplete="current-password"
                autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="go"
                placeholder="••••••••"
                className="w-full bg-transparent py-3.5 text-[15px] text-navy placeholder:text-navy/35 focus:outline-none"
                value={password} onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void submit(); } }} />
              <button type="button" onClick={() => setShow((v) => !v)}
                aria-label={show ? "Kache modpas la" : "Montre modpas la"}
                className="shrink-0 p-1 text-navy/45 hover:text-navy">
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <button type="submit" disabled={busy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent text-[15px] font-semibold text-white transition hover:bg-accent-dark disabled:opacity-60">
            {busy ? "Ap konekte…" : <>Konekte <ArrowRight size={17} /></>}
          </button>

          <a href={WA} target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-1.5 pt-1 text-center text-[12.5px] text-navy/55 transition hover:text-navy">
            <MessageCircle size={14} /> Ou bliye modpas ou? Ekri nou sou WhatsApp
          </a>
        </form>

        {/* KREYE KONT — sou SIT WÈB la sèlman */}
        <div className="mt-6 text-center">
          <a href={SITE_INSCRIPTION} target="_blank" rel="noreferrer"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-navy/15 bg-white text-[14px] font-medium text-navy transition hover:border-navy">
            Poko gen kont? <b className="font-semibold">Kreye yon kont</b> <ArrowRight size={15} />
          </a>
          <p className="mt-2.5 text-[12px] text-navy/45">Enskripsyon fèt sou sit standacommercialsa.com</p>
        </div>
      </div>

      <p className="pb-6 text-center text-[10.5px] tracking-[.2em] text-navy/30">STANDA COMMERCIAL</p>
    </div>
  );
}
