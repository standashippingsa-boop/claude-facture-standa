"use client";
/*
 * STANDA COMMERCIAL — MON COMPTE (koneksyon sou SIT WÈB la)
 * ═════════════════════════════════════════════════════════
 * Menm dekò ak paj /inscription: gradyan anime, kat vè depoli, chan ki
 * monte youn apre lòt. De paj yo mache ansanm — yon moun ki pase de "Mon
 * compte" a "S'inscrire" pa dwe santi li chanje sit.
 *
 * DE PAJ KONEKSYON, DE PWODWI
 * ───────────────────────────
 *   /login                     -> paj sa a, sou SIT WÈB la
 *   /espace-client/connexion   -> nan APLIKASYON an
 * Menm motè (menm kont, menm bazdone), abiman diferan.
 *
 * ENSKRIPSYON GEN YON SÈL KOTE: /inscription. Paj sa a pa gen fòm
 * enskripsyon — li jis gen yon lyen. Ansyen lyen ?tab=signup redirije.
 *
 * POUKISA KLIYAN YO PA T KA KONEKTE — twa kòz, tout twa korije:
 *   1) Fòma kòd la: "36191", "mc36191", "MC 36191" -> nou nòmalize.
 *   2) ESPAS nan modpas la: lè yo kopye modpas tanporè a sou WhatsApp, yon
 *      espas envizib kole nan bout la. Nou koupe espas devan/dèyè yo.
 *   3) Yo pa wè sa yo tape -> TI JE 👁️.
 *
 * ANREJISTRE MODPAS SOU TELEFÒN: vrè <form> + name + autoComplete. San yo,
 * Chrome/Safari pa janm pwopoze anrejistre modpas la.
 */
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, MessageCircle, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { clientEmail } from "@/lib/authx";
import { normalizeMcCode } from "@/lib/utils";
import { SUPPORT_PHONE } from "@/lib/branding";
import AuthBackdrop from "@/components/AuthBackdrop";

const WA = `https://wa.me/${SUPPORT_PHONE.replace(/\D/g, "")}`;

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* Ansyen lyen ?tab=signup (deja voye sou WhatsApp) dwe kontinye mache. */
  useEffect(() => {
    if (params.get("tab") === "signup") router.replace("/inscription");
  }, [params, router]);

  const submit = async () => {
    if (busy) return;
    setErr(null);
    const raw = username.trim();
    const norm = normalizeMcCode(raw);
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
      router.push("/espace-client");
    } catch (e: unknown) {
      const m = String((e as Error)?.message ?? "").toLowerCase();
      setErr(m.includes("not confirmed")
        ? "Kont ou poko aktive. Kontakte STANDA COMMERCIAL sou WhatsApp."
        : `Kòd ${norm || "MC-XXXXX"} oswa modpas la pa kòrèk. Peze ti je a pou verifye modpas ou tape a.`);
    } finally { setBusy(false); }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <AuthBackdrop />

      <div className="relative max-w-md mx-auto px-5 py-8 sm:py-12">

        <Link href="/accueil"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/60
                     hover:text-white transition sd-rise">
          <ArrowLeft size={15} /> Retour au site
        </Link>

        <div className="text-center mt-6 mb-8">
          <div className="w-20 h-20 mx-auto rounded-[24px] bg-white grid place-items-center
                          shadow-[0_18px_50px_-14px_rgba(0,0,0,.6)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="STANDA COMMERCIAL" className="h-14 object-contain" />
          </div>
          <h1 className="text-[28px] font-extrabold text-white mt-5 tracking-tight sd-rise sd-d1">
            Mon compte
          </h1>
          <p className="text-sm text-white/55 mt-1.5 sd-rise sd-d2">
            Konekte pou w wè koli ou yo
          </p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); submit(); }}
          className="rounded-[26px] bg-white/[0.07] backdrop-blur-xl border border-white/15
                     shadow-[0_24px_70px_-20px_rgba(0,0,0,.7)] p-6 space-y-4 sd-rise sd-d3">

          <label className="block">
            <span className="sd-label">Nom d&apos;utilisateur (kòd MC)</span>
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

        {/* Enskripsyon gen YON SÈL kote: /inscription */}
        <div className="mt-7 text-center sd-rise sd-d5">
          <div className="flex items-center gap-3 mb-4">
            <span className="h-px flex-1 bg-white/15" />
            <span className="text-[11px] text-white/35 tracking-wider">POKO GEN KONT?</span>
            <span className="h-px flex-1 bg-white/15" />
          </div>
          <Link href="/inscription"
            className="inline-flex items-center justify-center gap-2 w-full rounded-2xl
                       border border-white/25 bg-white/[0.06] hover:bg-white/[0.12]
                       text-white font-bold py-3.5 text-[14px] transition">
            Kreye yon kont <ArrowRight size={16} />
          </Link>
        </div>

        <p className="text-center text-[11px] text-white/30 mt-8">
          <Link href="/confidentialite" className="hover:text-white/60 transition">
            Politique de confidentialité
          </Link>
        </p>
      </div>
    </div>
  );
}
