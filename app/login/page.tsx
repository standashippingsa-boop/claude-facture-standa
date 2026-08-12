"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { clientEmail } from "@/lib/authx";
import { normalizeMcCode } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(null); setBusy(true);
    try {
      // KÒZ RASIN #1 korije: kont yo kreye ak kòd NÒMALIZE ("MC-36191"), men
      // kliyan an ka tape "36191", "mc36191", "MC 36191"... Nou nòmalize anvan.
      const raw = username.trim();
      const norm = normalizeMcCode(raw);
      let data: any = null, error: any = null;

      ({ data, error } = await supabase.auth.signInWithPassword({
        email: clientEmail(norm), password
      }));
      // Konpatibilite: ansyen kont ki ta kreye san nòmalizasyon
      if (error && raw && norm.toLowerCase() !== raw.toLowerCase()) {
        const retry = await supabase.auth.signInWithPassword({
          email: clientEmail(raw), password
        });
        if (!retry.error) { data = retry.data; error = null; }
      }
      if (error) throw error;

      // V8.5: pa gen fòs chanjman modpas ankò — kliyan an ka itilize modpas admin ba li a
      router.push("/espace-client");
    } catch {
      setErr("Nom d'utilisateur (MC-XXXXX) oswa mot de passe pa kòrèk.");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-[#081226] flex items-center justify-center p-6"
      style={{ background: "radial-gradient(ellipse at top, #0E2145 0%, #081226 55%, #060D1C 100%)" }}>
      <div className="w-full max-w-md rounded-3xl bg-[#0D1F3F]/90 border border-white/10 shadow-2xl p-8 space-y-5">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-white grid place-items-center shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="STANDA COMMERCIAL" className="h-16 object-contain" />
        </div>
        <h1 className="text-2xl font-extrabold text-white text-center">Koneksyon</h1>

        <label className="block">
          <span className="text-xs font-semibold text-slate-300">Nom d&apos;utilisateur</span>
          <div className="mt-1 flex items-center gap-2 rounded-xl bg-[#122A52] border border-white/10 px-3 focus-within:border-blue-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9DB4DC" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>
            <input className="w-full bg-transparent py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none uppercase"
              name="username" autoComplete="username"
              value={username} onChange={(e) => setUsername(e.target.value)} placeholder="MC-XXXXX" />
          </div>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-slate-300">Modpas</span>
          <div className="mt-1 flex items-center gap-2 rounded-xl bg-[#122A52] border border-white/10 px-3 focus-within:border-blue-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9DB4DC" strokeWidth="2"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
            <input type="password" className="w-full bg-transparent py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none"
              value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>
        </label>

        <p className="text-[11px] text-slate-500 -mt-2">
          Ou bliye modpas ou? Kontakte STANDA COMMERCIAL sou WhatsApp — n ap voye yon nouvo modpas tanporè ba ou.
        </p>

        {err && <p className="text-sm text-red-300 bg-red-500/10 border border-red-400/30 rounded-xl px-4 py-3">{err}</p>}

        <button className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 text-sm shadow-lg shadow-blue-900/40 transition-colors disabled:opacity-50"
          onClick={submit} disabled={busy}>
          {busy ? "Ap konekte..." : "Konekte"}
        </button>

        <p className="text-center text-xs text-slate-400">
          Ou poko gen kont? <Link href="/inscription" className="text-blue-300 font-semibold hover:underline">Enskri la a</Link>
        </p>
        <p className="text-center text-[11px] text-slate-500">
          <Link href="/confidentialite" className="hover:underline">Politique de confidentialité</Link>
        </p>
      </div>
    </div>
  );
}
