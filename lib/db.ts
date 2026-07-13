import { supabase } from "./supabase";
import {
  AccountType, Client, DashboardStats, ImportLog, Invoice, InvoiceItem, Pkg, Ville
} from "./types";
import { McpackRow } from "./xlsx";
import { computePrice, DEFAULT_SMALL_PARCEL_PRICE, round2 } from "./pricing";

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
}
export async function getClientTarifMap(): Promise<Map<string, ClientTarifInfo>> {
  const cs = await getClients();
  return new Map(cs.map((c) => [c.customer_code, {
    ville: c.ville ?? null,
    account_type: c.account_type ?? "Personnel",
    phone: [c.phone, c.whatsapp].filter(Boolean).join(" "),
    fullname: [c.fullname, c.surname].filter(Boolean).join(" ")
  }]));
}
export async function upsertClient(c: Client): Promise<void> {
  const row = {
    customer_code: c.customer_code.trim(),
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
export async function getPackages(status?: string): Promise<Pkg[]> {
  let q = supabase.from("packages").select("*").order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((p) =>
    asNum(p, ["weight", "price_usd", "tax_usd", "total_usd", "price_htg", "tax_htg", "total_htg"])) as Pkg[];
}
export async function getClientPackages(code: string): Promise<Pkg[]> {
  const { data, error } = await supabase
    .from("packages").select("*").eq("customer_code", code)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((p) =>
    asNum(p, ["weight", "price_usd", "tax_usd", "total_usd", "price_htg", "tax_htg", "total_htg"])) as Pkg[];
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
/** Admin: koli rive depo STANDA — sèl statut ki pa soti nan MCPACK */
export async function markDisponible(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase.from("packages")
    .update({ status: "Disponible" }).in("id", ids);
  if (error) throw error;
}

export async function deletePackage(id: string): Promise<void> {
  const { error } = await supabase.from("packages").delete().eq("id", id);
  if (error) throw error;
}

// ================= SYNC MCPACK =================
export interface SyncPreview {
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
  for (const r of rows) {
    if (existSet.has(r.tracking_number) || seen.has(r.tracking_number)) { existing++; continue; }
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

  return { totalRows: rows.length, newRows, existing, newClientCodes, errors: 0 };
}

/** Valide importation: kreye kliyan ki manke yo + antre nouvo koli yo + log */
export async function commitSync(
  preview: SyncPreview, filename: string, autoPricing: boolean
): Promise<ImportLog> {
  // Enfo tarif chak kliyan (vil + tip kont). Nouvo kliyan poko gen vil.
  const tarifMap = autoPricing ? await getClientTarifMap() : new Map<string, ClientTarifInfo>();
  const rate = autoPricing ? await getUsdRate() : 0;
  const smallPrice = autoPricing ? await getSmallParcelPrice() : DEFAULT_SMALL_PARCEL_PRICE;
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
          ? computePrice(r.weight, info.account_type, info.ville, smallPrice)
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
          // Statut MCPACK vèbatim (TRANSFERIDO...). "Disponible" se admin ki mete l
          // lè koli a rive depo STANDA a. Si Excel la pa gen Estatus -> Disponible.
          status: r.status_raw?.trim() || "Disponible",
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
export async function createInvoice(client: Client, pkgs: Pkg[], rate: number): Promise<Invoice> {
  const subtotal = round2(pkgs.reduce((s, p) => s + p.price_usd, 0));
  const tax = round2(pkgs.reduce((s, p) => s + p.tax_usd, 0));
  const grand = round2(subtotal + tax);
  const invoice_number = "SC-" + Date.now().toString().slice(-6);

  const { data: inv, error } = await supabase.from("invoices").insert({
    invoice_number,
    customer_code: client.customer_code,
    customer_name: client.fullname,
    whatsapp: client.whatsapp,
    pickup_location: client.pickup_location,
    ville: client.ville?.name ?? "",
    subtotal, tax, grand_total: grand,
    exchange_rate_used: rate,
    total_usd: grand,
    total_htg: round2(grand * rate),
    package_count: pkgs.length,
    total_weight: round2(pkgs.reduce((s, p) => s + p.weight, 0))
  }).select().single();
  if (error) throw error;

  const items: Omit<InvoiceItem, "id">[] = pkgs.map((p) => ({
    invoice_id: inv.id,
    tracking_number: p.tracking_number,
    weight: p.weight,
    content: p.content,
    price: p.price_usd,
    tax: p.tax_usd,
    total: round2(p.price_usd + p.tax_usd)
  }));
  const { error: e2 } = await supabase.from("invoice_items").insert(items);
  if (e2) throw e2;

  // Fikse valè HTG yo sou chak koli (to a nan moman fakti a — li pa chanje apre)
  await Promise.all(pkgs.map((p) =>
    supabase.from("packages").update({
      status: "Facturé",
      invoice_id: inv.id,
      price_htg: round2(p.price_usd * rate),
      tax_htg: round2(p.tax_usd * rate)
    }).eq("id", p.id)
  ));

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

// ================= SETTINGS =================
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
  auth_user_id: string; fullname: string; surname: string; email: string;
  phone: string; whatsapp: string; country: string; city: string; city2: string;
  address: string; id_type: string; id_number: string;
  ville_id?: string | null;   // lyen otomatik ak tarification (vil kliyan an chwazi a)
}): Promise<void> {
  const { error } = await supabase.from("clients").insert({
    ...p,
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
  return { pkgs: (p.data ?? []) as Pkg[], invs: (i.data ?? []) as Invoice[] };
}
