import { pickupLocationForCity, type ActivePickupAgency } from "./pickup-location";
import type { Client, Ville } from "./types";

/**
 * ZONE DE RÉCUPÉRATION D'UN CLIENT
 * La ville choisie (clients.ville_id) décide de tout : la zone de l'agent de
 * remise, la ville affichée (clients.city) et l'agence (clients.pickup_location).
 * Même règle que l'inscription en ligne (app/api/register-client).
 */
const cityKey = (value: string) => String(value ?? "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("fr-CA").replace(/[^a-z0-9]/g, "");

/** Ville du client : son ville_id ; sinon, la ville dont le nom correspond à sa ville écrite. */
export function resolveClientVille(client: Pick<Client, "ville_id"> & { city?: string | null }, villes: Ville[]): Ville | null {
  const byId = client.ville_id ? villes.find((ville) => ville.id === client.ville_id) : undefined;
  if (byId) return byId;
  const city = cityKey(client.city ?? "");
  if (!city) return null;
  return villes.find((ville) => cityKey(ville.name) === city)
    ?? villes.find((ville) => { const name = cityKey(ville.name); return name.length >= 4 && (city.includes(name) || name.includes(city)); })
    ?? null;
}

export type ZoneFix = {
  client: Client;
  ville: Ville | null;
  pickup: string;
  /** Champs à corriger ; vide = déjà correct. */
  patch: { ville_id?: string; city?: string; pickup_location?: string };
  problem: string;
};

/** Ce qui doit changer pour qu'un client corresponde à sa ville et à son agence. */
export function clientZoneFix(client: Client, villes: Ville[], agencies: ActivePickupAgency[]): ZoneFix {
  const ville = resolveClientVille(client as Client & { city?: string | null }, villes);
  if (!ville?.id) return { client, ville: null, pickup: "", patch: {}, problem: "Ville inconnue : à choisir dans la fiche du client." };
  const agency = pickupLocationForCity(ville.name, agencies);
  const pickup = agency ? agency.nom.trim() : "";
  const patch: ZoneFix["patch"] = {};
  if (client.ville_id !== ville.id) patch.ville_id = ville.id;
  if (String((client as Client & { city?: string | null }).city ?? "").trim() !== ville.name) patch.city = ville.name;
  if (pickup && String(client.pickup_location ?? "").trim() !== pickup) patch.pickup_location = pickup;
  return { client, ville, pickup, patch, problem: pickup ? "" : `Aucune agence active pour ${ville.name}.` };
}
