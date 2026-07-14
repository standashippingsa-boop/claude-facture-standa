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
    <div className="min-h-screen bg-mist flex items-center justify-center p-6">
      <div className="card p-8 max-w-md w-full space-y-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="STANDA COMMERCIAL" className="mx-auto h-16 object-contain" />
        <h1 className="text-xl font-extrabold text-navy text-center">Nouvo modpas</h1>

        <label className="block">
          <span className="text-xs font-semibold text-slate-600">Nouvo modpas</span>
          <input type="password" className="input mt-1" value={password}
            onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-600">Konfimasyon</span>
          <input type="password" className="input mt-1" value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()} />
        </label>

        {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{err}</p>}

        <button className="btn w-full justify-center py-3" onClick={submit} disabled={busy}>
          {busy ? "Ap anrejistre..." : "Chanje modpas mwen"}
        </button>
      </div>
    </div>
  );
}
