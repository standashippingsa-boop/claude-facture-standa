"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * Premye koneksyon kliyan: li OBLIJE kreye yon nouvo modpas
 * anvan li ka itilize aplikasyon an. Ansyen modpas tanporè a mouri la a.
 */
export default function NouveauMotDePassePage() {
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
      const { data } = await supabase.auth.getUser();
      if (!data.user) { router.replace("/login"); return; }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      // Modpas tanporè a pa valab ankò
      await supabase.from("clients").update({ must_change_password: false })
        .eq("auth_user_id", data.user.id);
      router.replace("/espace-client");
    } catch (e: unknown) {
      setErr("Erè: " + (e instanceof Error ? e.message : String(e)));
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-[#081226] flex items-center justify-center p-6"
      style={{ background: "radial-gradient(ellipse at top, #0E2145 0%, #081226 55%, #060D1C 100%)" }}>
      <div className="w-full max-w-md rounded-3xl bg-[#0D1F3F]/90 border border-white/10 shadow-2xl p-8 space-y-5">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-white grid place-items-center shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-16 object-contain" />
        </div>
        <h1 className="text-xl font-extrabold text-white text-center">Kreye nouvo modpas ou</h1>
        <p className="text-xs text-slate-400 text-center">
          Pou sekirite w, ou dwe ranplase modpas tanporè a anvan w kontinye.
        </p>
        <label className="block"><span className="text-xs font-semibold text-slate-300">Nouvo modpas</span>
          <input type="password" className="mt-1 w-full rounded-xl bg-[#122A52] border border-white/10 px-3 py-3 text-sm text-white focus:outline-none focus:border-blue-400"
            value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <label className="block"><span className="text-xs font-semibold text-slate-300">Konfime modpas la</span>
          <input type="password" className="mt-1 w-full rounded-xl bg-[#122A52] border border-white/10 px-3 py-3 text-sm text-white focus:outline-none focus:border-blue-400"
            value={confirm} onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()} /></label>
        {err && <p className="text-sm text-red-300 bg-red-500/10 border border-red-400/30 rounded-xl px-4 py-3">{err}</p>}
        <button className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 text-sm disabled:opacity-50"
          onClick={submit} disabled={busy}>
          {busy ? "Ap anrejistre..." : "Anrejistre epi kontinye"}
        </button>
      </div>
    </div>
  );
}
