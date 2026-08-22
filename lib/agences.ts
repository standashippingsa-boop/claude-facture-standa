import { supabase } from "./supabase";

/**
 * STANDA COMMERCIAL — AJANS / PWEN RETRAIT AN AYITI
 * ══════════════════════════════════════════════════
 * ⚠️ FICHYE SA A DWE RETE "SÈVÈ-SAN-DANJE" (pa gen "use client" ladan l),
 *    menm règ ak lib/site.ts ak lib/depot.ts — konsa paj SÈVÈ a
 *    (app/agences/page.tsx, ki PA "use client") ka enpòte fonksyon
 *    getAgences() la san danje (li tou de mache nan sèvè AK nan navigatè).
 *
 * Done ajans yo VINN nan Supabase kounye a (tab "agences"), PA nan yon
 * fichye tankou lib/depot.ts. Pou modifye yon ajans: paj admin
 * /settings/agences (PA touche kòd la).
 */

export interface Agence {
  id?: string;
  nom: string;         // Ex: "Ouanaminthe"
  adresse: string;     // Ex: "Rue la Liberté, Maranatha Entreprise (à l'étage)"
  telephone: string;   // fòma afichaj, Ex: "+509 4673 8117"
  whatsapp: string;    // fòma wa.me (san espas ni "+"), Ex: "50946738117"
  horaire_1: string;   // Ex: "Lundi – Samedi : 08h00 – 17h00"
  horaire_2: string;   // Ex: "Dimanche : Fermé" (kite vid si pa aplikab)
  note: string;        // nòt espesyal opsyonèl, Ex: "Service de livraison seulement"
  ordre: number;       // lòd afichaj sou paj piblik la (pi piti a anvan)
  active: boolean;     // dezaktive = pa parèt sou /agences ankò (san efase l)
  created_at?: string;
}

const EMPTY_AGENCE: Omit<Agence, "id" | "created_at"> = {
  nom: "", adresse: "", telephone: "", whatsapp: "",
  horaire_1: "", horaire_2: "", note: "", ordre: 0, active: true
};
export function blankAgence(): Agence {
  return { ...EMPTY_AGENCE };
}

/** Ajans AKTIF yo sèlman, triye pa lòd afichaj — pou paj PIBLIK /agences. */
export async function getAgences(): Promise<Agence[]> {
  const { data, error } = await supabase
    .from("agences")
    .select("*")
    .eq("active", true)
    .order("ordre", { ascending: true })
    .order("nom", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Agence[];
}

/** TOUT ajans yo (aktif + dezaktive) — pou paj ADMIN /settings/agences. */
export async function getAllAgences(): Promise<Agence[]> {
  const { data, error } = await supabase
    .from("agences")
    .select("*")
    .order("ordre", { ascending: true })
    .order("nom", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Agence[];
}

/** Kreye yon nouvo ajans (san id) oswa mete yon ajans ki egziste ajou (ak id). */
export async function upsertAgence(a: Agence): Promise<void> {
  const row = {
    nom: a.nom.trim(),
    adresse: a.adresse.trim(),
    telephone: a.telephone.trim(),
    whatsapp: a.whatsapp.replace(/[^\d]/g, ""),   // wa.me mande chif sèlman
    horaire_1: a.horaire_1.trim(),
    horaire_2: a.horaire_2.trim(),
    note: a.note.trim(),
    ordre: Number(a.ordre) || 0,
    active: !!a.active
  };
  const { error } = a.id
    ? await supabase.from("agences").update(row).eq("id", a.id)
    : await supabase.from("agences").insert(row);
  if (error) throw error;
}

export async function deleteAgence(id: string): Promise<void> {
  const { error } = await supabase.from("agences").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleAgence(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("agences").update({ active }).eq("id", id);
  if (error) throw error;
}
