"use client";

import { supabase } from "@/lib/supabase";

export type SecureDocumentKind = "invoice" | "bon-remise";

/**
 * Ouvre un document sans jamais exposer l'URL Storage au navigateur.
 * L'API vérifie la session et la propriété du document avant de renvoyer le
 * fichier; le navigateur reçoit seulement un Blob rattaché au domaine STANDA.
 */
export async function openSecureDocument(kind: SecureDocumentKind, id: string): Promise<void> {
  const preview = window.open("about:blank", "_blank");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    preview?.close();
    throw new Error("Session expirée. Reconnectez-vous puis réessayez.");
  }

  const response = await fetch(`/api/documents/${kind}/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    preview?.close();
    const body = await response.json().catch(() => null);
    throw new Error(String(body?.reason ?? "Document indisponible."));
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  if (preview) {
    preview.location.replace(url);
  } else {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.click();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
