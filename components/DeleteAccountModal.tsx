"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

const CONFIRMATION = "SUPPRIMER";

/**
 * Suppression de compte par le client (obligatoire pour Google Play et
 * l'App Store). Deux garde-fous : le client doit taper SUPPRIMER, et le serveur
 * refuse tant qu'un colis est en cours ou qu'une facture reste à payer.
 */
export default function DeleteAccountModal({ whatsappHref, onClose }: { whatsappHref: string; onClose: () => void }) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<{ text: string; blocked: boolean } | null>(null);
  const ready = typed.trim().toUpperCase() === CONFIRMATION;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch("/api/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ confirmation: CONFIRMATION })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        setError({ text: result.reason || "Suppression impossible pour le moment.", blocked: Boolean(result.blocked) });
        return;
      }
      setDone(true);
      // La session n'existe plus côté serveur : on la ferme aussi sur l'appareil.
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      window.setTimeout(() => router.replace("/espace-client/connexion"), 2200);
    } catch {
      setError({ text: "Connexion impossible. Vérifiez votre réseau et réessayez.", blocked: false });
    } finally {
      setBusy(false);
    }
  };

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => { if (!busy && !done) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label="Supprimer mon compte" className="card w-full max-w-sm space-y-4 p-6" onClick={(event) => event.stopPropagation()}>
      {done ? <div className="space-y-3 py-4 text-center">
        <CheckCircle2 className="mx-auto text-emerald-500" size={56} />
        <h2 className="text-lg font-extrabold text-ink">Compte supprimé</h2>
        <p className="text-sm text-mute">Vos informations personnelles ont été effacées. Merci d&apos;avoir utilisé STANDA COMMERCIAL.</p>
      </div> : <>
        <div className="flex items-start justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-red-700"><Trash2 size={18} /> Supprimer mon compte</h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Fermer" className="text-slate-400 hover:text-navy"><X size={18} /></button>
        </div>
        <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>Cette action est <b>définitive</b>. Votre nom, vos coordonnées, votre adresse, votre pièce d&apos;identité et vos notifications seront effacés, et vous ne pourrez plus vous connecter. Vos colis et factures déjà traités restent conservés, sans votre identité, pour nos obligations comptables et douanières.</p>
        </div>
        <label className="block">
          <span className="text-xs font-semibold text-mute">Tapez {CONFIRMATION} pour confirmer</span>
          <input className="input mt-1" value={typed} onChange={(event) => setTyped(event.target.value)} autoCapitalize="characters" autoComplete="off" onKeyDown={(event) => { if (event.key === "Enter") void submit(); }} />
        </label>
        {error && <div role="alert" className="space-y-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <p>{error.text}</p>
          {error.blocked && <a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-block font-bold underline">Écrire à STANDA sur WhatsApp</a>}
        </div>}
        <button type="button" onClick={() => void submit()} disabled={!ready || busy} className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40">
          {busy ? "Suppression en cours…" : "Supprimer définitivement mon compte"}
        </button>
        <button type="button" onClick={onClose} disabled={busy} className="w-full text-center text-sm font-semibold text-mute hover:text-navy">Annuler</button>
      </>}
    </div>
  </div>;
}
