import { supabase } from "./supabase";
import { cleanTracking, isGuia, normalizeMcCode } from "./utils";
import { validateUpload, storagePath } from "./upload";
import {
  AccountType, Client, Conduce, DashboardStats, ImportLog, Invoice, InvoiceItem, Pkg, Ville
, Retrait, RetraitStatus, CONDUCE_ARRIVAL_STATUS, shouldPromoteOnConduce } from "./types";
import { McpackRow } from "./xlsx";
import { computePrice, computeLinePrice, DEFAULT_SMALL_PARCEL, DEFAULT_SMALL_PARCEL_PRICE, isSmallParcel, round2, SmallParcelConfig, SpecialArticle, parseSpecialArticles, DEFAULT_SPECIAL_ARTICLES } from "./pricing";
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
/** Plizyè kliyan yon sèl kou pa kòd — pou File d'attente WhatsApp / bulk actions. */
export async function getClientsByCodes(codes: string[]): Promise<Client[]> {
  if (!codes.length) return [];
  const { data, error } = await supabase.from("clients").select(CLIENT_SELECT)
    .in("customer_code", codes);
  if (error) throw error;
  return (data ?? []) as Client[];
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
export async function getPackages(status?: string, includeArchived = false, conduceId?: string): Promise<Pkg[]> {
  let q = supabase.from("packages").select("*").order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  if (conduceId) q = q.eq("conduce_id", conduceId);   // Modil Conduces — menm motè, filtè sèlman
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []).map((p) =>
    asNum(p, ["weight", "fob", "price_usd", "tax_usd", "total_usd", "price_htg", "tax_htg", "total_htg"])) as Pkg[];
  // Filtre nan JS -> pa kraze si migration 'archived' poko kouri (pwen #4)
  return includeArchived ? rows : rows.filter((p) => !p.archived);
}

// ============ PERFORMANCE — rechèch/pagination SÈVÈ (pou 1000-5000+ koli) ============
// getPackages() rete SAN TOUCHE (Historique ak lòt kote kontinye itilize l jan yo te ye).
// Fonksyon sa yo sèvi SÈLMAN pou lis Packages global la (paj ki gwosi ak volim lan).
export interface PackagesQueryFilters {
  search?: string;
  matchingClientCodes?: string[];        // customer_code ki matche non/telefòn/vil kliyan (kalkile kote kliyan)
  status?: string;
  source?: "" | "extension" | "caribe" | "facture";
  dateF?: string;
  includeArchived?: boolean;
  conduceId?: string;
}

function applyPackagesFilters(q: any, f: PackagesQueryFilters) {
  // Menm règ ak vi aktif la: Livré ak Facturé rete nan Historique
  q = q.neq("status", "Livré").neq("status", "Facturé");
  if (!f.includeArchived) q = q.eq("archived", false);
  if (f.conduceId) q = q.eq("conduce_id", f.conduceId);
  if (f.status) q = q.eq("status", f.status);
  if (f.source === "caribe") q = q.eq("src_caribe", true);
  else if (f.source === "facture") q = q.eq("src_facture", true);
  else if (f.source === "extension") q = q.eq("src_extension", true);
  if (f.dateF) q = q.ilike("created_date", `%${f.dateF}%`);
  const s = (f.search ?? "").replace(/[(),]/g, "").trim();
  if (s) {
    const parts = [
      `tracking_number.ilike.%${s}%`, `tracking_manual.ilike.%${s}%`,
      `customer_code.ilike.%${s}%`, `customer_name.ilike.%${s}%`,
    ];
    if (f.matchingClientCodes?.length) parts.push(`customer_code.in.(${f.matchingClientCodes.join(",")})`);
    q = q.or(parts.join(","));
  }
  return q;
}

/** Yon paj koli filtre nan bazdone a (pa nan navigatè a) — rapid kèlkeswa volim done a. */
export async function getPackagesPage(
  filters: PackagesQueryFilters, page: number, perPage: number
): Promise<{ rows: Pkg[]; total: number }> {
  let q = supabase.from("packages").select("*", { count: "exact" });
  q = applyPackagesFilters(q, filters);
  q = q.order("created_at", { ascending: false }).range((page - 1) * perPage, page * perPage - 1);
  const { data, error, count } = await q;
  if (error) throw error;
  const rows = (data ?? []).map((p) =>
    asNum(p, ["weight", "fob", "price_usd", "tax_usd", "total_usd", "price_htg", "tax_htg", "total_htg"])) as Pkg[];
  return { rows, total: count ?? rows.length };
}

/** Chaje TOUT koli ki matche filtè yo (sou demand — pou seleksyon global/bulk sou anpil paj). */
export async function getAllPackagesMatching(filters: PackagesQueryFilters, cap = 3000): Promise<Pkg[]> {
  let q = supabase.from("packages").select("*");
  q = applyPackagesFilters(q, filters);
  q = q.order("created_at", { ascending: false }).limit(cap);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((p) =>
    asNum(p, ["weight", "fob", "price_usd", "tax_usd", "total_usd", "price_htg", "tax_htg", "total_htg"])) as Pkg[];
}

/**
 * Relije koli seleksyone yo FRE depi bazdone a (validasyon seleksyon global).
 * Itilize pa aksyon an gwoup: nou pa fè konfyans ak sa ki nan ekran an —
 * nou verifye koli a egziste toujou epi nou pran vrè eta li.
 */
export async function getPackagesByIds(ids: string[]): Promise<Pkg[]> {
  if (!ids.length) return [];
  const out: Pkg[] = [];
  // Pa chaje twòp ID nan yon sèl rekèt (limit URL)
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data, error } = await supabase.from("packages").select("*").in("id", chunk);
    if (error) throw error;
    out.push(...(data ?? []).map((p) =>
      asNum(p, ["weight", "fob", "price_usd", "tax_usd", "total_usd", "price_htg", "tax_htg", "total_htg"])) as Pkg[]);
  }
  return out;
}

/**
 * Relije koli yo FRE depi Tracking ID (Guía) yo — sèvi pou demann retrait yo:
 * `retrait_items` sonje tracking la, pa yon lyen sou koli a. Nou pa fè konfyans
 * ak snapshot la: nou pran vrè eta koli a nan bazdone a kounye a.
 */
export async function getPackagesByTrackings(trackings: string[]): Promise<Pkg[]> {
  const clean = Array.from(new Set(trackings.map((t) => String(t ?? "").trim()).filter(Boolean)));
  if (!clean.length) return [];
  const out: Pkg[] = [];
  for (let i = 0; i < clean.length; i += 200) {
    const chunk = clean.slice(i, i + 200);
    const { data, error } = await supabase.from("packages").select("*").in("tracking_number", chunk);
    if (error) throw error;
    out.push(...(data ?? []).map((p) =>
      asNum(p, ["weight", "fob", "price_usd", "tax_usd", "total_usd", "price_htg", "tax_htg", "total_htg"])) as Pkg[]);
  }
  return out;
}

// ============ MODIL CONDUCES (Faz 1 — fondasyon) ============
// Single Source of Truth: AUCUN duplication Package. Yon Conduce se yon gwoup +
// yon filtè sou packages.conduce_id. Tablo/aksyon yo se MENM Packages engine a.

export async function getConduces(): Promise<Conduce[]> {
  const { data, error } = await supabase.from("conduces").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Conduce[];
}

/**
 * Chèche YON conduce dirèkteman pa ID li. Pi solid pase chaje tout lis la epi
 * filtre: si gen yon pwoblèm (rezo, dwa aksè), nou remonte VRE erè a olye di
 * "introuvable" — konsa nou konnen sa k pase vre.
 */
export async function getConduceById(id: string): Promise<Conduce | null> {
  const clean = String(id ?? "").trim();
  if (!clean) return null;
  const { data, error } = await supabase.from("conduces").select("*").eq("id", clean).maybeSingle();
  if (error) throw error;
  return (data as Conduce) ?? null;
}

export async function getConduceByNumber(num: string): Promise<Conduce | null> {
  const { data } = await supabase.from("conduces").select("*").eq("conduce_number", num.trim()).maybeSingle();
  return (data as Conduce) ?? null;
}

/** Kreye yon Conduce si li pa egziste, oswa retounen sa ki egziste a (jamè doublon). */
export async function ensureConduce(num: string, office = "", who = ""): Promise<Conduce> {
  const existing = await getConduceByNumber(num);
  if (existing) return existing;
  const { data, error } = await supabase.from("conduces").insert({
    conduce_number: num.trim(), office, imported_by: who, imported_at: new Date().toISOString()
  }).select("*").single();
  if (error) throw error;
  await logAction("Création Conduce", `Conduce ${num} créée`, "", "");
  return data as Conduce;
}

/**
 * Kreye plizyè Conduce "an atant" yon sèl kou (etap 1 workflow la — pa mande kontni).
 * Yo rete vid jiskaske Extension Chrome ranpli yo via /api/ingest-conduce (etap 2).
 * JANM doublon — reyitilize ensureConduce pou chak nimewo.
 */
export async function createPendingConduces(
  numbers: string[], who = ""
): Promise<{ number: string; id: string; alreadyExisted: boolean }[]> {
  const out: { number: string; id: string; alreadyExisted: boolean }[] = [];
  for (const raw of numbers) {
    const num = raw.trim();
    if (!num) continue;
    const before = await getConduceByNumber(num);
    const c = await ensureConduce(num, "", who);
    out.push({ number: c.conduce_number, id: c.id, alreadyExisted: !!before });
  }
  return out;
}

/**
 * KONT SANTRAL BIZNIS — kod kliyan (ex: MC-36191) ki sèvi pou tout kliyan
 * biznis ki POKO gen pwòp kont yo. Kont sa a:
 *   • parèt nan NENPÒT Bon de Remise, san blokaj (li pa mare ak yon sèl vil),
 *   • pran tarif VIL DESTINASYON an lè w ap fakti (Gonaïves, Port-de-Paix…).
 * Anrejistre nan `app_settings` (kle: central_account_code). Zewo SQL.
 */
export async function getCentralAccountCode(): Promise<string> {
  const s = await getSettings();
  return String(s.central_account_code ?? "").trim();
}
export async function setCentralAccountCode(code: string): Promise<void> {
  await setSetting("central_account_code", code.trim().toUpperCase());
}

/** Tout koli ki nan yon oswa plizyè Conduce (pou Bon de Remise). */
export async function getPackagesByConduceIds(conduceIds: string[]): Promise<Pkg[]> {
  const ids = Array.from(new Set(conduceIds.filter(Boolean)));
  if (!ids.length) return [];
  const out: Pkg[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const { data, error } = await supabase.from("packages").select("*").in("conduce_id", chunk);
    if (error) throw error;
    out.push(...(data ?? []).filter((p: Record<string, unknown>) => !p.archived).map((p) =>
      asNum(p, ["weight", "fob", "price_usd", "tax_usd", "total_usd", "price_htg", "tax_htg", "total_htg"])) as Pkg[]);
  }
  return out;
}

/**
 * EFASE YON CONDUCE (lè li te mal kreye).
 * ═══════════════════════════════════════
 * GAD SEKIRITE — nou pa janm efase done fakti:
 *   • Si conduce a gen KOLI DEJA FAKTI -> nou REFIZE. Efase l ta kase lyen
 *     ant fakti a ak lo transpò a.
 *   • Si li gen koli ki poko fakti -> koli yo PA efase. Nou jis DETACHE yo
 *     (conduce_id = null). Yo rete nan sistèm nan, prè pou yon lòt conduce.
 * Retounen konbyen koli ki te detache.
 */
export async function deleteConduce(conduceId: string): Promise<{ detached: number }> {
  const id = String(conduceId ?? "").trim();
  if (!id) throw new Error("Conduce invalide.");

  const { data: pkgs, error: e1 } = await supabase.from("packages")
    .select("id, invoice_id, status").eq("conduce_id", id);
  if (e1) throw e1;

  const fakti = (pkgs ?? []).filter((p: { invoice_id?: string | null; status?: string }) =>
    !!p.invoice_id || p.status === "Facturé");
  if (fakti.length) {
    throw new Error(
      `Suppression impossible : ${fakti.length} colis de cette conduce sont déjà facturés. ` +
      `Supprimer la conduce casserait le lien avec les factures.`);
  }

  const detached = (pkgs ?? []).length;
  if (detached) {
    const { error } = await supabase.from("packages").update({ conduce_id: null }).eq("conduce_id", id);
    if (error) throw error;
  }
  const { error } = await supabase.from("conduces").delete().eq("id", id);
  if (error) throw error;
  return { detached };
}

/** Ekri statut yon Conduce (En cours | Complète | Facturée). */
export async function setConduceStatus(conduceId: string, status: string): Promise<void> {
  await supabase.from("conduces").update({ status }).eq("id", conduceId);
}

/**
 * STATUT DERIVE YON CONDUCE — kalkile depi koli yo, jamè yon chan dwaplike.
 *   0 koli                       -> "En attente"
 *   tout koli fakti               -> "Facturée"   (li ale nan Historique)
 *   sinon                         -> "En cours"
 */
export function deriveConduceStatus(count: number, facturedCount: number): string {
  if (count === 0) return "En attente";
  return facturedCount >= count ? "Facturée" : "En cours";
}

/** Estatistik yon Conduce, kalkile depi packages ki gen menm conduce_id — jamè chan dwaplike. */
export async function getConduceStats(conduceId: string): Promise<{
  count: number; weight: number; facturedCount: number; facturedTotal: number; verifiedCount: number;
  disponibleCount: number; livreCount: number;
}> {
  const { data } = await supabase.from("packages")
    .select("weight, invoice_id, total_usd, verified, archived, status").eq("conduce_id", conduceId);
  const rows = (data ?? []).filter((r: any) => !r.archived);
  return {
    count: rows.length,
    weight: rows.reduce((s: number, r: any) => s + (Number(r.weight) || 0), 0),
    facturedCount: rows.filter((r: any) => r.invoice_id).length,
    facturedTotal: rows.reduce((s: number, r: any) => s + (r.invoice_id ? (Number(r.total_usd) || 0) : 0), 0),
    verifiedCount: rows.filter((r: any) => r.verified).length,
    // Pipeline pa etap (pwen: Progression Synchronisé→Scanné→Validé→Facturé→Disponible→Livré)
    disponibleCount: rows.filter((r: any) => ["Disponible", "Facturé", "Livré"].includes(r.status)).length,
    livreCount: rows.filter((r: any) => r.status === "Livré").length,
  };
}

/** Summary Panel (Faz 4) — estatistik konplè pou paj Conduce a. READ-ONLY. */
export async function getConduceSummary(conduceId: string): Promise<{
  packages: number; factures: number; nonFactures: number; poids: number;
  taxes: number; remises: number; montantFacture: number; totalGeneral: number; clients: number;
}> {
  const { data } = await supabase.from("packages")
    .select("weight, invoice_id, total_usd, tax_usd, customer_code, archived").eq("conduce_id", conduceId);
  const rows = (data ?? []).filter((r: any) => !r.archived);

  const invoiceIds = Array.from(new Set(rows.map((r: any) => r.invoice_id).filter(Boolean)));
  let remises = 0;
  if (invoiceIds.length) {
    const { data: invs } = await supabase.from("invoices").select("discount").in("id", invoiceIds);
    remises = (invs ?? []).reduce((s: number, i: any) => s + (Number(i.discount) || 0), 0);
  }

  return {
    packages: rows.length,
    factures: rows.filter((r: any) => r.invoice_id).length,
    nonFactures: rows.filter((r: any) => !r.invoice_id).length,
    poids: rows.reduce((s: number, r: any) => s + (Number(r.weight) || 0), 0),
    taxes: rows.reduce((s: number, r: any) => s + (Number(r.tax_usd) || 0), 0),
    remises,
    montantFacture: rows.reduce((s: number, r: any) => s + (r.invoice_id ? (Number(r.total_usd) || 0) : 0), 0),
    totalGeneral: rows.reduce((s: number, r: any) => s + (Number(r.total_usd) || 0), 0),
    clients: new Set(rows.map((r: any) => r.customer_code).filter(Boolean)).size,
  };
}

// ============ IMPORT CONDUCE (Faz 2) ============
// RÈG: Package egziste yon sèl fwa. Import Conduce JANM kreye nouvo Package —
// li JWENN sa ki egziste deja (pa Tracking ID/Guía oswa Tracking Number) epi LYE
// yo ak conduce_id la. Menm apwòch ak Import Facture (matching, pa devinèt).

export interface ConduceMatch {
  code: string;                 // kòd (WR... oswa tracking) jwenn nan tèks la
  matched: boolean;
  pkgId?: string;
  guia?: string;
  customerCode?: string;
  customerName?: string;
  status?: string;
  currentConduceId?: string | null;   // si li deja lye ak yon lòt conduce
}

/**
 * Chèche kòd yo (WR... oswa Tracking Number) nan yon tèks kole Conduce MCPACK,
 * epi match yo ak Package ki egziste deja. READ-ONLY — anyen pa chanje.
 */
export async function matchConduceCodes(rawCodes: string[]): Promise<ConduceMatch[]> {
  const codes = Array.from(new Set(rawCodes.map((c) => cleanTracking(c)).filter(Boolean)));
  if (!codes.length) return [];

  const { data } = await supabase.from("packages")
    .select("id, tracking_number, tracking_manual, customer_code, customer_name, status, archived, conduce_id");
  const byGuia = new Map<string, any>(), byManual = new Map<string, any>();
  for (const p of (data ?? [])) {
    if (p.archived) continue;
    const g = cleanTracking(p.tracking_number); if (g) byGuia.set(g, p);
    const m = cleanTracking(p.tracking_manual); if (m) byManual.set(m, p);
  }

  return codes.map((code) => {
    const p = byGuia.get(code) ?? byManual.get(code);
    if (!p) return { code, matched: false };
    return {
      code, matched: true, pkgId: p.id, guia: p.tracking_number,
      customerCode: p.customer_code, customerName: p.customer_name,
      status: p.status, currentConduceId: p.conduce_id ?? null,
    };
  });
}

/**
 * Lye package ki matche yo ak yon Conduce (met conduce_id). JANM kreye Package.
 * Ak audit log. Package ki deja lye ak yon LÒT conduce yo skip (san ekrase).
 */
export async function linkPackagesToConduce(
  conduceId: string, conduceNumber: string, matches: ConduceMatch[], who = ""
): Promise<{ linked: number; alreadyElsewhere: number }> {
  const cibles = matches.filter((m) => m.matched && m.pkgId && m.currentConduceId !== conduceId);
  let linked = 0, alreadyElsewhere = 0, promus = 0;
  for (const m of cibles) {
    if (m.currentConduceId) { alreadyElsewhere++; continue; }   // deja nan yon lòt conduce — pa touche
    // STATUT OTOMATIK: nimewo conduce nan men nou = lo a rive an Ayiti.
    const patch: Record<string, unknown> = { conduce_id: conduceId };
    if (shouldPromoteOnConduce(m.status)) { patch.status = CONDUCE_ARRIVAL_STATUS; promus++; }
    await supabase.from("packages").update(patch).eq("id", m.pkgId!);
    linked++;
  }
  if (linked > 0) {
    await supabase.from("conduces").update({ updated_at: new Date().toISOString() }).eq("id", conduceId);
    await logAction("Import Conduce",
      `Conduce ${conduceNumber} : ${linked} colis liés, ${promus} passés en "${CONDUCE_ARRIVAL_STATUS}"`, "", "");
  }
  return { linked, alreadyElsewhere };
}

/**
 * Import Excel espesifik CONDUCE (soti nan "Exportar XLS" sou paj MCPACK Conduce a).
 * Menm règ ak /api/ingest-conduce (Extension): si koli a egziste deja (pa Guía),
 * li lye ak Conduce a; si li pa egziste, li KREYE l (sous se yon Excel estriktire
 * MCPACK, done fyab — pa yon devinèt). Office Conduce a mete ajou ak "Oficina".
 * JANM doublon Package (Single Source of Truth).
 */
export async function importConduceExcelRows(
  conduceId: string, conduceNumber: string,
  rows: { guia: string; tracking_number: string; customer_code: string; customer_name: string;
           office: string; weight: number; content: string; quantity: number }[],
  who = ""
): Promise<{ created: number; updated: number; linked: number; totalWeight: number }> {
  let created = 0, updated = 0, linked = 0;
  let officeSeen = "";
  const now = new Date().toISOString();

  for (const r of rows) {
    if (!r.guia) continue;
    if (r.office && !officeSeen) officeSeen = r.office;

    const { data: existing } = await supabase.from("packages")
      .select("id, conduce_id, tracking_manual, status, invoice_id").eq("tracking_number", r.guia).maybeSingle();

    if (existing) {
      const patch: Record<string, unknown> = {};
      if (existing.conduce_id !== conduceId) { patch.conduce_id = conduceId; linked++; }
      // STATUT OTOMATIK -> "Arrivé en Haïti" (jamè an aryè)
      if (shouldPromoteOnConduce(existing.status, existing.invoice_id)) {
        patch.status = CONDUCE_ARRIVAL_STATUS;
      }
      if (r.tracking_number && !existing.tracking_manual) patch.tracking_manual = r.tracking_number;
      if (r.weight) patch.weight = r.weight;
      if (r.content) patch.content = r.content;
      if (Object.keys(patch).length) await supabase.from("packages").update(patch).eq("id", existing.id);
      updated++;
    } else {
      await supabase.from("packages").insert({
        tracking_number: r.guia, tracking_manual: r.tracking_number || "",
        customer_code: r.customer_code, customer_name: r.customer_name || r.customer_code,
        weight: r.weight || 0, content: r.content || "", quantity: r.quantity || 1,
        status: CONDUCE_ARRIVAL_STATUS, conduce_id: conduceId,
        received_at: now, received_method: "Import Conduce Excel", src_extension: true
      });
      created++; linked++;
    }
  }

  const patchConduce: Record<string, unknown> = { updated_at: now };
  if (officeSeen) patchConduce.office = officeSeen;
  await supabase.from("conduces").update(patchConduce).eq("id", conduceId);

  const totalWeight = rows.reduce((s, r) => s + (r.weight || 0), 0);
  await logAction("Import Conduce (Excel)",
    `Conduce ${conduceNumber} : ${created} créés, ${updated} mis à jour/liés, ${rows.length} colis, ${totalWeight.toFixed(2)} lb — par ${who}`,
    "", "");
  return { created, updated, linked, totalWeight };
}

export interface FactureMatch {
  tracking: string;
  weight?: number;
  source: "pdf" | "image" | "text";
  matched: boolean;
  pkgId?: string;
  guia?: string;            // Tracking ID (tracking_number) koli matche a
  customerCode?: string;
  customerName?: string;
  status?: string;
  pkgWeight?: number;       // pou imèl
  content?: string;         // pou imèl
  alreadyDisponible?: boolean;
}

/**
 * Match Tracking Number fakti yo ak koli yo (pa tracking_manual).
 * READ-ONLY — pa chanje anyen. Retounen matched + non identifiés (pwen #6a, #9).
 */
export async function matchFactureTrackings(
  items: { value: string; weight?: number; source: "pdf" | "image" | "text" }[]
): Promise<FactureMatch[]> {
  const { data } = await supabase.from("packages")
    .select("id, tracking_number, tracking_manual, customer_code, customer_name, status, archived, weight, content");
  const index = new Map<string, any>();
  for (const p of (data ?? [])) {
    if (p.archived) continue;
    const key = cleanTracking(p.tracking_manual);
    if (key) index.set(key, p);
  }
  return items.map((it) => {
    const key = cleanTracking(it.value);
    const p = key ? index.get(key) : null;
    if (!p) return { tracking: it.value, weight: it.weight, source: it.source, matched: false };
    return {
      tracking: it.value, weight: it.weight, source: it.source, matched: true,
      pkgId: p.id, guia: p.tracking_number, customerCode: p.customer_code,
      customerName: p.customer_name, status: p.status,
      pkgWeight: Number(p.weight) || 0, content: p.content || "",
      alreadyDisponible: p.status === "Disponible" || p.status === "Facturé"
    };
  });
}

/**
 * VALIDE import facture (pwen #6b) — mete koli matche yo "Disponible".
 * SAN imèl (imèl se etap #6c apa). Sèlman koli ki PA deja Disponible/Facturé.
 * Ak audit log + pwen restorasyon (undo).
 */
export async function commitFactureDisponible(
  matches: { pkgId?: string; matched: boolean; alreadyDisponible?: boolean; tracking: string; guia?: string; customerCode?: string }[]
): Promise<{ batchId: string; updated: number; skipped: number }> {
  const now = new Date().toISOString();
  const batchId = "FACT-" + Date.now().toString(36).toUpperCase();
  const cibles = matches.filter((m) => m.matched && m.pkgId && !m.alreadyDisponible);
  let updated = 0; const undo: any[] = [];

  for (const m of cibles) {
    const { data: before } = await supabase.from("packages")
      .select("id, status, received_method, received_at").eq("id", m.pkgId!).maybeSingle();
    if (!before) continue;
    // pa fè yon Livré rekile
    if (before.status === "Livré" || before.status === "Facturé" || before.status === "Disponible") continue;
    await supabase.from("packages").update({
      status: "Disponible",
      received_method: "Import Facture",
      src_facture: true,
      received_at: before.received_at ?? new Date().toISOString()
    }).eq("id", m.pkgId!);
    updated++;
    undo.push({ id: before.id, status: before.status,
      received_method: before.received_method ?? "", received_at: before.received_at ?? null });
    await logAction("Import Facture → Disponible",
      `${m.guia || "—"} | Tracking:${m.tracking} | "${before.status}" → "Disponible"`,
      m.guia || "", m.customerCode || "");
  }

  await supabase.from("import_batches").insert({
    batch_id: batchId, kind: "Import Facture", items_count: updated, undo_data: undo
  });
  await logAction("Import Facture",
    `Batch ${batchId}: ${updated} colis → Disponible`, batchId, "");

  return { batchId, updated, skipped: matches.filter((m) => m.matched).length - updated };
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

/** Foto de Preuve (Faz 3) — sove foto koli a, lye pèmanan ak koli a + audit. */
export async function savePackageProofPhoto(
  pkgId: string, file: File, who = ""
): Promise<{ ok: boolean; url: string }> {
  const url = await uploadScanPhoto(file);
  if (!url) return { ok: false, url: "" };
  const now = new Date().toISOString();
  const { data: before } = await supabase.from("packages")
    .select("tracking_number, customer_code").eq("id", pkgId).maybeSingle();
  const { error } = await supabase.from("packages")
    .update({ proof_photo_url: url, proof_photo_at: now, proof_photo_by: who }).eq("id", pkgId);
  if (error) return { ok: false, url: "" };
  await logAction("Photo Preuve",
    `Photo de réception enregistrée${before?.tracking_number ? " — " + before.tracking_number : ""} | photo:${url}`,
    before?.tracking_number ?? "", before?.customer_code ?? "");
  return { ok: true, url };
}

/** Anrejistre yon sesyon Réception (Mode Entrepôt) nan Journal — pwen: rapò/audit. */
export async function logReceptionSession(r: {
  scanned: number; found: number; validated: number; already: number; notfound: number;
  seconds: number; who: string;
}): Promise<void> {
  const avg = r.scanned ? (r.seconds / r.scanned).toFixed(2) : "0";
  await logAction("Réception Entrepôt",
    `${r.validated} validés / ${r.scanned} scannés | trouvés:${r.found} déjà:${r.already} introuvables:${r.notfound} | ` +
    `durée:${Math.round(r.seconds)}s | moy:${avg}s/colis`, "", "");
}

// ============ SCANNER DE RÉCEPTION MCPACK (Faz 1) ============

export type ScanOutcome = "found" | "already" | "not_found";
export interface ScanResult {
  outcome: ScanOutcome;
  code: string;           // sa scanner a li
  pkg?: Pkg;
}

/**
 * Chèche yon koli depi yon kòd scanne (Barcode/QR/WR/Tracking Number).
 * READ-ONLY — pa modifye anyen. Chèche pa Guía (tracking_number) OSWA tracking_manual.
 */
export async function findPackageByScan(rawCode: string): Promise<ScanResult> {
  const code = cleanTracking(rawCode);
  if (!code) return { outcome: "not_found", code: rawCode };

  // 1) Chèche pa Guía (Tracking ID WR) — kle prensipal
  let { data } = await supabase.from("packages").select("*")
    .ilike("tracking_number", code).limit(1);
  // 2) Si pa jwenn, chèche pa Tracking Number transpòtè
  if (!data || !data.length) {
    const r = await supabase.from("packages").select("*").ilike("tracking_manual", code).limit(1);
    data = r.data;
  }
  if (!data || !data.length) return { outcome: "not_found", code: rawCode };

  const pkg = asNum(data[0], ["weight", "fob", "price_usd", "tax_usd", "total_usd", "price_htg", "tax_htg", "total_htg"]) as Pkg;
  if (pkg.verified) return { outcome: "already", code: rawCode, pkg };
  return { outcome: "found", code: rawCode, pkg };
}

/**
 * VERIFYE yon koli nan resepsyon (apre CONFIRMER).
 * SEKIRITE: modifye SÈLMAN statut + verified + badge. JANM pri/pwa/tracking/kliyan.
 * Statut -> "En route vers agence" (si pa deja pi lwen). Ak audit log.
 */
export async function verifyPackageReception(
  pkgId: string, scannerLabel = "Caméra", who = ""
): Promise<{ ok: boolean; status: string }> {
  const { data: before } = await supabase.from("packages")
    .select("id, status, tracking_number, customer_code, verified, received_at").eq("id", pkgId).maybeSingle();
  if (!before) return { ok: false, status: "" };
  if (before.verified) return { ok: false, status: before.status };

  const dejaPlusLoin = ["Disponible", "Livré", "Facturé"].includes(before.status);
  const newStatus = dejaPlusLoin ? before.status : "En route vers agence";
  const now = new Date().toISOString();

  const patch: Record<string, unknown> = {
    verified: true, verified_at: now, verified_by: who, verified_scanner: scannerLabel,
    src_caribe: true, received_method: "Scanner Réception",
    received_at: before.received_at ?? now
  };
  if (!dejaPlusLoin) patch.status = "En route vers agence";

  const { error } = await supabase.from("packages").update(patch).eq("id", pkgId);
  if (error) return { ok: false, status: before.status };

  await logAction("Vérification Scanner",
    `${before.tracking_number} vérifié (${scannerLabel}) | "${before.status}" → "${newStatus}"`,
    before.tracking_number, before.customer_code);
  return { ok: true, status: newStatus };
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

  // ══ GAD #1: ANTI DOUB-FAKTI (verifye kont BAZDONE a, pa ekran an) ══
  const pkgIds = comp.lines.map((l) => l.pkg.id);
  if (!pkgIds.length) throw new Error("Aucun colis à facturer.");
  const { data: fresh, error: eCheck } = await supabase.from("packages")
    .select("id, tracking_number, customer_code, status, invoice_id").in("id", pkgIds);
  if (eCheck) throw eCheck;
  if (!fresh || fresh.length !== pkgIds.length) {
    throw new Error("Certains colis n'existent plus. Rafraîchissez la page.");
  }
  const deja = fresh.filter((p: any) => p.invoice_id || p.status === "Facturé");
  if (deja.length) {
    const { data: dinv } = await supabase.from("invoices")
      .select("invoice_number, created_at, customer_name")
      .in("id", deja.map((p: any) => p.invoice_id).filter(Boolean));
    const ref = (dinv ?? [])[0];
    throw new Error(
      `Ce colis est déjà facturé (${deja.map((p: any) => p.tracking_number).slice(0, 3).join(", ")})` +
      (ref ? ` — Facture ${ref.invoice_number}, ${new Date(ref.created_at).toLocaleDateString("fr-FR")}, ${ref.customer_name}.` : ".")
    );
  }
  // ══ GAD #2: tout koli dwe apateni kliyan an ══
  const mauvais = fresh.filter((p: any) => p.customer_code !== client.customer_code);
  if (mauvais.length) {
    throw new Error(`Colis d'un autre client détecté (${mauvais[0].tracking_number}). Facture bloquée.`);
  }

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
  if (e2) {
    // ROLLBACK konpansatwa: pa kite yon fakti òfelen nan bazdone a
    await supabase.from("invoices").delete().eq("id", inv.id);
    throw new Error("Impossible de finaliser la facture. Aucun colis n'a été archivé.");
  }

  // ARCHIVAGE OTOMATIK: statut + lyen fakti + dat tras (koli PA JANM efase)
  const invoicedAt = new Date().toISOString();
  const results = await Promise.all(comp.lines.map((l) =>
    supabase.from("packages").update({
      status: "Facturé", invoice_id: inv.id,
      invoiced_at: invoicedAt,
      price_usd: l.amount, tax_usd: 0,
      price_htg: round2(l.amount * rate), tax_htg: 0
    }).eq("id", l.pkg.id)
  ));
  const failed = results.filter((r: any) => r?.error);
  if (failed.length) {
    // ROLLBACK: detache koli ki te pase, efase liy yo + fakti a
    await supabase.from("packages").update({
      status: "Disponible", invoice_id: null, invoiced_at: null
    }).eq("invoice_id", inv.id);
    await supabase.from("invoice_items").delete().eq("invoice_id", inv.id);
    await supabase.from("invoices").delete().eq("id", inv.id);
    throw new Error("Impossible de finaliser la facture. Aucun colis n'a été archivé.");
  }

  // JOURNAL FINANCIER (§9) + tras ARCHIVAGE
  await logAction("Facturation",
    `${invoice_number} | Ville:${comp.ville} | Zone:${comp.zone} | Prix/LB:${comp.perLb} | ` +
    `Poids:${comp.totalWeight} | Sous-total:${comp.subtotal} | Taxe:${comp.taxeFixe} | ` +
    `DGA:${comp.fraisDga} | Discount:${comp.discount} | Mode:${mode} | TOTAL:${comp.totalUsd} USD | ` +
    `${comp.lines.length} colis "Disponible" → "Facturé" (archivés) | Réf:${inv.id}`,
    invoice_number, client.customer_code);

  return asNum(inv, ["subtotal", "tax", "grand_total", "exchange_rate_used", "total_usd", "total_htg", "total_weight"]) as Invoice;
}

/**
 * ANNULER une facture (koreksyon erè) — ADMIN sèlman.
 * Defèt TOUT sa fakti a te fè:
 *   • koli yo retounen "Disponible" (yo ka refakture)
 *   • invoice_id retire + pri/taks remete a zewo
 *   • liy fakti yo (invoice_items) efase
 *   • fakti a efase
 * Ak audit log konplè (montan, kliyan, konbyen koli).
 * Koli yo PA JANM efase — yo jis vin disponib ankò.
 */
export async function cancelInvoice(invoiceId: string): Promise<{ ok: boolean; restored: number; reason?: string }> {
  const { data: inv } = await supabase.from("invoices")
    .select("id, invoice_number, customer_code, customer_name, total_usd, pdf_url").eq("id", invoiceId).maybeSingle();
  if (!inv) return { ok: false, restored: 0, reason: "Facture introuvable." };

  // 1) Koli yo -> Disponible, san fakti, pri remete a zewo.
  //    EKSEPSYON: koli ki deja "Livré" kenbe statut yo (yo pa dwe rekile) —
  //    yo jis pèdi lyen fakti a pou yo ka refakture.
  const { data: pkgs } = await supabase.from("packages").select("id, status").eq("invoice_id", invoiceId);
  const list = pkgs ?? [];
  const restored = list.length;
  const zero = { invoice_id: null, price_usd: 0, tax_usd: 0, total_usd: 0, price_htg: 0, tax_htg: 0, total_htg: 0 };

  const livres = list.filter((p: any) => p.status === "Livré").map((p: any) => p.id);
  const autres = list.filter((p: any) => p.status !== "Livré").map((p: any) => p.id);

  if (autres.length) {
    const { error } = await supabase.from("packages")
      .update({ ...zero, status: "Disponible" }).in("id", autres);
    if (error) return { ok: false, restored: 0, reason: error.message };
  }
  if (livres.length) {
    const { error } = await supabase.from("packages").update(zero).in("id", livres);
    if (error) return { ok: false, restored: 0, reason: error.message };
  }

  // 2) Liy fakti + fakti a
  await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
  const { error: e2 } = await supabase.from("invoices").delete().eq("id", invoiceId);
  if (e2) return { ok: false, restored, reason: e2.message };

  // 3) PDF ki nan Storage (pou pa kite lyen mouri)
  if (inv.pdf_url) {
    try {
      const path = String(inv.pdf_url).split("/invoices/")[1];
      if (path) await supabase.storage.from("invoices").remove([decodeURIComponent(path)]);
    } catch { /* PDF opsyonèl — pa bloke anilasyon an */ }
  }

  await logAction("Annulation Facture",
    `${inv.invoice_number} annulée | Client:${inv.customer_code} | Montant:${inv.total_usd} USD | ` +
    `${autres.length} colis remis en "Disponible"` +
    (livres.length ? ` | ${livres.length} colis déjà livrés (statut conservé)` : ""),
    inv.invoice_number, inv.customer_code);

  return { ok: true, restored };
}

/**
 * Detache koli yo de fakti yo epi remete yo "Disponible" (koreksyon erè, ADMIN).
 * Diferan de cancelInvoice: isit ou korije KÈK koli, pa tout fakti a.
 * • Retire invoice_id + remete pri/taks a zewo (kalkil refèt pwòp)
 * • Mete ajou fakti a (total, kantite) — oswa efase l si li vin vid
 * • Audit log konplè
 */
export async function detachPackagesFromInvoice(
  pkgIds: string[]
): Promise<{ ok: boolean; detached: number; invoicesDeleted: number; reason?: string }> {
  if (!pkgIds.length) return { ok: true, detached: 0, invoicesDeleted: 0 };

  const { data: pkgs } = await supabase.from("packages")
    .select("id, tracking_number, customer_code, invoice_id, total_usd").in("id", pkgIds);
  const list = (pkgs ?? []).filter((p: any) => p.invoice_id);
  if (!list.length) return { ok: true, detached: 0, invoicesDeleted: 0 };

  const invoiceIds = Array.from(new Set(list.map((p: any) => p.invoice_id)));

  // 1) Detache koli yo
  const { error } = await supabase.from("packages").update({
    status: "Disponible", invoice_id: null,
    price_usd: 0, tax_usd: 0, total_usd: 0, price_htg: 0, tax_htg: 0, total_htg: 0
  }).in("id", list.map((p: any) => p.id));
  if (error) return { ok: false, detached: 0, invoicesDeleted: 0, reason: error.message };

  // 2) Retire liy yo nan fakti a
  const trackings = list.map((p: any) => p.tracking_number);
  for (const invId of invoiceIds) {
    await supabase.from("invoice_items").delete().eq("invoice_id", invId).in("tracking_number", trackings);
  }

  // 3) Fakti ki vin vid -> efase; sinon rekalkile total li
  let invoicesDeleted = 0;
  for (const invId of invoiceIds) {
    const { data: items } = await supabase.from("invoice_items").select("total, weight").eq("invoice_id", invId);
    const rest = items ?? [];
    if (!rest.length) {
      await supabase.from("invoices").delete().eq("id", invId);
      invoicesDeleted++;
    } else {
      const subtotal = rest.reduce((s: number, r: any) => s + (Number(r.total) || 0), 0);
      const weight = rest.reduce((s: number, r: any) => s + (Number(r.weight) || 0), 0);
      const { data: inv } = await supabase.from("invoices")
        .select("tax, frais_dga, discount, exchange_rate_used").eq("id", invId).maybeSingle();
      const total = round2(subtotal + Number(inv?.tax ?? 0) + Number(inv?.frais_dga ?? 0) - Number(inv?.discount ?? 0));
      await supabase.from("invoices").update({
        subtotal: round2(subtotal), grand_total: total, total_usd: total,
        total_htg: round2(total * Number(inv?.exchange_rate_used ?? 0)),
        package_count: rest.length, total_weight: round2(weight)
      }).eq("id", invId);
    }
  }

  await logAction("Retrait Facture",
    `${list.length} colis retiré(s) de facture et remis en "Disponible"` +
    (invoicesDeleted ? ` | ${invoicesDeleted} facture(s) vide(s) supprimée(s)` : ""),
    trackings.slice(0, 3).join(", "), list[0]?.customer_code ?? "");

  return { ok: true, detached: list.length, invoicesDeleted };
}

/**
 * EFASE NÈT yon koli nan TOUT sistèm nan (koreksyon erè ki bloke — ADMIN sèlman).
 * ⚠️ IREVERSIB. Itilize sèlman lè done a kraze e ou pral re-enpòte koli a
 *    (Extension MCPACK / Import Conduce) pou l antre pwòp.
 * Li netwaye:
 *   • liy fakti a (invoice_items)
 *   • fakti a: rekalkile, oswa efase si li vin vid
 *   • koli a menm (packages) — li soti Packages, Historique, Conduce, dosye kliyan
 * Audit log ANVAN efasman (pou tras la rete menm apre koli a disparèt).
 */
export async function hardDeletePackage(
  pkgId: string
): Promise<{ ok: boolean; invoiceDeleted: boolean; reason?: string }> {
  const { data: p } = await supabase.from("packages")
    .select("id, tracking_number, tracking_manual, customer_code, customer_name, status, invoice_id, weight, content")
    .eq("id", pkgId).maybeSingle();
  if (!p) return { ok: false, invoiceDeleted: false, reason: "Colis introuvable." };

  // 1) Tras nan audit ANVAN nou efase (done a p ap egziste apre)
  await logAction("Suppression Colis",
    `${p.tracking_number} | Tracking:${p.tracking_manual || "—"} | Client:${p.customer_code} ${p.customer_name} | ` +
    `Poids:${p.weight} | Contenu:${p.content || "—"} | Statut:${p.status}` +
    (p.invoice_id ? " | était facturé" : ""),
    p.tracking_number, p.customer_code);

  // 2) Netwaye fakti a si koli a te fakture
  let invoiceDeleted = false;
  if (p.invoice_id) {
    await supabase.from("invoice_items").delete()
      .eq("invoice_id", p.invoice_id).eq("tracking_number", p.tracking_number);

    const { data: items } = await supabase.from("invoice_items")
      .select("total, weight").eq("invoice_id", p.invoice_id);
    const rest = items ?? [];
    if (!rest.length) {
      await supabase.from("invoices").delete().eq("id", p.invoice_id);
      invoiceDeleted = true;
    } else {
      const subtotal = rest.reduce((s: number, r: any) => s + (Number(r.total) || 0), 0);
      const weight = rest.reduce((s: number, r: any) => s + (Number(r.weight) || 0), 0);
      const { data: inv } = await supabase.from("invoices")
        .select("tax, frais_dga, discount, exchange_rate_used").eq("id", p.invoice_id).maybeSingle();
      const total = round2(subtotal + Number(inv?.tax ?? 0) + Number(inv?.frais_dga ?? 0) - Number(inv?.discount ?? 0));
      await supabase.from("invoices").update({
        subtotal: round2(subtotal), grand_total: total, total_usd: total,
        total_htg: round2(total * Number(inv?.exchange_rate_used ?? 0)),
        package_count: rest.length, total_weight: round2(weight)
      }).eq("id", p.invoice_id);
    }
  }

  // 3) Efase koli a nèt
  const { error } = await supabase.from("packages").delete().eq("id", pkgId);
  if (error) return { ok: false, invoiceDeleted, reason: error.message };

  return { ok: true, invoiceDeleted };
}

export async function getInvoices(): Promise<Invoice[]> {  const { data, error } = await supabase.from("invoices").select("*")
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

/**
 * ARTICLES À PRIX FIXE (forfait) — telefòn, laptòp, kamera…
 * Katalòg la anrejistre kòm JSON nan `app_settings` (kle: special_articles).
 * Zewo migrasyon SQL. Si li poko konfigire, nou retounen katalòg depa a.
 */
export async function getSpecialArticles(): Promise<SpecialArticle[]> {
  const s = await getSettings();
  const list = parseSpecialArticles(s.special_articles);
  return list.length ? list : DEFAULT_SPECIAL_ARTICLES;
}

export async function saveSpecialArticles(list: SpecialArticle[]): Promise<void> {
  await setSetting("special_articles", JSON.stringify(list));
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
  phone: string; whatsapp: string; country: string; city: string;
  address: string; id_type: string; id_number: string;
  ville_id?: string | null;   // lyen otomatik ak tarification (vil kliyan an chwazi a)
}): Promise<void> {
  // SEKIRITE: dedoublonaj + ekriti fèt KOTE SÈVÈ (/api/register-client).
  // Anvan, sa te fèt nan navigatè a — sa te mande li TOUT tab kliyan an,
  // ki t ap ekspoze done tout kliyan yo. Kounye a sèvè a fè travay la.
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token ?? "";
  const res = await fetch("/api/register-client", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, profile: p })
  });
  const j = await res.json().catch(() => ({ ok: false, reason: "Erreur réseau." }));
  if (!j.ok) throw new Error(j.reason ?? "Enregistrement impossible.");
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
    // Kapte IP + Navigateur kote sèvè (Audit Log Enterprise) — route dedye,
    // fallback silansye si li echwe (journal pa dwe janm bloke operasyon an)
    const { data: sess } = await supabase.auth.getSession();
    await fetch("/api/audit-log", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: sess?.session?.access_token ?? "",
        user_name: userName.trim(), action, details, package_ref: packageRef, customer_code: customerCode
      })
    });
  } catch { /* journal pa dwe janm bloke operasyon an */ }
}

export interface JournalRow {
  id: string; created_at: string; user_name: string; action: string;
  details: string; package_ref: string; customer_code: string;
  ip_address?: string; user_agent?: string;
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
      .select("id, tracking_manual, received_at, received_method, status").eq("id", m.matchedPkgId).maybeSingle();
    if (!before) continue;

    const patch: Record<string, unknown> = { received_at: now, received_method: "Analyse Photo", src_caribe: true };
    // Pwen #5: make koli a "En route vers agence" (🔴) — men PA fè l rekile si li deja pi lwen
    const dejaPlusLoin = ["Disponible", "Livré", "Facturé"].includes(before.status);
    if (!dejaPlusLoin) patch.status = "En route vers agence";
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
      received_method: before.received_method ?? "",
      status: before.status
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
    // Retabli SÈLMAN chan ki nan backup la (batch diferan gen chan diferan)
    const restore: Record<string, unknown> = {};
    if ("tracking_manual" in u) restore.tracking_manual = u.tracking_manual ?? "";
    if ("received_at" in u) restore.received_at = u.received_at ?? null;
    if ("received_method" in u) restore.received_method = u.received_method ?? "";
    if ("status" in u && u.status) restore.status = u.status;
    if (Object.keys(restore).length === 0) continue;
    await supabase.from("packages").update(restore).eq("id", u.id);
    restored++;
  }
  await supabase.from("import_batches").update({ undone: true }).eq("id", batch.id);
  await logAction("Annulation Import",
    `Batch ${batch.batch_id} annulé — ${restored} colis restaurés`, batch.batch_id, "");
  return { ok: true, batchId: batch.batch_id, restored };
}

/** JOURNAL OCR — chak foto analize (menm sa ki pa aplike). */
/** Telechaje yon foto scan nan Storage (pou ouvri l pita depi Journal). Retounen URL piblik. */
export async function uploadScanPhoto(file: File): Promise<string> {
  try {
    // SEKIRITE: verifye tip/gwosè vre (accept="image/*" se UX sèlman)
    const check = validateUpload(file, "image");
    if (!check.ok) return "";
    const path = storagePath(check.filename, "scan/");
    const { error } = await supabase.storage.from("scan-photos")
      .upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });
    if (error) return "";
    return supabase.storage.from("scan-photos").getPublicUrl(path).data.publicUrl || "";
  } catch { return ""; }
}

export async function logOcrScans(scans: PhotoMatch[], photoUrls?: Record<string, string>): Promise<void> {
  for (const s of scans) {
    // Foto ki PA oto-validé (no_match, review, conflict) -> "Photo non identifiée" pou ou jwenn+aranje yo
    const action = s.canApply ? "Journal OCR" : "Photo non identifiée";
    const url = photoUrls?.[s.filename];
    await logAction(action,
      `${s.filename} | barcode:${s.guiaSource === "barcode" ? "oui" : "non"} | Guía:${s.guia || "—"} | ` +
      `Tracking:${s.tracking_number || "—"} | Code:${s.customer_code || "—"} | ` +
      `confiance:${Math.round(s.confidence)}% | ${s.verdict}` +
      (url ? ` | photo:${url}` : ""),
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
