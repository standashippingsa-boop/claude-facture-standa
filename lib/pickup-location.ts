/**
 * Point de retrait associé à une ville.
 *
 * La ville du client et le nom d'une agence sont gérés dans deux listes
 * administratives distinctes. Cette fonction les relie de façon tolérante
 * (accents, espaces et « Agence Gonaïves ») afin que le même choix soit fait
 * dans le formulaire public et par l'API serveur.
 */
export type ActivePickupAgency = { nom: string; ordre?: number | null };

function key(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-CA")
    .replace(/[^a-z0-9]/g, "");
}

export function pickupLocationForCity(
  cityName: string,
  agencies: ActivePickupAgency[]
): ActivePickupAgency | null {
  const city = key(cityName);
  if (!city) return null;

  const ordered = [...agencies]
    .filter((agency) => String(agency.nom ?? "").trim())
    .sort((a, b) => (Number(a.ordre) || 0) - (Number(b.ordre) || 0));

  return ordered.find((agency) => key(agency.nom) === city)
    ?? ordered.find((agency) => key(agency.nom).includes(city) || city.includes(key(agency.nom)))
    ?? null;
}
