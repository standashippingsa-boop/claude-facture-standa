"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SITE_URL } from "@/lib/branding";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const oauth = async (provider: "google" | "facebook") => {
    setErr(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${SITE_URL}/espace-client` }
    });
    if (error) setErr("Erè: " + error.message);
  };

  const forgot = async () => {
    setErr(null); setInfo(null);
    if (!email.trim()) { setErr("Antre imèl ou anwo a anvan, epi klike ankò."); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${SITE_URL}/reset-password`
    });
    if (error) setErr("Erè: " + error.message);
    else setInfo("Nou voye yon imèl ba ou ak lyen pou w chanje modpas la. Tcheke bwat resepsyon w (ak Spam).");
  };

  const submit = async () => {
    setErr(null); setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push("/espace-client");
    } catch (e: any) {
      setErr(e.message?.includes("Invalid login")
        ? "Imèl oswa modpas la pa kòrèk."
        : "Erè: " + (e.message ?? String(e)));
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
          <span className="text-xs font-semibold text-slate-300">Imèl</span>
          <div className="mt-1 flex items-center gap-2 rounded-xl bg-[#122A52] border border-white/10 px-3 focus-within:border-blue-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9DB4DC" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
            <input type="email" className="w-full bg-transparent py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none"
              value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ou@egzanp.com" />
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

        <div className="text-right -mt-2">
          <button type="button" onClick={forgot} className="text-xs text-blue-300 hover:text-blue-200 hover:underline">
            Mot de passe oublié ?
          </button>
        </div>

        {err && <p className="text-sm text-red-300 bg-red-500/10 border border-red-400/30 rounded-xl px-4 py-3">{err}</p>}
        {info && <p className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-400/30 rounded-xl px-4 py-3">{info}</p>}

        <button className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 text-sm shadow-lg shadow-blue-900/40 transition-colors disabled:opacity-50"
          onClick={submit} disabled={busy}>
          {busy ? "Ap konekte..." : "Konekte"}
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/10" /><span className="text-xs text-slate-500">oswa</span><div className="flex-1 h-px bg-white/10" />
        </div>

        <button type="button" onClick={() => oauth("google")}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-white text-slate-800 py-3 text-sm font-semibold hover:bg-slate-100">
          <svg width="17" height="17" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
          Continuer avec Google
        </button>
        <button type="button" onClick={() => oauth("facebook")}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#1877F2] text-white py-3 text-sm font-semibold hover:bg-[#166FE0]">
          <svg width="17" height="17" viewBox="0 0 24 24"><path fill="#fff" d="M24 12a12 12 0 1 0-13.88 11.85v-8.38H7.08V12h3.04V9.36c0-3 1.79-4.67 4.53-4.67 1.31 0 2.68.24 2.68.24v2.95h-1.51c-1.49 0-1.95.92-1.95 1.87V12h3.32l-.53 3.47h-2.79v8.38A12 12 0 0 0 24 12z"/></svg>
          Continuer avec Facebook
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
