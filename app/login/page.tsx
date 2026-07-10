"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

        <button className="btn w-full justify-center py-3" onClick={submit} disabled={busy}>
          {busy ? "Ap konekte..." : "Konekte"}
        </button>

        <p className="text-center text-xs text-slate-500">
          Ou poko gen kont? <Link href="/inscription" className="text-navy font-semibold underline">Enskri la a</Link>
        </p>
      </div>
    </div>
  );
}
