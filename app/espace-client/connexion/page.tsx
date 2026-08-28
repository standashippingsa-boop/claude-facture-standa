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
 * KOULÈ: paj sa a PA swiv koulè biznis la (desizyon konfime) — gradyan
 * endigo/sarsèl ak yon dekò anime. Rès aplikasyon an rete sou mak la.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, MessageCircle, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { clientEmail } from "@/lib/authx";
import { normalizeMcCode } from "@/lib/utils";
import { SITE_URL, SUPPORT_PHONE } from "@/lib/branding";
import AuthBackdrop from "@/components/AuthBackdrop";

const WA = `https://wa.me/${SUPPORT_PHONE.replace(/\D/g, "")}`;
/** Adrès ABSOLI: fòse sòti nan app la epi louvri navigatè a. */
const SITE_INSCRIPTION = `${SITE_URL}/inscription`;

export default function AppConnexionPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setErr(null);
    const raw = username.trim();
    const norm = normalizeMcCode(raw);
    // Modpas tanporè yo kopye sou WhatsApp — yon espas envizib kole souvan.
    const pass = password.trim();
    if (!raw) { setErr("Antre kòd MC ou (egzanp: MC-36191)."); return; }
    if (!pass) { setErr("Antre modpas ou."); return; }

    setBusy(true);
    try {
      const essais = Array.from(new Set([norm, raw.toUpperCase(), raw]));
      let ok = false, last: unknown = null;
      for (const code of essais) {
        const r = await supabase.auth.signInWithPassword({ email: clientEmail(code), password: pass });
        if (!r.error) { ok = true; break; }
        last = r.error;
      }
      if (!ok) throw last;
      router.replace("/espace-client");
    } catch (e: unknown) {
      const m = String((e as Error)?.message ?? "").toLowerCase();
      setErr(m.includes("not confirmed")
        ? "Kont ou poko aktive. Kontakte STANDA COMMERCIAL sou WhatsApp."
        : `Kòd ${norm || "MC-XXXXX"} oswa modpas la pa kòrèk. Peze ti je a pou verifye.`);
    } finally { setBusy(false); }
  };

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      <AuthBackdrop />

      <div className="relative flex-1 flex flex-col justify-center px-5 py-10 w-full max-w-sm mx-auto">

        {/* Logo + akèy */}
        <div className="text-center mb-8 sd-rise">
          <div className="w-24 h-24 mx-auto rounded-[28px] bg-white grid place-items-center
                          shadow-[0_18px_50px_-12px_rgba(0,0,0,.6)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="STANDA COMMERCIAL" className="h-16 object-contain" />
          </div>
          <h1 className="text-[28px] font-extrabold text-white mt-6 tracking-tight">Byenvini</h1>
          <p className="text-sm text-white/55 mt-1.5">Konekte pou w wè koli ou yo</p>
        </div>

        {/* Kat vè depoli */}
        <form onSubmit={(e) => { e.preventDefault(); submit(); }}
          className="rounded-[26px] bg-white/[0.07] backdrop-blur-xl border border-white/15
                     shadow-[0_24px_70px_-20px_rgba(0,0,0,.7)] p-6 space-y-4 sd-rise sd-d2">

          <label className="block">
            <span className="sd-label">Kòd kliyan</span>
            <div className="flex items-center gap-3 rounded-2xl bg-white/10 border border-white/15 px-4
                            focus-within:border-white/50 focus-within:bg-white/15 transition">
              <User size={18} className="text-white/40 shrink-0" />
              <input
                name="username" autoComplete="username" autoCapitalize="characters"
                placeholder="MC-XXXXX"
                className="w-full bg-transparent py-3.5 text-[15px] text-white placeholder:text-white/30
                           focus:outline-none uppercase tracking-wide"
                value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
          </label>

          <label className="block">
            <span className="sd-label">Modpas</span>
            <div className="flex items-center gap-3 rounded-2xl bg-white/10 border border-white/15 px-4
                            focus-within:border-white/50 focus-within:bg-white/15 transition">
              <Lock size={18} className="text-white/40 shrink-0" />
              <input
                type={show ? "text" : "password"} name="password" autoComplete="current-password"
                placeholder="••••••••"
                className="w-full bg-transparent py-3.5 text-[15px] text-white placeholder:text-white/30 focus:outline-none"
                value={password} onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()} />
              <button type="button" onClick={() => setShow((v) => !v)}
                aria-label={show ? "Kache modpas la" : "Montre modpas la"}
                className="text-white/40 hover:text-white shrink-0 p-1">
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {err && (
            <div className="rounded-2xl bg-red-500/15 border border-red-400/30 px-4 py-3 space-y-2.5 sd-rise">
              <p className="text-[13px] text-red-100 leading-relaxed">{err}</p>
              <a href={WA} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[12px] font-bold text-white
                           bg-indigo-600 hover:bg-indigo-500 rounded-lg px-3 py-2 transition">
                <MessageCircle size={14} /> Mande èd sou WhatsApp
              </a>
            </div>
          )}

          <button type="submit" disabled={busy}
            className={`w-full rounded-2xl py-4 text-[15px] font-bold text-white transition
                        shadow-[0_14px_34px_-10px_rgba(99,102,241,.9)] disabled:opacity-60
                        ${busy ? "sd-sheen" : ""}`}
            style={{
              backgroundImage: busy
                ? "linear-gradient(90deg,#4F46E5,#7C6CF7,#4F46E5)"
                : "linear-gradient(135deg,#4F46E5 0%,#6D5BF5 50%,#0E9488 100%)"
            }}>
            {busy ? "Ap konekte…" : "Konekte"}
          </button>

          <a href={WA} target="_blank" rel="noreferrer"
            className="block text-center text-[12px] text-white/45 hover:text-white/75 transition pt-1">
            Ou bliye modpas ou? Ekri nou sou WhatsApp
          </a>
        </form>

        {/* KREYE KONT — sou SIT WÈB la sèlman */}
        <div className="mt-7 text-center sd-rise sd-d4">
          <div className="flex items-center gap-3 mb-4">
            <span className="h-px flex-1 bg-white/15" />
            <span className="text-[11px] text-white/35 tracking-wider">POKO GEN KONT?</span>
            <span className="h-px flex-1 bg-white/15" />
          </div>
          <a href={SITE_INSCRIPTION} target="_blank" rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full rounded-2xl
                       border border-white/25 bg-white/[0.06] hover:bg-white/[0.12]
                       text-white font-bold py-3.5 text-[14px] transition">
            Kreye yon kont <ArrowRight size={16} />
          </a>
          <p className="text-[11px] text-white/30 mt-2.5 leading-relaxed">
            Enskripsyon fèt sou sit standacommercialsa.com
          </p>
        </div>
      </div>

      <p className="relative text-center text-[10px] text-white/20 pb-6 tracking-[.2em]">
        STANDA COMMERCIAL
      </p>
    </div>
  );
}
