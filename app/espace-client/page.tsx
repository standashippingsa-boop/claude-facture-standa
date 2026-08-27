"use client";
/*
 * STANDA COMMERCIAL — KONEKSYON NAN APLIKASYON AN
 * ═══════════════════════════════════════════════
 * ⚠️ PAJ SA A SE POU APLIKASYON AN SÈLMAN — pa pou sit wèb la.
 *
 * POUKISA GEN DE PAJ KONEKSYON
 * ────────────────────────────
 * Sit wèb la (standacommercialsa.com) ak aplikasyon an se DE PRODWI apa.
 * Yo pataje MENM MOTÈ a (menm kont, menm modpas, menm bazdone) men yo pa
 * dwe sanble. Lè yon kliyan te klike sou "S'inscrire" sou sit la epi li te
 * wè menm ekran ak app la, sa te montre app la ak sit la se yon sèl bagay.
 *
 *   Sit wèb  ->  /login              (estil sit la, ak meni ak footer)
 *   App      ->  /espace-client/connexion   (paj sa a, estil aplikasyon)
 *
 * POUKISA LI ANBA /espace-client
 * ──────────────────────────────
 * `scope` nan manifest la se "/espace-client". Tout sa ki ANDAN scope a
 * rete nan aplikasyon an; tout sa ki DEYÒ louvri nan navigatè a. Si paj
 * koneksyon an te rete sou /login (deyò scope a), app la ta soti nan pwòp
 * fenèt li chak fwa yon kliyan bezwen konekte.
 *
 * Pa gen lyen sou sit la isit la: yon moun ki nan app la rete nan app la.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { clientEmail } from "@/lib/authx";
import { normalizeMcCode } from "@/lib/utils";
import { SUPPORT_PHONE } from "@/lib/branding";
import PasswordInput from "@/components/PasswordInput";

const WA = `https://wa.me/${SUPPORT_PHONE.replace(/\D/g, "")}`;

export default function AppConnexionPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="min-h-screen bg-navy flex flex-col">
      {/* Antèt aplikasyon an — plen lajè, pa yon kat ki flote */}
      <div className="flex-1 flex flex-col justify-center px-6 py-10 max-w-md w-full mx-auto">

        <div className="text-center mb-10">
          <div className="w-24 h-24 mx-auto rounded-3xl bg-white grid place-items-center shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="STANDA COMMERCIAL" className="h-20 object-contain" />
          </div>
          <h1 className="text-2xl font-extrabold text-white mt-5">Byenvini</h1>
          <p className="text-sm text-white/55 mt-1.5">Konekte pou w wè koli ou yo</p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-white/70">Kòd kliyan</span>
            <div className="mt-1.5 flex items-center gap-2.5 rounded-2xl bg-white/10 border border-white/15 px-4 focus-within:border-brand">
              <User size={18} className="text-white/45 shrink-0" />
              <input
                name="username" autoComplete="username" autoCapitalize="characters"
                placeholder="MC-XXXXX"
                className="w-full bg-transparent py-4 text-base text-white placeholder:text-white/30 focus:outline-none uppercase"
                value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
          </label>

          <PasswordInput dark label="Modpas" value={password} onChange={setPassword} onEnter={submit} />

          {err && (
            <div className="rounded-2xl bg-red-500/15 border border-red-400/30 px-4 py-3 space-y-2.5">
              <p className="text-sm text-red-100">{err}</p>
              <a href={WA} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg px-3 py-2">
                <MessageCircle size={14} /> Mande èd sou WhatsApp
              </a>
            </div>
          )}

          <button type="submit" disabled={busy}
            className="w-full rounded-2xl bg-brand hover:bg-brand-dark text-white font-bold py-4 text-base shadow-lg transition-colors disabled:opacity-50">
            {busy ? "Ap konekte..." : "Konekte"}
          </button>
        </form>

        <a href={WA} target="_blank" rel="noreferrer"
          className="mt-8 text-center text-[13px] text-white/45 hover:text-white/70">
          Ou bliye modpas ou? Ekri nou sou WhatsApp
        </a>
      </div>

      <p className="text-center text-[11px] text-white/25 pb-6">STANDA COMMERCIAL</p>
    </div>
  );
}
