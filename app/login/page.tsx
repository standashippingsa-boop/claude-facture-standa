"use client";
/*
 * STANDA COMMERCIAL — ESPACE CLIENT (KONEKTE + KREYE KONT)
 * ════════════════════════════════════════════════════════
 * YON SÈL LYEN pou kliyan yo: /login
 *   Onglè 1 — Se connecter    (kòd MC + modpas)
 *   Onglè 2 — Créer un compte (menm fòm enskripsyon an, anndan)
 *
 * POUKISA KLIYAN YO PA T KA KONEKTE — twa kòz reyèl, tout twa korije:
 *   1) Fòma kòd la: yo tape "36191", "mc36191", "MC 36191" -> nou nòmalize.
 *   2) ESPAS nan modpas la: lè yo kopye modpas tanporè a sou WhatsApp, yon
 *      espas envizib kole nan bout la. Nou koupe espas devan/dèyè yo.
 *   3) Yo pa wè sa yo tape -> TI JE 👁️ sou chan modpas la.
 *
 * ANREJISTRE MODPAS SOU TELEFÒN:
 *   Vrè <form> + name + autoComplete = Chrome/Safari pwopoze anrejistre
 *   modpas la. San sa, telefòn nan pa janm pwopoze anyen.
 *
 * Si tout echwe: yon bouton WhatsApp dirèk nan mesaj erè a — kliyan an pa
 * janm rete bloke san solisyon.
 */
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageCircle, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { clientEmail } from "@/lib/authx";
import { normalizeMcCode } from "@/lib/utils";
import { SUPPORT_PHONE } from "@/lib/branding";
import PasswordInput from "@/components/PasswordInput";

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
  /*
   * Ansyen lyen ?tab=signup (WhatsApp deja voye yo) dwe kontinye mache.
   * Enskripsyon gen YON SÈL kote kounye a: /inscription.
   */
  useEffect(() => {
    if (params.get("tab") === "signup") router.replace("/inscription");
  }, [params, router]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setErr(null);

    const raw = username.trim();
    const norm = normalizeMcCode(raw);
    // Modpas tanporè yo se lèt/chif — koupe espas ki kole lè yo kopye sou WhatsApp.
    const pass = password.trim();

    if (!raw) { setErr("Antre kòd MC ou (egzanp: MC-36191)."); return; }
    if (!pass) { setErr("Antre modpas ou."); return; }

    setBusy(true);
    try {
      // Eseye kòd nòmalize a, apre sa kòd la jan li tape a (ansyen kont yo)
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
      if (m.includes("not confirmed")) {
        setErr("Kont ou poko aktive. Kontakte STANDA COMMERCIAL sou WhatsApp.");
      } else {
        setErr(`Kòd ${norm || "MC-XXXXX"} oswa modpas la pa kòrèk. Peze ti je a pou verifye modpas ou tape a.`);
      }
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-[#081226] py-8 px-4"
      style={{ background: "radial-gradient(ellipse at top, #0E2145 0%, #081226 55%, #060D1C 100%)" }}>
      <div className="mx-auto max-w-md">

        <div className="text-center mb-5">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-white grid place-items-center shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="STANDA COMMERCIAL" className="h-16 object-contain" />
          </div>
          <h1 className="text-xl font-extrabold text-white mt-3">Espace Client</h1>
        </div>



        {(
          <form
            onSubmit={(e) => { e.preventDefault(); submit(); }}
            className="rounded-3xl bg-[#0D1F3F]/90 border border-white/10 shadow-2xl p-6 sm:p-8 space-y-5">

            <label className="block">
              <span className="text-xs font-semibold text-slate-300">Nom d&apos;utilisateur (kòd MC)</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl bg-[#122A52] border border-white/10 px-3 focus-within:border-blue-400">
                <User size={16} className="text-[#9DB4DC] shrink-0" />
                <input
                  name="username" autoComplete="username" inputMode="text" autoCapitalize="characters"
                  className="w-full bg-transparent py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none uppercase"
                  value={username} onChange={(e) => setUsername(e.target.value)} placeholder="MC-XXXXX" />
              </div>
            </label>

            <PasswordInput dark label="Modpas" value={password} onChange={setPassword} onEnter={submit} />

            {err && (
              <div className="rounded-xl bg-red-500/10 border border-red-400/30 px-4 py-3 space-y-2.5">
                <p className="text-sm text-red-200">{err}</p>
                <a href={WA} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg px-3 py-2">
                  <MessageCircle size={14} /> Mande èd sou WhatsApp
                </a>
              </div>
            )}

            <button type="submit" disabled={busy}
              className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 text-sm shadow-lg shadow-blue-900/40 transition-colors disabled:opacity-50">
              {busy ? "Ap konekte..." : "Konekte"}
            </button>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Ou bliye modpas ou? Kontakte STANDA COMMERCIAL sou WhatsApp — n ap voye yon
              nouvo modpas tanporè ba ou.
            </p>
          </form>
        )}

        {/* Enskripsyon fèt SOU YON SÈL KOTE: paj /inscription */}
        <Link href="/inscription"
          className="mt-4 flex items-center justify-center gap-2 w-full rounded-xl border border-white/20
                     bg-white/5 hover:bg-white/10 text-white font-bold py-3.5 text-sm transition">
          Poko gen kont? Kreye youn
        </Link>

        <p className="text-center text-[11px] text-slate-500 mt-5">
          <Link href="/confidentialite" className="hover:underline">Politique de confidentialité</Link>
        </p>
      </div>
    </div>
  );
}
