import Fuse from "fuse.js";

/** minuscules + sans accents : "Gonaïves" et "gonaives" deviennent identiques. */
const strip = (value: unknown) =>
  String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

type FuzzyClient = { id?: string | null; fullname: string; surname?: string | null; customer_code?: string | null; email?: string | null };

/**
 * Rechèch ki tolere fòt (non, kòd, imèl) pou lis kliyan yo : "Jan Baptis" jwenn
 * "Jean Baptiste", "gonaives" jwenn "Gonaïves".
 *
 * Retounen SÈLMAN id kliyan ki matche flou. Rechèch egzak la (includes) rete
 * nan paj la epi li toujou pase an premye : rezilta sa a se yon ajou, li pa
 * ranplase anyen. Telefòn pa antre isit la (yon chif ki sanble pa vle di menm moun).
 * Anba 3 karaktè : pa gen rechèch flou (twòp bri).
 */
export function fuzzyClientIds(clients: FuzzyClient[], query: string): Set<string> {
  const q = strip(query);
  if (q.length < 3) return new Set();
  const records = clients
    .filter((c) => c.id)
    .map((c) => ({
      id: c.id as string,
      name: strip(`${c.fullname} ${c.surname ?? ""}`),
      code: strip(c.customer_code),
      email: strip(c.email)
    }));
  const fuse = new Fuse(records, { keys: ["name", "code", "email"], threshold: 0.3, ignoreLocation: true, minMatchCharLength: 3 });
  return new Set(fuse.search(q, { limit: 50 }).map((hit) => hit.item.id));
}
