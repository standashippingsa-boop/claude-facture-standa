"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** Kreye PREMYE administratè a (mache sèlman si tab staff la vid). */
export default function SetupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nom, setNom] = useState("");
  const [setupSecret, setSetupSecret] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(null); setBusy(true);
    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bootstrap", username, password, nom, setup_secret: setupSecret })
      });
      const j = await res.json();
      if (!j.ok) { setErr(j.reason ?? "Erè."); return; }
      router.replace("/admin-login");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-mist grid place-items-center p-6">
      <div className="card p-8 max-w-md w-full space-y-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="mx-auto h-16 object-contain" />
        <h1 className="text-lg font-extrabold text-navy text-center">Konfigirasyon inisyal — Administrateur</h1>
        <p className="text-xs text-slate-500 text-center">
          Kreye premye kont administratè a. Paj sa a mache yon sèl fwa.
        </p>
        <label className="block"><span className="text-xs font-semibold text-slate-600">Non konplè</span>
          <input className="input mt-1" value={nom} onChange={(e) => setNom(e.target.value)} /></label>
        <label className="block"><span className="text-xs font-semibold text-slate-600">Nom d&apos;utilisateur *</span>
          <input className="input mt-1" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ex: admin" /></label>
        <label className="block"><span className="text-xs font-semibold text-slate-600">Mot de passe * (6+ karaktè)</span>
          <input type="password" className="input mt-1" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <label className="block"><span className="text-xs font-semibold text-slate-600">Clé d&apos;installation * (SETUP_SECRET)</span>
          <input type="password" className="input mt-1" value={setupSecret} onChange={(e) => setSetupSecret(e.target.value)}
            placeholder="valè SETUP_SECRET nan Vercel" autoComplete="off" /></label>
        {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{err}</p>}
        <button className="btn w-full justify-center py-3" onClick={submit} disabled={busy}>
          {busy ? "Ap kreye..." : "Kreye administratè a"}
        </button>
      </div>
    </div>
  );
}
