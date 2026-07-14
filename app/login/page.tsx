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

  const oauth = async (provider: "google" | "apple") => {
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
    <div className="min-h-screen bg-mist flex items-center justify-center p-6">
      <div className="card p-8 max-w-md w-full space-y-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="STANDA COMMERCIAL" className="mx-auto h-16 object-contain" />
        <h1 className="text-xl font-extrabold text-navy text-center">Koneksyon kliyan</h1>

        <label className="block">
          <span className="text-xs font-semibold text-slate-600">Imèl</span>
          <input type="email" className="input mt-1" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="ou@egzanp.com" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">Modpas</span>
          <input type="password" className="input mt-1" value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()} />
        </label>

        {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{err}</p>}
        {info && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">{info}</p>}

        <button className="btn w-full justify-center py-3" onClick={submit} disabled={busy}>
          {busy ? "Ap konekte..." : "Konekte"}
        </button>

        <button type="button" onClick={forgot}
          className="block w-full text-center text-xs text-navy font-semibold underline">
          Mot de passe oublié ?
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-line" /><span className="text-xs text-slate-400">oswa</span><div className="flex-1 h-px bg-line" />
        </div>

        <button type="button" onClick={() => oauth("google")}
          className="w-full flex items-center justify-center gap-2 border border-line rounded-lg py-2.5 text-sm font-semibold hover:bg-mist">
          <svg width="17" height="17" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
          Continuer avec Google
        </button>
        <button type="button" onClick={() => oauth("apple")}
          className="w-full flex items-center justify-center gap-2 bg-black text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-black/85">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.86-3.08.43-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.43C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
          Continuer avec Apple
        </button>

        <p className="text-center text-xs text-slate-500">
          Ou poko gen kont? <Link href="/inscription" className="text-navy font-semibold underline">Enskri la a</Link>
        </p>
      </div>
    </div>
  );
}
