/**
 * AJAN RESEPSYON — MÒD SAN ENTÈNÈT
 * ═══════════════════════════════════════════════════════════════════
 * Dajabon / depo a souvan pa gen rezo. Telefòn ajan an kenbe:
 *   • yon KOPI lis kliyan yo (kòd, non, vil SÈLMAN — okenn telefòn, adrès
 *     ni fakti) pou rechèch la mache san rezo;
 *   • yon FIL DATANT pou Conduce li anrejistre san rezo — yo voye pou kont
 *     yo depi telefòn nan jwenn entènèt.
 * Tout bagay rete nan localStorage aparèy la epi li efase lè ajan an dekonekte.
 */
export type ReceptionClient = { customer_code: string; fullname: string; ville_name: string; miami_count: number };
export type QueuedConduce = { number: string; office: string; at: string };

const DIRECTORY_KEY = "standa-reception-directory";
const QUEUE_KEY = "standa-reception-queue";
const AGENT_KEY = "standa-reception-agent";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* espas plen: mòd san rezo a jis mwens konplè */ }
}

export function saveDirectory(clients: ReceptionClient[]) {
  write(DIRECTORY_KEY, { at: new Date().toISOString(), clients });
}
export function loadDirectory(): { at: string; clients: ReceptionClient[] } | null {
  const value = read<{ at: string; clients: ReceptionClient[] } | null>(DIRECTORY_KEY, null);
  return value && Array.isArray(value.clients) ? value : null;
}

/** Menm lojik ak sèvè a: kòd (ak/san "MC-") oswa non; match egzat la an premye. */
export function searchDirectory(clients: ReceptionClient[], query: string, normalizedCode: string): ReceptionClient[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return clients
    .filter((c) => c.customer_code.toLowerCase().includes(q) || c.fullname.toLowerCase().includes(q) || c.customer_code === normalizedCode)
    .sort((a, b) => Number(b.customer_code === normalizedCode) - Number(a.customer_code === normalizedCode))
    .slice(0, 8);
}

export function loadQueue(): QueuedConduce[] {
  const value = read<QueuedConduce[]>(QUEUE_KEY, []);
  return Array.isArray(value) ? value : [];
}
export function saveQueue(queue: QueuedConduce[]) { write(QUEUE_KEY, queue); }

/** Ajoute yon Conduce nan fil la (yon sèl fwa pa nimewo). */
export function enqueueConduce(number: string, office: string): QueuedConduce[] {
  const queue = loadQueue().filter((item) => item.number !== number);
  queue.push({ number, office, at: new Date().toISOString() });
  saveQueue(queue);
  return queue;
}

/** Non ajan ki te konekte sou aparèy sa a — li otorize ekran an louvri san rezo. */
export function rememberAgent(name: string) { write(AGENT_KEY, { name }); }
export function rememberedAgent(): string | null {
  const value = read<{ name?: string } | null>(AGENT_KEY, null);
  return value ? String(value.name ?? "") : null;
}

export function clearReceptionOffline() {
  try { [DIRECTORY_KEY, QUEUE_KEY, AGENT_KEY].forEach((key) => localStorage.removeItem(key)); } catch { /* noop */ }
}

/** navigator.onLine ka bay manti (wifi san entènèt): nou verifye ak yon ti fichye. */
export async function isOffline(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    await fetch("/manifest-reception.webmanifest", { cache: "no-store", signal: controller.signal });
    clearTimeout(timer);
    return false;
  } catch { return true; }
}
