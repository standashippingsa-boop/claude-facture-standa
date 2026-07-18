"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * Paj chanjman modpas — kliyan an rive isit la atravè lyen imèl
 * "Mot de passe oublié ?" a (Supabase Auth recovery).
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(null);
    if (password.length < 6) { setErr("Modpas la dwe gen omwen 6 karaktè."); return; }
    if (password !== confirm) { setErr("De modpas yo pa menm."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.replace("/espace-client");
    } catch (e: any) {
      setErr(e.message?.includes("session")
        ? "Sesyon an ekspire — retounen sou paj koneksyon an epi klike 'Mot de passe oublié ?' ankò."
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
        <h1 className="text-xl font-extrabold text-white text-center">Nouvo modpas</h1>
        <p className="text-xs text-slate-400 text-center">Chwazi yon nouvo modpas pou kont ou.</p>

        <label className="block">
          <span className="text-xs font-semibold text-slate-300">Nouvo modpas</span>
          <div className="mt-1 flex items-center gap-2 rounded-xl bg-[#122A52] border border-white/10 px-3 focus-within:border-blue-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9DB4DC" strokeWidth="2"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
            <input type="password" className="w-full bg-transparent py-3 text-sm text-white focus:outline-none"
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-300">Konfime modpas la</span>
          <div className="mt-1 flex items-center gap-2 rounded-xl bg-[#122A52] border border-white/10 px-3 focus-within:border-blue-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9DB4DC" strokeWidth="2"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
            <input type="password" className="w-full bg-transparent py-3 text-sm text-white focus:outline-none"
              value={confirm} onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>
        </label>

        {err && <p className="text-sm text-red-300 bg-red-500/10 border border-red-400/30 rounded-xl px-4 py-3">{err}</p>}

        <button className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 text-sm shadow-lg shadow-blue-900/40 transition-colors disabled:opacity-50"
          onClick={submit} disabled={busy}>
          {busy ? "Ap anrejistre..." : "Anrejistre nouvo modpas la"}
        </button>
      </div>
    </div>
  );
}
