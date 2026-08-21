"use client";
/*
 * STANDA COMMERCIAL — Koneksyon PÈSONÈL (Admin ak Employé)
 * ════════════════════════════════════════════════════════
 * Admin ak Employé itilize MENM otantifikasyon an (staffEmail). Sa k chanje
 * se WÒL la, epi wòl la soti nan tab `staff` — pa nan paj koneksyon an.
 * Donk yon sèl konpozan, de lyen: /admin-login ak /employe. Zewo dwaplikaj.
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { staffEmail } from "@/lib/authx";
import PasswordInput from "@/components/PasswordInput";

export default function StaffLogin({ title, subtitle }: { title: string; subtitle: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setErr(null);
    const u = username.trim();
    const p = password.trim();
    if (!u || !p) { setErr("Antre non itilizatè ou ak modpas ou."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: staffEmail(u), password: p });
      if (error) throw error;
      router.replace("/");
    } catch {
      setErr("Non itilizatè oswa modpas pa kòrèk. Peze ti je a pou verifye modpas la.");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-[#081226] flex items-center justify-center p-5"
      style={{ background: "radial-gradient(ellipse at top, #0E2145 0%, #081226 55%, #060D1C 100%)" }}>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="w-full max-w-md rounded-3xl bg-[#0D1F3F]/90 border border-white/10 shadow-2xl p-6 sm:p-8 space-y-5">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-white grid place-items-center shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="STANDA COMMERCIAL" className="h-16 object-contain" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-extrabold text-white">{title}</h1>
          <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-slate-300">Nom d&apos;utilisateur</span>
          <div className="mt-1 flex items-center gap-2 rounded-xl bg-[#122A52] border border-white/10 px-3 focus-within:border-blue-400">
            <User size={16} className="text-[#9DB4DC] shrink-0" />
            <input name="username" autoComplete="username" autoCapitalize="none"
              className="w-full bg-transparent py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none"
              value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
        </label>

        <PasswordInput dark value={password} onChange={setPassword} onEnter={submit} />

        {err && <p className="text-sm text-red-200 bg-red-500/10 border border-red-400/30 rounded-xl px-4 py-3">{err}</p>}

        <button type="submit" disabled={busy}
          className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 text-sm disabled:opacity-50">
          {busy ? "Ap konekte..." : "Konekte"}
        </button>

        <p className="text-center text-[11px] text-slate-500">
          <Link href="/confidentialite" className="hover:underline">Politique de confidentialité</Link>
        </p>
      </form>
    </div>
  );
}
