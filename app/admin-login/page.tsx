"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { staffEmail } from "@/lib/authx";

/** Koneksyon Administrateur / Employé — username + modpas. */
export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(null); setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: staffEmail(username), password
      });
      if (error) throw error;
      router.replace("/");
    } catch {
      setErr("Nom d'utilisateur oswa mot de passe pa kòrèk.");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-[#081226] flex items-center justify-center p-6"
      style={{ background: "radial-gradient(ellipse at top, #0E2145 0%, #081226 55%, #060D1C 100%)" }}>
      <form className="w-full max-w-md rounded-3xl bg-[#0D1F3F]/90 border border-white/10 shadow-2xl p-8 space-y-5"
        onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="w-20 h-20 mx-auto rounded-2xl bg-white grid place-items-center shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="STANDA COMMERCIAL" className="h-16 object-contain" />
        </div>
        <h1 className="text-xl font-extrabold text-white text-center">Espace Personnel</h1>
        <label className="block"><span className="text-xs font-semibold text-slate-300">Nom d&apos;utilisateur</span>
          <input className="mt-1 w-full rounded-xl bg-[#122A52] border border-white/10 px-3 py-3 text-sm text-white focus:outline-none focus:border-blue-400"
            name="username" autoComplete="username"
            value={username} onChange={(e) => setUsername(e.target.value)} /></label>
        <label className="block"><span className="text-xs font-semibold text-slate-300">Mot de passe</span>
          <input type="password" className="mt-1 w-full rounded-xl bg-[#122A52] border border-white/10 px-3 py-3 text-sm text-white focus:outline-none focus:border-blue-400"
            name="password" autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {err && <p className="text-sm text-red-300 bg-red-500/10 border border-red-400/30 rounded-xl px-4 py-3">{err}</p>}
        <button type="submit" className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 text-sm disabled:opacity-50" disabled={busy}>
          {busy ? "Ap konekte..." : "Konekte"}
        </button>
      </form>
    </div>
  );
}
