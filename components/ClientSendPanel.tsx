"use client";
/*
 * ENVOYER AU CLIENT (fiche client) : trois envois séparés sur WhatsApp.
 *  1. Adresse de dépôt seule.
 *  2. Identifiants actuels (même mot de passe, rien n'est changé).
 *  3. Nouveau mot de passe (l'ancien cesse de fonctionner).
 */
import { useState } from "react";
import { KeyRound, MapPin, RefreshCw } from "lucide-react";
import { adminApi } from "@/lib/authx";
import { openCredentialsWhatsApp, openDepotWhatsApp } from "@/lib/whatsapp";
import type { Client } from "@/lib/types";

type Creds = { username: string; password: string; fresh: boolean };

export default function ClientSendPanel({ client, onNotice }: { client: Client; onNotice: (message: string) => void }) {
  const [busy, setBusy] = useState<"creds" | "reset" | null>(null);
  const [creds, setCreds] = useState<Creds | null>(null);
  const hasPhone = !!(client.whatsapp || client.phone);
  const active = !!client.customer_code;

  const currentCreds = async () => {
    setBusy("creds");
    try {
      const j = await adminApi("client_credentials", { client_id: client.id });
      if (!j?.ok) { onNotice(j?.reason ?? "Identifiants indisponibles."); return; }
      setCreds({ username: j.username, password: j.password, fresh: false });
    } finally { setBusy(null); }
  };

  const newPassword = async () => {
    if (!confirm(`Créer un NOUVEAU mot de passe pour ${client.customer_code} ?\n\nL'ancien mot de passe ne fonctionnera plus.`)) return;
    setBusy("reset");
    try {
      const j = await adminApi("reset_client_password", { client_id: client.id });
      if (!j?.ok) { onNotice(j?.reason ?? "Échec."); return; }
      setCreds({ username: j.username, password: j.password, fresh: true });
    } finally { setBusy(null); }
  };

  return (
    <section className="card p-4">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-navy">Envoyer au client (WhatsApp)</h2>
      {!hasPhone && <p className="mb-2 text-xs text-amber-700">Aucun numéro WhatsApp ni téléphone sur la fiche.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost border border-line" disabled={!hasPhone || !active}
          onClick={() => openDepotWhatsApp(client)} title="Adresse de dépôt à Miami, sans mot de passe">
          <MapPin size={15} /> Adresse de dépôt
        </button>
        <button type="button" className="btn btn-ghost border border-line" disabled={!active || busy !== null}
          onClick={() => void currentCreds()} title="Nom d'utilisateur et mot de passe actuels, sans les changer">
          <KeyRound size={15} /> {busy === "creds" ? "Vérification…" : "Identifiants actuels"}
        </button>
        <button type="button" className="btn btn-ghost border border-line" disabled={!active || busy !== null}
          onClick={() => void newPassword()} title="Crée un nouveau mot de passe (l'ancien ne marche plus)">
          <RefreshCw size={15} /> {busy === "reset" ? "Création…" : "Nouveau mot de passe"}
        </button>
      </div>
      {!active && <p className="mt-2 text-xs text-slate-500">Le compte doit d&apos;abord être activé avec un code MC.</p>}

      {creds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCreds(null)}>
          <div className="card w-full max-w-sm space-y-3 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-navy">{creds.fresh ? "Nouveau mot de passe créé" : "Identifiants actuels du client"}</h3>
            <div className="space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
              <p>Nom d&apos;utilisateur : <span className="select-all font-mono font-bold">{creds.username}</span></p>
              <p>Mot de passe : <span className="select-all font-mono font-bold">{creds.password}</span></p>
            </div>
            <div className="flex flex-wrap gap-2">
              {hasPhone && (
                <button type="button" className="btn" onClick={() => openCredentialsWhatsApp(client, creds.username, creds.password, creds.fresh)}>
                  📲 Envoyer sur WhatsApp
                </button>
              )}
              <button type="button" className="btn btn-ghost border border-line" onClick={() => setCreds(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
