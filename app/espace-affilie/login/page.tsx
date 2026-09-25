"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, LogIn } from "lucide-react";
import Logo from "@/components/Logo";

/**
 * PÒTAY AFILYE — koneksyon.
 * Afilye yo PA Supabase Auth: fòm sa a rele /api/affiliate-portal (cookie
 * httpOnly). Zewo enpòtasyon @/lib/db oswa @/lib/supabase isit la.
 */
export default function AffiliateLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const res = await fetch("/api/affiliate-portal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", username, password })
      });
      const j = await res.json();
      if (!j.ok) { setError(j.reason || "Connexion impossible."); return; }
      router.push("/espace-affilie");
    } catch {
      setError("Impossible de joindre le service. Réessayez.");
    } finally { setBusy(false); }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#061937] text-white">
      <div className="mx-auto max-w-md px-5 py-10 sm:px-8">
        <Link href="/accueil" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/75 transition hover:text-white">
          <ArrowLeft size={15} /> Retour au site
        </Link>
        <div className="mt-8 flex flex-col items-center text-center">
          <Logo size={48} rounded="rounded-xl" tone="light" />
          <p className="mt-4 text-[11px] font-bold uppercase tracking-[.18em] text-orange-200">Espace Affilié</p>
          <h1 className="text-[24px] font-black tracking-[-.03em]">Connexion</h1>
        </div>
        <form onSubmit={submit} className="mt-8 space-y-3 rounded-[1.75rem] border border-white/15 bg-white/[.08] p-6 backdrop-blur-2xl">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-white/70">Identifiant</span>
            <input value={username} onChange={(e) => setUsername(e.target.value.toUpperCase())} required
              autoCapitalize="characters" autoCorrect="off" spellCheck={false} autoComplete="username" placeholder="Votre code affilié"
              className="w-full rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-[14px] text-white outline-none focus:border-orange-300" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-white/70">Mot de passe</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="current-password"
              className="w-full rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-[14px] text-white outline-none focus:border-orange-300" />
          </label>
          {error && <p className="rounded-xl bg-red-500/15 px-3.5 py-2.5 text-[13px] text-red-200">{error}</p>}
          <button type="submit" disabled={busy}
            className="mt-1 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 text-[14px] font-bold text-white transition hover:-translate-y-0.5 hover:bg-orange-600 disabled:opacity-60">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />} {busy ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
