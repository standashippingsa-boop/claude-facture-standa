"use client";
/*
 * ENVOYER AU CLIENT (fiche client) : trois textes séparés, copiés d'un clic
 * pour être collés dans la conversation WhatsApp du client.
 *  1. Adresse de dépôt seule.
 *  2. Identifiants actuels (même mot de passe, rien n'est changé).
 *  3. Nouveau mot de passe (l'ancien cesse de fonctionner).
 */
import { useState } from "react";
import { Check, Copy, KeyRound, MapPin, RefreshCw } from "@/components/icons";
import { adminApi } from "@/lib/authx";
import { buildCredentialsMessage, buildDepotMessage } from "@/lib/depot";
import type { Client } from "@/lib/types";

type Creds = { username: string; password: string; fresh: boolean };

/** Copie dans le presse-papiers (avec repli pour les anciens navigateurs). */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch { return false; }
  }
}

export default function ClientSendPanel({ client, onNotice }: { client: Client; onNotice: (message: string) => void }) {
  const [busy, setBusy] = useState<"creds" | "reset" | null>(null);
  const [creds, setCreds] = useState<Creds | null>(null);
  const [copied, setCopied] = useState<"depot" | "creds" | null>(null);
  const active = !!client.customer_code;

  const copy = async (which: "depot" | "creds", text: string) => {
    if (await copyText(text)) {
      setCopied(which);
      setTimeout(() => setCopied((c) => (c === which ? null : c)), 2500);
    } else {
      onNotice("Copie impossible sur cet appareil : sélectionnez le texte à la main.");
    }
  };

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

  const credsText = creds ? buildCredentialsMessage(client, creds.username, creds.password, creds.fresh) : "";

  return (
    <section className="card p-4">
      <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-navy">Envoyer au client (WhatsApp)</h2>
      <p className="mb-3 text-xs text-slate-500">Le texte est copié : collez le dans la conversation WhatsApp du client.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost border border-line" disabled={!active}
          onClick={() => void copy("depot", buildDepotMessage(client))} title="Copie l'adresse de dépôt à Miami, sans mot de passe">
          {copied === "depot" ? <><Check size={15} /> Adresse copiée</> : <><MapPin size={15} /> Adresse de dépôt</>}
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
            <pre className="max-h-64 select-all overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-[13px] leading-relaxed text-ink">{credsText}</pre>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn" onClick={() => void copy("creds", credsText)}>
                {copied === "creds" ? <><Check size={15} /> Texte copié</> : <><Copy size={15} /> Copier le texte</>}
              </button>
              <button type="button" className="btn btn-ghost border border-line" onClick={() => setCreds(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
