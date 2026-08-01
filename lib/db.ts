import { supabase } from "./supabase";
import { cleanTracking, isGuia, normalizeMcCode } from "./utils";
import {
  AccountType, Client, DashboardStats, ImportLog, Invoice, InvoiceItem, Pkg, Ville
, Retrait, RetraitStatus
} from "./types";
import { McpackRow } from "./xlsx";
import { computePrice, computeLinePrice, DEFAULT_SMALL_PARCEL, DEFAULT_SMALL_PARCEL_PRICE, isSmallParcel, round2, SmallParcelConfig } from "./pricing";
import type { PdfPkgRow } from "./pdfimport";
import { computeInvoice, InvoiceComputation, verifyTotal } from "./invoice-engine";

const asNum = <T extends Record<string, any>>(r: T, keys: string[]): T => {
  keys.forEach((k) => (r[k as keyof T] = Number(r[k]) as any));
  return r;
};

// ================= CLIENTS =================
const CLIENT_SELECT = "*, ville:villes(id,name,price_personal,price_business,tax_personal,tax_business,fixed_fee,active)";

export async function getClients(): Promise<Client[]> {
  const { data, error } = await supabase.from("clients").select(CLIENT_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Client[]).map((c) => ({ ...c, customer_code: c.customer_code ?? "" }));
}
export async function getClient(code: string): Promise<Client | null> {
  const { data } = await supabase.from("clients").select(CLIENT_SELECT)
    .eq("customer_code", code).maybeSingle();
  return data as Client | null;
}
/** Map kòd kliyan -> { vil, tip kont } (pou tarification rapid) */
export interface ClientTarifInfo {
  ville: Ville | null;
  account_type: AccountType;
  phone: string;      // telefòn + WhatsApp (pou rechèch avanse)
  fullname: string;
  email: string;      // pou email otomatik yo (Reçu à Miami / Disponible)
}
export async function getClientTarifMap(): Promise<Map<string, ClientTarifInfo>> {
  const cs = await getClients();
  return new Map(cs.map((c) => [c.customer_code, {
    ville: c.ville ?? null,
    account_type: c.account_type ?? "Personnel",
    phone: [c.phone, c.whatsapp].filter(Boolean).join(" "),
    fullname: [c.fullname, c.surname].filter(Boolean).join(" "),
    email: c.email ?? ""
  }]));
}
export async function upsertClient(c: Client): Promise<void> {
  const row = {
    customer_code: normalizeMcCode(c.customer_code),
    fullname: c.fullname.trim(),
    whatsapp: c.whatsapp.trim(),
    pickup_location: c.pickup_location.trim(),
    email: c.email?.trim() || null,
    ville_id: c.ville_id || null,
    account_type: c.account_type || "Personnel"
  };
  const { error } = c.id
    ? await supabase.from("clients").update(row).eq("id", c.id)
    : await supabase.from("clients").insert(row);
  if (error) throw error;
}
export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}

// ================= PACKAGES =================
export async function getPackages(status?: string, includeArchived = false): Promise<Pkg[]> {
  let q = supabase.from("packages").select("*").order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []).map((p) =>
    asNum(p, ["weight", "fob", "price_usd", "tax_usd", "total_usd", "price_htg", "tax_htg", "total_htg"])) as Pkg[];
  // Filtre nan JS -> pa kraze si migration 'archived' poko kouri (pwen #4)
  return includeArchived ? rows : rows.filter((p) => !p.archived);
}

/** Archive yon koli (pwen #4 — koli pa janm efase, done rete nan baz la) */
export async function archivePackage(id: string, by = ""): Promise<void> {
  const { error } = await supabase.from("packages")
    .update({ archived: true, archived_at: new Date().toISOString(), archived_by: by })
    .eq("id", id);
  if (error) throw error;
}
export async function unarchivePackage(id: string): Promise<void> {
  const { error } = await supabase.from("packages")
    .update({ archived: false, archived_at: null })
    .eq("id", id);
  if (error) throw error;
}
export async function getClientPackages(code: string): Promise<Pkg[]> {
  const { data, error } = await supabase
    .from("packages").select("*").eq("customer_code", code)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((p) =>
    asNum(p, ["weight", "price_usd", "tax_usd", "total_usd", "price_htg", "tax_htg", "total_htg"]))
    .filter((p: Pkg) => !p.archived) as Pkg[];
}
/** Anrejistre pri a an USD epi kalkile ekivalan HTG ak taux aktyèl la */
export async function updatePackagePrice(id: string, priceUsd: number, taxUsd: number, rate: number): Promise<void> {
  const { error } = await supabase.from("packages").update({
    price_usd: priceUsd, tax_usd: taxUsd,
    price_htg: round2(priceUsd * rate), tax_htg: round2(taxUsd * rate)
  }).eq("id", id);
  if (error) throw error;
}
export async function setPackageStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.from("packages").update({ status }).eq("id", id);
  if (error) throw error;
}
/** Admin SÈLMAN: mete menm statut entèn nan sou plizyè koli alafwa */
export async function setPackagesStatus(ids: string[], status: string): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase.from("packages")
    .update({ status }).in("id", ids);
  if (error) throw error;
}
/** Konpatibilite: rakousi pou "Disponible" */
export async function markDisponible(ids: string[]): Promise<void> {
  return setPackagesStatus(ids, "Disponible");
}
/** Tracking Number (transpòtè) — admin antre l manyèlman; sync pa janm ranplase l */
export async function saveTrackingManual(id: string, tracking_manual: string): Promise<void> {
  const { error } = await supabase.from("packages")
    .update({ tracking_manual: tracking_manual.trim() }).eq("id", id);
  if (error) throw error;
}

export async function deletePackage(id: string): Promise<void> {
  const { error } = await supabase.from("packages").delete().eq("id", id);
  if (error) throw error;
}

// ================= SYNC MCPACK =================
export interface SyncPreview {
  /** Koli ki deja nan sistèm nan: sync mete ajou statut MCPACK yo SÈLMAN
      (li pa manyen statut entèn, pri, ni Tracking Number manyèl la). */
  existingStatusRows: { tracking_number: string; status_raw: string }[];
  totalRows: number;
  newRows: McpackRow[];
  existing: number;
  newClientCodes: string[];
  errors: number;
}

/** Konpare fichye a ak bazdone a SAN anrejistre anyen (preview) */
export async function previewSync(rows: McpackRow[]): Promise<SyncPreview> {
  const trackings = rows.map((r) => r.tracking_number);
  const { data: exist, error } = await supabase
    .from("packages").select("tracking_number").in("tracking_number", trackings);
  if (error) throw error;
  const existSet = new Set((exist ?? []).map((e) => e.tracking_number));

  const seen = new Set<string>();
  const newRows: McpackRow[] = [];
  let existing = 0;
  const existingStatusRows: { tracking_number: string; status_raw: string }[] = [];
  for (const r of rows) {
    if (existSet.has(r.tracking_number) || seen.has(r.tracking_number)) {
      existing++;
      if (existSet.has(r.tracking_number) && r.status_raw?.trim())
        existingStatusRows.push({ tracking_number: r.tracking_number, status_raw: r.status_raw.trim() });
      continue;
    }
    seen.add(r.tracking_number);
    newRows.push(r);
  }

  const codes = Array.from(new Set(newRows.map((r) => r.customer_code).filter(Boolean)));
  let newClientCodes: string[] = [];
  if (codes.length) {
    const { data: cs } = await supabase.from("clients").select("customer_code").in("customer_code", codes);
    const have = new Set((cs ?? []).map((c) => c.customer_code));
    newClientCodes = codes.filter((c) => !have.has(c));
  }

  return { totalRows: rows.length, newRows, existing, existingStatusRows, newClientCodes, errors: 0 };
}

/** Valide importation: kreye kliyan ki manke yo + antre nouvo koli yo + log */
export async function commitSync(
  preview: SyncPreview, filename: string, autoPricing: boolean
): Promise<ImportLog> {
  // Enfo tarif chak kliyan (vil + tip kont). Nouvo kliyan poko gen vil.
  const tarifMap = autoPricing ? await getClientTarifMap() : new Map<string, ClientTarifInfo>();
  const rate = autoPricing ? await getUsdRate() : 0;
  // 1) Nouvo kliyan (stub — w ap konplete WhatsApp/pickup nan meni Clients)
  if (preview.newClientCodes.length) {
    const byCode = new Map(preview.newRows.map((r) => [r.customer_code, r.customer_name]));
    const { error } = await supabase.from("clients").upsert(
      preview.newClientCodes.map((code) => ({
        customer_code: code, fullname: byCode.get(code) || code
      })),
      { onConflict: "customer_code", ignoreDuplicates: true }
    );
    if (error) throw error;
  }

  // 2) Nouvo koli
  if (preview.newRows.length) {
    const { error } = await supabase.from("packages").upsert(
      preview.newRows.map((r) => {
        const info = tarifMap.get(r.customer_code);
        const p = autoPricing && info
          ? computePrice(r.weight, info.account_type, info.ville)
          : null;
        return {
          tracking_number: r.tracking_number,
          customer_code: r.customer_code,
          customer_name: r.customer_name,
          weight: r.weight,
          quantity: r.quantity,
          content: r.content,
          created_date: r.created_date,
          mcpack_data: r.extra ?? {},
          fob: r.fob || 0,
          tracking_manual: "",                       // admin antre l manyèlman — sync pa janm efase l
          status_mcpack: r.status_raw?.trim() || "", // statut MCPACK orijinal (enfòmatif)
          // Statut ENTÈN: se admin sèlman ki chanje l apre. Nouvo koli antre "Reçu à Miami".
          status: "Reçu à Miami",
          price_usd: p?.price ?? 0,
          tax_usd: p?.tax ?? 0,
          price_htg: p ? round2(p.price * rate) : 0,
          tax_htg: p ? round2(p.tax * rate) : 0
        };
      }),
      { onConflict: "tracking_number", ignoreDuplicates: true }
    );
    if (error) throw error;
  }

  // 2b) Koli ki egziste deja: mete ajou statut MCPACK orijinal la SÈLMAN.
  //     (Statut entèn, pri, tax, Tracking Number manyèl — sync PA manyen yo.)
  if (preview.existingStatusRows.length) {
    const byStatus = new Map<string, string[]>();
    for (const r of preview.existingStatusRows) {
      const list = byStatus.get(r.status_raw) ?? [];
      list.push(r.tracking_number);
      byStatus.set(r.status_raw, list);
    }
    for (const [statusRaw, trackings] of byStatus) {
      const { error } = await supabase.from("packages")
        .update({ status_mcpack: statusRaw })
        .in("tracking_number", trackings);
      if (error) throw error;
    }
  }

  // 3) Log importation an
  const log: ImportLog = {
    filename,
    total_rows: preview.totalRows,
    new_packages: preview.newRows.length,
    existing_packages: preview.existing,
    new_clients: preview.newClientCodes.length,
    errors: preview.errors
  };
  const { data, error } = await supabase.from("imports").insert(log).select().single();
  if (error) throw error;
  return data as ImportLog;
}

// ================= INVOICES =================
/** Opsyon fakti (montan admin chwazi yo + mòd). */
export interface InvoiceOptions {
  taxeFixe?: number;
  fraisDga?: number;
  discount?: number;
  mode?: "addition" | "small_control";
}

/**
 * Kreye fakti a APATI yon rezilta moteur finansye a (deja verifye).
 * Sa garanti pri/lb ak montan yo se EGZAKteman sa moteur la kalkile —
 * okenn rekalkil endepandan, okenn ansyen valè.
 */
export async function createInvoiceFromComputation(
  client: Client, comp: InvoiceComputation, rate: number,
  mode: "addition" | "small_control"
): Promise<Invoice> {
  // Sekirite: refize si moteur la pa t valide, oswa total pa kòrèk
  if (!comp.ok) throw new Error("Facture refusée: " + comp.errors.join(" "));
  if (!verifyTotal(comp)) throw new Error("Erreur de calcul détectée. Facture bloquée.");

  const invoice_number = "SC-" + Date.now().toString().slice(-6);
  const { data: inv, error } = await supabase.from("invoices").insert({
    invoice_number,
    customer_code: client.customer_code,
    customer_name: client.fullname,
    whatsapp: client.whatsapp,
    pickup_location: client.pickup_location,
    ville: comp.ville,
    subtotal: comp.subtotal,
    tax: comp.taxeFixe,
    frais_dga: comp.fraisDga,
    discount: comp.discount,
    grand_total: comp.totalUsd,
    exchange_rate_used: rate,
    total_usd: comp.totalUsd,
    total_htg: comp.totalHtg,
    package_count: comp.lines.length,
    total_weight: comp.totalWeight,
    calc_mode: mode,
    per_lb_used: comp.perLb
  }).select().single();
  if (error) throw error;

  const items = comp.lines.map((l) => ({
    invoice_id: inv.id,
    tracking_number: l.pkg.tracking_number,
    tracking_manual: l.pkg.tracking_manual ?? "",
    weight: l.weight,
    content: l.pkg.content,
    price: l.amount,
    tax: 0,
    total: l.amount
  }));
  const { error: e2 } = await supabase.from("invoice_items").insert(items);
  if (e2) throw e2;

  await Promise.all(comp.lines.map((l) =>
    supabase.from("packages").update({
      status: "Facturé", invoice_id: inv.id,
      price_usd: l.amount, tax_usd: 0,
      price_htg: round2(l.amount * rate), tax_htg: 0
    }).eq("id", l.pkg.id)
  ));

  // JOURNAL FINANCIER (§9)
  await logAction("Facturation",
    `${invoice_number} | Ville:${comp.ville} | Zone:${comp.zone} | Prix/LB:${comp.perLb} | ` +
    `Poids:${comp.totalWeight} | Sous-total:${comp.subtotal} | Taxe:${comp.taxeFixe} | ` +
    `DGA:${comp.fraisDga} | Discount:${comp.discount} | Mode:${mode} | TOTAL:${comp.totalUsd} USD`,
    invoice_number, client.customer_code);

  return asNum(inv, ["subtotal", "tax", "grand_total", "exchange_rate_used", "total_usd", "total_htg", "total_weight"]) as Invoice;
}

export async function getInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabase.from("invoices").select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((i) =>
    asNum(i, ["subtotal", "tax", "grand_total", "exchange_rate_used", "total_usd", "total_htg", "total_weight"])) as Invoice[];
}
export async function getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
  const { data, error } = await supabase.from("invoice_items").select("*")
    .eq("invoice_id", invoiceId);
  if (error) throw error;
  return (data ?? []).map((i) => asNum(i, ["weight", "price", "tax", "total"])) as InvoiceItem[];
}
export async function saveInvoicePdfUrl(id: string, url: string): Promise<void> {
  await supabase.from("invoices").update({ pdf_url: url }).eq("id", id);
}

// ================= TARIFICATION PAR VILLE =================
export async function getVilles(): Promise<Ville[]> {
  const { data, error } = await supabase.from("villes").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map((v) =>
    asNum(v, ["price_personal", "price_business", "tax_personal", "tax_business", "fixed_fee"])
  ) as Ville[];
}
export async function upsertVille(v: Ville): Promise<void> {
  const { id, created_at, ...row } = v as any;
  row.name = String(row.name).trim();
  const { error } = id
    ? await supabase.from("villes").update(row).eq("id", id)
    : await supabase.from("villes").insert(row);
  if (error) throw error;
}
export async function toggleVille(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("villes").update({ active }).eq("id", id);
  if (error) throw error;
}
export async function deleteVille(id: string): Promise<void> {
  const { error } = await supabase.from("villes").delete().eq("id", id);
  if (error) throw error;
}

// ================= TAUX DE CHANGE =================
export async function getUsdRate(): Promise<number> {
  const { data } = await supabase.from("exchange_rate").select("usd_rate").eq("id", 1).maybeSingle();
  return Number(data?.usd_rate) || 0;
}
export async function setUsdRate(rate: number): Promise<void> {
  const { error } = await supabase.from("exchange_rate")
    .upsert({ id: 1, usd_rate: rate, updated_at: new Date().toISOString() });
  if (error) throw error;
}
export async function getSmallParcelPrice(): Promise<number> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "small_parcel_price").maybeSingle();
  const n = Number(data?.value);
  return isNaN(n) || n <= 0 ? DEFAULT_SMALL_PARCEL_PRICE : n;
}

/** Konfigirasyon ti koli konplè (min / max / pri) — soti nan Paramètres. */
export async function getSmallParcelConfig(): Promise<SmallParcelConfig> {
  const s = await getSettings();
  const min = Number(s.small_parcel_min);
  const max = Number(s.small_parcel_max);
  const price = Number(s.small_parcel_price);
  return {
    min: isNaN(min) || min < 0 ? DEFAULT_SMALL_PARCEL.min : min,
    max: isNaN(max) || max <= 0 ? DEFAULT_SMALL_PARCEL.max : max,
    price: isNaN(price) || price <= 0 ? DEFAULT_SMALL_PARCEL.price : price
  };
}

// ================= API TOKENS (Extension Chrome) =================
export interface ApiToken {
  id: string; token: string; label: string; active: boolean;
  created_at: string; last_used_at: string | null;
}

export async function getApiTokens(): Promise<ApiToken[]> {
  const { data } = await supabase.from("api_tokens").select("*").order("created_at", { ascending: false });
  return (data ?? []) as ApiToken[];
}

/** Kreye yon token opak (32 bytes hex). Retounen valè a yon sèl fwa. */
export async function createApiToken(label: string): Promise<string> {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const token = "sk_" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const { error } = await supabase.from("api_tokens").insert({ token, label: label || "Extension Chrome", active: true });
  if (error) throw error;
  await logAction("API", `Token API kreye: ${label || "Extension Chrome"}`, "", "");
  return token;
}

export async function setApiTokenActive(id: string, active: boolean): Promise<void> {
  await supabase.from("api_tokens").update({ active }).eq("id", id);
  await logAction("API", `Token ${active ? "aktive" : "dezaktive"}`, "", "");
}

export async function deleteApiToken(id: string): Promise<void> {
  await supabase.from("api_tokens").delete().eq("id", id);
  await logAction("API", "Token API efase", "", "");
}

// ================= SETTINGS =================
export interface InvoiceFlags { taxFix: boolean; taxDga: boolean; }

/**
 * Tax Fix ak Tax DGA PA aktive pa defo (dekonekte nan kalkil fakti a).
 * Administratè a ka aktive yo nan Paramètres lè li vle.
 */
export async function getInvoiceFlags(): Promise<InvoiceFlags> {
  const s = await getSettings();
  return {
    taxFix: s.tax_fix_enabled === "true",
    taxDga: s.tax_dga_enabled === "true"
  };
}

export async function getSettings(): Promise<Record<string, string>> {
  const { data } = await supabase.from("app_settings").select("*");
  return Object.fromEntries((data ?? []).map((s) => [s.key, s.value]));
}
export async function setSetting(key: string, value: string): Promise<void> {
  await supabase.from("app_settings").upsert({ key, value });
}

// ================= DASHBOARD =================
export async function getStats(): Promise<DashboardStats> {
  const count = async (table: string, filter?: [string, string]) => {
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    if (filter) q = q.eq(filter[0], filter[1]);
    const { count: c } = await q;
    return c ?? 0;
  };
  const [totalClients, disponibles, factures, totalInvoices] = await Promise.all([
    count("clients"), count("packages", ["status", "Disponible"]),
    count("packages", ["status", "Facturé"]), count("invoices")
  ]);
  const { data: revs } = await supabase.from("invoices").select("grand_total");
  const revenue = (revs ?? []).reduce((s, r) => s + Number(r.grand_total), 0);
  const { data: imp } = await supabase.from("imports").select("*")
    .order("created_at", { ascending: false }).limit(1);
  return { totalClients, disponibles, factures, totalInvoices, revenue, lastImport: imp?.[0] ?? null };
}
export async function getImports(): Promise<ImportLog[]> {
  const { data } = await supabase.from("imports").select("*")
    .order("created_at", { ascending: false }).limit(20);
  return data ?? [];
}

// ================= ENSKRIPSYON KLIYAN (v6) =================

/** Kliyan an fin kreye kont Auth li — nou anrejistre pwofil li (En attente d'activation) */
export async function registerClientProfile(p: {
  auth_user_id?: string | null; fullname: string; surname: string; email: string;
  phone: string; whatsapp: string; country: string; city: string; city2: string;
  address: string; id_type: string; id_number: string;
  ville_id?: string | null;   // lyen otomatik ak tarification (vil kliyan an chwazi a)
}): Promise<void> {
  // ---- ANTI-DOUBLON (V7.2): si kliyan an deja egziste (kreye pa admin oswa
  //      pa sync MCPACK), nou METE AJOU kont li a — nou pa kreye yon 2yèm kont.
  //      Priyorite matching: Email -> WhatsApp -> Téléphone.
  const digits = (s: string) => s.replace(/\D/g, "");
  const all = await getClients();
  const found = all.find((c) =>
    (p.email && (c.email ?? "").trim().toLowerCase() === p.email.trim().toLowerCase()) ||
    (digits(p.whatsapp).length >= 7 &&
      (digits(c.whatsapp ?? "").endsWith(digits(p.whatsapp).slice(-8)) && digits(c.whatsapp ?? "").length >= 7)) ||
    (digits(p.phone).length >= 7 &&
      (digits(c.phone ?? "").endsWith(digits(p.phone).slice(-8)) && digits(c.phone ?? "").length >= 7)));

  if (found) {
    if (found.auth_user_id) {
      throw new Error("Ou gen yon kont deja sou sistèm nan. Konekte pito — oswa kontakte STANDA COMMERCIAL.");
    }
    // Mete ajou kliyan ki egziste a (kenbe kòd li + tout koli/fakti li yo)
    const { error } = await supabase.from("clients").update({
      ...p,
      auth_user_id: p.auth_user_id ?? null,
      // Si li deja gen kòd MCPACK -> li rete Actif; sinon li tann aktivasyon
      account_status: found.customer_code ? (found.account_status ?? "Actif") : "En attente d'activation"
    }).eq("id", found.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("clients").insert({
    ...p,
    auth_user_id: p.auth_user_id ?? null,
    customer_code: null,
    pickup_location: "",
    account_status: "En attente d'activation"
  });
  if (error) throw error;
}

export async function getClientByAuthId(uid: string): Promise<Client | null> {
  const { data } = await supabase.from("clients").select(CLIENT_SELECT)
    .eq("auth_user_id", uid).maybeSingle();
  if (!data) return null;
  return { ...(data as Client), customer_code: (data as any).customer_code ?? "" };
}

/** Admin: anrejistre kòd MC a -> kont lan vin Actif otomatikman */
export async function assignMcCode(clientId: string, code: string): Promise<void> {
  const { error } = await supabase.from("clients")
    .update({ customer_code: code.trim(), account_status: "Actif" })
    .eq("id", clientId);
  if (error) throw error;
}

/** Koli + fakti yon kliyan (pou espas kliyan an) */
export async function getClientPackagesAndInvoices(code: string) {
  if (!code) return { pkgs: [], invs: [] };
  const [p, i] = await Promise.all([
    supabase.from("packages").select("*").eq("customer_code", code).order("created_at", { ascending: false }),
    supabase.from("invoices").select("*").eq("customer_code", code).order("created_at", { ascending: false })
  ]);
  return { pkgs: (p.data ?? []).filter((x: Pkg) => !x.archived) as Pkg[], invs: (i.data ?? []) as Invoice[] };
}

// ================= DEMANDES DE RETRAIT (v8) =================

/** Kliyan an: "Notifier mon retrait" — kreye demann lan (pa chanje statut okenn koli) */
export async function createRetrait(client: Client, pkgs: Pkg[]): Promise<void> {
  const { data, error } = await supabase.from("retraits").insert({
    customer_code: client.customer_code,
    customer_name: [client.fullname, client.surname].filter(Boolean).join(" "),
    ville: client.ville?.name || client.city || "",
    package_count: pkgs.length,
    total_weight: round2(pkgs.reduce((s, p) => s + p.weight, 0)),
    status: "En attente"
  }).select().single();
  if (error) throw error;
  const items = pkgs.map((p) => ({
    retrait_id: data.id,
    tracking_number: p.tracking_number,
    tracking_manual: p.tracking_manual ?? "",
    content: p.content,
    weight: p.weight
  }));
  const { error: e2 } = await supabase.from("retrait_items").insert(items);
  if (e2) throw e2;
}

export async function getRetraits(): Promise<Retrait[]> {
  const { data, error } = await supabase.from("retraits")
    .select("*, items:retrait_items(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...r, total_weight: Number(r.total_weight) })) as Retrait[];
}

export async function getClientRetraits(code: string): Promise<Retrait[]> {
  if (!code) return [];
  const { data, error } = await supabase.from("retraits")
    .select("*, items:retrait_items(*)")
    .eq("customer_code", code)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...r, total_weight: Number(r.total_weight) })) as Retrait[];
}

export async function setRetraitStatus(id: string, status: RetraitStatus): Promise<void> {
  const { error } = await supabase.from("retraits").update({ status }).eq("id", id);
  if (error) throw error;
}

// ================= FUSION KONT KLIYAN (V7.2) =================

export interface DupGroup { key: string; reason: string; clients: Client[]; }

/** Jwenn kliyan ki sanble se menm moun (Kòd -> Email -> WhatsApp -> Telefòn -> Non+Prenon) */
export async function findDuplicateGroups(): Promise<DupGroup[]> {
  const all = await getClients();
  const digits = (s?: string | null) => String(s ?? "").replace(/\D/g, "");
  const used = new Set<string>();
  const groups: DupGroup[] = [];
  const push = (key: string, reason: string, list: Client[]) => {
    const fresh = list.filter((c) => !used.has(c.id!));
    if (fresh.length >= 2) {
      fresh.forEach((c) => used.add(c.id!));
      groups.push({ key, reason, clients: fresh });
    }
  };
  const by = (fn: (c: Client) => string, reason: string) => {
    const map = new Map<string, Client[]>();
    all.forEach((c) => { const k = fn(c); if (k) { const a = map.get(k) ?? []; a.push(c); map.set(k, a); } });
    map.forEach((list, k) => push(reason + ":" + k, reason, list));
  };
  by((c) => normalizeMcCode(c.customer_code) || "", "Customer Code");
  by((c) => (c.email ?? "").trim().toLowerCase(), "Email");
  by((c) => { const d = digits(c.whatsapp); return d.length >= 7 ? d.slice(-8) : ""; }, "WhatsApp");
  by((c) => { const d = digits(c.phone); return d.length >= 7 ? d.slice(-8) : ""; }, "Téléphone");
  by((c) => {
    const n = [c.fullname, c.surname].filter(Boolean).join(" ").trim().toLowerCase().replace(/\s+/g, " ");
    return n.length >= 6 ? n : "";
  }, "Nom + Prénom");
  return groups;
}

/**
 * Fusione 2 kont: tout done sekondè a (koli, fakti, retraits, chan pwofil ki vid
 * sou prensipal la) transfere sou kont prensipal la, answit kont sekondè a efase.
 */
export async function mergeClients(primary: Client, secondary: Client): Promise<void> {
  const pCode = normalizeMcCode(primary.customer_code);
  const sCode = normalizeMcCode(secondary.customer_code);

  // 1) Transfere referans yo (packages / invoices / retraits) sou kòd prensipal la
  if (sCode && pCode && sCode !== pCode) {
    for (const table of ["packages", "invoices", "retraits"]) {
      const { error } = await supabase.from(table)
        .update({ customer_code: pCode }).eq("customer_code", sCode);
      if (error) throw error;
    }
  }

  // 2) Konplete chan ki vid sou prensipal la ak done sekondè a (pa janm efase done)
  const patch: Record<string, unknown> = {};
  const fields = ["surname", "email", "phone", "whatsapp", "country", "city", "city2",
    "address", "id_type", "id_number", "ville_id", "auth_user_id", "username"] as const;
  fields.forEach((f) => {
    const pv = (primary as any)[f], sv = (secondary as any)[f];
    if ((pv === null || pv === undefined || pv === "") && sv) patch[f] = sv;
  });
  if (!pCode && sCode) patch.customer_code = sCode;
  if (primary.account_status !== "Actif" && secondary.account_status === "Actif") patch.account_status = "Actif";
  if (secondary.must_change_password && !primary.auth_user_id) patch.must_change_password = true;
  if (Object.keys(patch).length) {
    const { error } = await supabase.from("clients").update(patch).eq("id", primary.id);
    if (error) throw error;
  }

  // 3) Efase kont sekondè a — pa dwe rete okenn kliyan an doub
  const { error } = await supabase.from("clients").delete().eq("id", secondary.id);
  if (error) throw error;
}

// ================= JOURNAL (V8 Faz 1) =================
export async function logAction(action: string, details = "", packageRef = "", customerCode = "") {
  try {
    let userName = "";
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const { data: s } = await supabase.from("staff")
        .select("prenom, nom, role").eq("auth_user_id", data.user.id).maybeSingle();
      if (s) userName = (s.prenom ? s.prenom + " " : "") + (s.nom ?? "") + " (" + s.role + ")";
    }
    await supabase.from("journal").insert({
      user_name: userName.trim(), action, details, package_ref: packageRef, customer_code: customerCode
    });
  } catch { /* journal pa dwe janm bloke operasyon an */ }
}

export interface JournalRow {
  id: string; created_at: string; user_name: string; action: string;
  details: string; package_ref: string; customer_code: string;
}
export async function getJournal(limit = 300): Promise<JournalRow[]> {
  const { data } = await supabase.from("journal").select("*")
    .order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as JournalRow[];
}
export async function clearJournal(): Promise<void> {
  const { error } = await supabase.from("journal").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw error;
}

// ================= RE-TARIFICATION OTOMATIK (V8 Faz 1) =================
/**
 * Apre admin chanje pri yon vil nan Paramètres: tout koli Disponible
 * (PA facturés) mete ajou otomatikman ak nouvo pri a. Facturés yo pa touche.
 * Retounen kantite koli ki chanje.
 */
export async function reapplyTarifDisponible(): Promise<number> {
  const [tarif, rate, flags] = await Promise.all([getClientTarifMap(), getUsdRate(), getInvoiceFlags()]);
  const { data } = await supabase.from("packages")
    .select("*").eq("status", "Disponible");
  const pkgs = (data ?? []) as Pkg[];
  let n = 0;
  for (const p of pkgs) {
    const info = tarif.get(p.customer_code);
    if (!info) continue;
    const r = computePrice(p.weight, info.account_type, info.ville);
    if (!r) continue;
    const taxVal = flags.taxFix ? r.taxFix : 0;   // Tax Fix dekonekte pa defo
    if (round2(p.price_usd) !== r.price || round2(p.tax_usd) !== taxVal) {
      await supabase.from("packages").update({
        price_usd: r.price, tax_usd: taxVal,
        price_htg: round2(r.price * rate), tax_htg: round2(taxVal * rate),
      }).eq("id", p.id);
      n++;
    }
  }
  return n;
}

// ================= IMPORT PDF MCPACK (V8 Faz 2) =================

export interface PdfImportResult { created: number; updated: number; ignored: number; }

/**
 * Anrejistre koli ki soti nan yon PDF MCPACK, asosye ak kliyan admin chwazi a.
 * Anti-doublon pa Tracking Number: koli ki egziste PA re-kreye — enfo ki
 * manke sèlman mete ajou. Received method = "Import PDF".
 */
export async function commitPdfImport(
  rows: PdfPkgRow[], client: Client, autoPricing: boolean
): Promise<PdfImportResult> {
  const rate = autoPricing ? await getUsdRate() : 0;
  const info = autoPricing
    ? (await getClientTarifMap()).get(normalizeMcCode(client.customer_code)) ?? null : null;
  const now = new Date().toISOString();

  // V8.5: Guía (WR...) = tracking_number (idantifyan inik).
  //       Tracking transpòtè a (GFUS/TBA/1Z...) = tracking_manual.
  const guias = rows.map((r) => r.guia).filter(Boolean);
  const { data: exist } = await supabase.from("packages")
    .select("tracking_number, tracking_manual").in("tracking_number", guias);
  const existMap = new Map<string, { tracking_number: string; tracking_manual?: string }>(
    (exist ?? []).map((e: any) => [e.tracking_number as string, e]));

  let created = 0, updated = 0, ignored = 0;
  const seen = new Set<string>();

  for (const r of rows) {
    const guia = cleanTracking(r.guia);
    const carrier = cleanTracking(r.tracking_number);   // tracking transpòtè (pa Guía)
    if (!guia || seen.has(guia)) { ignored++; continue; }
    seen.add(guia);

    const hit = existMap.get(guia);
    if (hit) {
      const patch: Record<string, unknown> = { received_at: now, received_method: "Import PDF" };
      if (r.status_raw) patch.status_mcpack = r.status_raw;
      if (r.weight) patch.weight = r.weight;
      if (r.content) patch.content = r.content;
      // Ajoute Tracking Number si li poko egziste (pa ranplase l)
      if (carrier && !isGuia(carrier) && !hit.tracking_manual) patch.tracking_manual = carrier;
      await supabase.from("packages").update(patch).eq("tracking_number", guia);
      updated++;
    } else {
      const p = autoPricing && info ? computePrice(r.weight, info.account_type, info.ville) : null;
      await supabase.from("packages").insert({
        tracking_number: guia,                                   // Tracking ID (Guía)
        tracking_manual: carrier && !isGuia(carrier) ? carrier : "",  // Tracking Number
        customer_code: normalizeMcCode(client.customer_code),
        customer_name: client.fullname,
        weight: r.weight,
        content: r.content,
        created_date: r.created_date,
        status: "Reçu à Miami",
        status_mcpack: r.status_raw,
        received_at: now,
        received_method: "Import PDF",
        mcpack_data: { Guia: guia, Hora: r.heure },
        price_usd: p?.price ?? 0, tax_usd: p?.tax ?? 0,
        price_htg: p ? round2(p.price * rate) : 0, tax_htg: p ? round2(p.tax * rate) : 0
      });
      created++;
    }
  }
  await logAction("Import PDF",
    `${created} créés, ${updated} mis à jour, ${ignored} ignorés`, "", normalizeMcCode(client.customer_code));
  return { created, updated, ignored };
}

// ============================================================
// SCANNER — MODE ZÉRO RISQUE (lekti sèlman, okenn devinèt)
// ============================================================
// RÈG YO:
//  1. Scanner a PA JANM devine. Enfo ki pa sèten rete VID.
//  2. Scanner a PA JANM kreye yon koli (se Excel/PDF/Sync ki kreye).
//  3. Konfyans < 98% => okenn modifikasyon otomatik (validasyon manyèl).
//  4. Si enfo yo kontredi youn lòt => BLOKE, "Conflit détecté".
//  5. Scanner a ka modifye SÈLMAN: tracking_manual (si konfime),
//     received_at, received_method. JANM pwa/pri/tax/DGA/vil/kliyan/kòd.
//  6. Chak chanjman antre nan Historique ak ansyen + nouvo valè.

export type ScanVerdict = "validated" | "review" | "conflict" | "no_match";

export interface PhotoMatch {
  filename: string; previewUrl: string;
  guia: string; guiaSource: string;
  tracking_number: string; customer_code: string;
  confidence: number; step: string;
  matched: boolean;
  matchedPkgId?: string;
  matchedTracking?: string;
  matchedManual?: string;
  matchedCode?: string;
  matchedStatus?: string;
  verdict: ScanVerdict;
  message: string;
  conflicts: string[];
  /** Sèl chanjman scanner a pwopoze (simulation) */
  proposedTracking?: string;   // Tracking Number pou ajoute (si li konfime e chan an vid)
  canApply: boolean;           // èske modifikasyon otorize (konfyans + zewo konfli)
}

const MIN_CONFIDENCE = 98;   // RÈG N°3

/**
 * ANALIZE SÈLMAN — okenn ekriti nan bazdone.
 * Retounen egzakteman sa ki ta pral chanje (simulation).
 */
export async function analyzePhotoScans(scans: {
  filename: string; previewUrl: string; guia: string; guiaSource: string;
  tracking_number: string; customer_code: string; confidence: number; step: string;
}[]): Promise<PhotoMatch[]> {
  const { data } = await supabase.from("packages")
    .select("id, tracking_number, tracking_manual, customer_code, status");
  const pkgs = (data ?? []) as any[];

  const byGuia = new Map<string, any>();
  const byManual = new Map<string, any>();
  for (const p of pkgs) {
    if (p.tracking_number) byGuia.set(cleanTracking(p.tracking_number), p);
    if (p.tracking_manual) byManual.set(cleanTracking(p.tracking_manual), p);
  }

  return scans.map((s) => {
    const guia = isGuia(s.guia) ? cleanTracking(s.guia) : "";   // RÈG: WR sèlman
    const tnum = s.tracking_number && !isGuia(s.tracking_number)
      ? cleanTracking(s.tracking_number) : "";                  // RÈG: pa WR isit la
    const conflicts: string[] = [];

    const hitByGuia = guia ? byGuia.get(guia) ?? null : null;
    const hitByTnum = tnum ? (byManual.get(tnum) ?? byGuia.get(tnum) ?? null) : null;

    // RÈG N°4 — enfo ki kontredi youn lòt
    if (hitByGuia && hitByTnum && hitByGuia.id !== hitByTnum.id) {
      conflicts.push(`Tracking ID (${guia}) et Tracking Number (${tnum}) pointent vers 2 colis différents`);
    }
    const hit = hitByGuia ?? hitByTnum;
    if (hit && s.customer_code &&
        normalizeMcCode(s.customer_code) !== normalizeMcCode(hit.customer_code ?? "")) {
      conflicts.push(`Customer Code photo (${normalizeMcCode(s.customer_code)}) ≠ base (${hit.customer_code})`);
    }
    if (hit && tnum && hit.tracking_manual && cleanTracking(hit.tracking_manual) !== tnum) {
      conflicts.push(`Tracking Number photo (${tnum}) ≠ base (${hit.tracking_manual})`);
    }

    const base = { ...s, guia, tracking_number: tnum, conflicts };

    // ── Konfli => BLOKE
    if (conflicts.length) {
      return { ...base, matched: !!hit, matchedPkgId: hit?.id,
        matchedTracking: hit?.tracking_number, matchedManual: hit?.tracking_manual,
        matchedCode: hit?.customer_code, matchedStatus: hit?.status,
        verdict: "conflict" as ScanVerdict,
        message: "Conflit détecté. Validation manuelle obligatoire.",
        canApply: false };
    }

    // ── Pa jwenn okenn koli
    if (!hit) {
      let message: string;
      if (tnum && !guia) {
        message = "Tracking Number détecté mais aucun Tracking ID correspondant n'a été trouvé.";   // RÈG 6
      } else if (guia && !tnum) {
        message = "Tracking ID détecté. Aucun Tracking Number correspondant trouvé.";               // RÈG 7
      } else if (s.customer_code) {
        message = `Nou jwenn yon package pou kliyan ${normalizeMcCode(s.customer_code)} men foto a pa pèmèt nou idantifye Tracking ID oswa Tracking Number.`;
      } else {
        message = "Aucun code détecté — étiquette illisible.";
      }
      return { ...base, matched: false, verdict: "no_match" as ScanVerdict, message, canApply: false };
    }

    // ── Jwenn: verifye konfyans (RÈG N°3)
    const lowConf = s.confidence < MIN_CONFIDENCE;
    // Tracking Number pwopoze SÈLMAN si chan an vid nan baz la e li konfime
    const proposedTracking = tnum && !hit.tracking_manual ? tnum : undefined;

    return {
      ...base, matched: true, matchedPkgId: hit.id,
      matchedTracking: hit.tracking_number, matchedManual: hit.tracking_manual,
      matchedCode: hit.customer_code, matchedStatus: hit.status,
      verdict: (lowConf ? "review" : "validated") as ScanVerdict,
      message: lowConf
        ? `Confiance ${Math.round(s.confidence)}% < ${MIN_CONFIDENCE}% — validation manuelle requise`
        : proposedTracking
          ? `Colis identifié — Tracking Number "${proposedTracking}" sera ajouté (champ vide)`
          : "Colis identifié — réception seulement",
      canApply: !lowConf,
      proposedTracking
    };
  });
}

/**
 * APLIKE — sèlman sa admin valide. Chan otorize SÈLMAN (RÈG N°5):
 * tracking_manual (si vid), received_at, received_method.
 * Chak chanjman anrejistre ak ansyen + nouvo valè (RÈG N°6).
 * Retounen batch_id pou "Annuler la dernière importation" (RÈG N°8).
 */
export async function applyPhotoValidations(items: PhotoMatch[]): Promise<{
  batchId: string; received: number; trackingAdded: number;
}> {
  const now = new Date().toISOString();
  const batchId = "SCAN-" + Date.now().toString(36).toUpperCase();
  let received = 0, trackingAdded = 0;
  const undo: any[] = [];

  for (const m of items) {
    if (!m.matched || !m.matchedPkgId) continue;   // RÈG N°2: pa kreye anyen

    // Eta anvan (pou backup / anilasyon)
    const { data: before } = await supabase.from("packages")
      .select("id, tracking_manual, received_at, received_method").eq("id", m.matchedPkgId).maybeSingle();
    if (!before) continue;

    const patch: Record<string, unknown> = { received_at: now, received_method: "Analyse Photo" };
    if (m.proposedTracking && !before.tracking_manual) {
      patch.tracking_manual = m.proposedTracking;
      trackingAdded++;
    }

    await supabase.from("packages").update(patch).eq("id", m.matchedPkgId);
    received++;
    undo.push({
      id: before.id,
      tracking_manual: before.tracking_manual ?? "",
      received_at: before.received_at,
      received_method: before.received_method ?? ""
    });

    await logAction("Analyse Photo",
      `${m.filename} | Guía:${m.guia || "—"} | confiance:${Math.round(m.confidence)}% | ` +
      (patch.tracking_manual
        ? `Tracking Number: "${before.tracking_manual ?? ""}" → "${patch.tracking_manual}"`
        : "réception seulement") +
      ` | réception: "${before.received_at ?? "—"}" → "${now}"`,
      m.matchedTracking ?? "", m.matchedCode ?? "");
  }

  // Pwen restorasyon (RÈG N°9) — pou anile enpòtasyon an
  await supabase.from("import_batches").insert({
    batch_id: batchId, kind: "Analyse Photo",
    items_count: received, undo_data: undo
  });
  await logAction("Analyse Photo",
    `Batch ${batchId}: ${received} colis reçus, ${trackingAdded} Tracking Number ajoutés`, batchId, "");

  return { batchId, received, trackingAdded };
}

/** ANILE dènye enpòtasyon (RÈG N°8) — remete eta anvan an. */
export async function undoLastImport(): Promise<{ ok: boolean; batchId?: string; restored?: number; reason?: string }> {
  const { data } = await supabase.from("import_batches")
    .select("*").eq("undone", false).order("created_at", { ascending: false }).limit(1);
  const batch = (data ?? [])[0] as any;
  if (!batch) return { ok: false, reason: "Aucune importation à annuler." };

  const undo = Array.isArray(batch.undo_data) ? batch.undo_data : [];
  let restored = 0;
  for (const u of undo) {
    await supabase.from("packages").update({
      tracking_manual: u.tracking_manual ?? "",
      received_at: u.received_at ?? null,
      received_method: u.received_method ?? ""
    }).eq("id", u.id);
    restored++;
  }
  await supabase.from("import_batches").update({ undone: true }).eq("id", batch.id);
  await logAction("Annulation Import",
    `Batch ${batch.batch_id} annulé — ${restored} colis restaurés`, batch.batch_id, "");
  return { ok: true, batchId: batch.batch_id, restored };
}

/** JOURNAL OCR — chak foto analize (menm sa ki pa aplike). */
export async function logOcrScans(scans: PhotoMatch[]): Promise<void> {
  for (const s of scans) {
    await logAction("Journal OCR",
      `${s.filename} | barcode:${s.guiaSource === "barcode" ? "oui" : "non"} | Guía:${s.guia || "—"} | ` +
      `Tracking:${s.tracking_number || "—"} | Code:${s.customer_code || "—"} | ` +
      `confiance:${Math.round(s.confidence)}% | ${s.verdict}`,
      s.guia || s.tracking_number, s.matchedCode ?? s.customer_code);
  }
}

// ================= KOREKSYON OTOMATIK KOLÒN TRACKING (V8.5) =================
export interface TrackingFixResult { swapped: number; movedToManual: number; movedToId: number; }

/**
 * Analize tout bazdone a epi korije koli kote Tracking ID (WR...) ak
 * Tracking Number (GFUS/TBA/1Z...) nan move kolòn.
 *  - tracking_number DWE toujou se Guía a (WR...)
 *  - tracking_manual DWE toujou se tracking transpòtè a
 */
export async function fixTrackingColumns(): Promise<TrackingFixResult> {
  const { data } = await supabase.from("packages")
    .select("id, tracking_number, tracking_manual, mcpack_data");
  const pkgs = (data ?? []) as any[];
  let swapped = 0, movedToManual = 0, movedToId = 0;

  for (const p of pkgs) {
    const tn = cleanTracking(p.tracking_number);
    const tm = cleanTracking(p.tracking_manual);
    const guiaData = cleanTracking(p.mcpack_data?.Guia ?? p.mcpack_data?.["Guía"] ?? "");

    // Ka 1: de kolòn yo enveti (ID nan manual, Number nan ID)
    if (tn && tm && !isGuia(tn) && isGuia(tm)) {
      await supabase.from("packages").update({ tracking_number: tm, tracking_manual: tn }).eq("id", p.id);
      swapped++; continue;
    }
    // Ka 2: tracking_number pa yon Guía, men mcpack_data gen Guía a
    if (tn && !isGuia(tn) && isGuia(guiaData) && guiaData !== tn) {
      await supabase.from("packages").update({
        tracking_number: guiaData,
        tracking_manual: tm || tn
      }).eq("id", p.id);
      movedToId++; continue;
    }
    // Ka 3: tracking_manual gen yon Guía (doub) — retire l nan manual
    if (tm && isGuia(tm) && isGuia(tn)) {
      await supabase.from("packages").update({ tracking_manual: "" }).eq("id", p.id);
      movedToManual++; continue;
    }
  }
  await logAction("Correction Tracking",
    `${swapped} inversés, ${movedToId} corrigés (Guía), ${movedToManual} nettoyés`, "", "");
  return { swapped, movedToManual, movedToId };
}
