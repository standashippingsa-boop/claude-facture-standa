export interface Ville {
  id?: string;
  name: string;
  price_personal: number; // USD / lb (Compte Personnel)
  price_business: number; // USD / lb (Compte Business)
  tax_personal: number;   // USD / lb
  tax_business: number;   // USD / lb
  fixed_fee: number;      // USD (opsyonèl)
  active: boolean;
  created_at?: string;
}

export type AccountType = "Personnel" | "Business";

export type AccountStatus = "En attente d'activation" | "Actif";

export interface Client {
  id?: string;
  customer_code: string;          // Kòd MCPACK (MC-XXXX / 36191) — vid toutotan kont lan poko aktive
  fullname: string;
  whatsapp: string;
  pickup_location: string;
  email?: string | null;
  ville_id?: string | null;
  ville?: Ville | null;   // join lekti sèlman
  account_type: AccountType;
  // ---- Enskripsyon kliyan (v6) ----
  surname?: string;
  phone?: string;
  country?: string;
  city?: string;
  city2?: string;
  address?: string;
  id_type?: string;       // 'Kat Idantite Nasyonal' | 'Paspò'
  id_number?: string;
  account_status?: AccountStatus;
  auth_user_id?: string | null;
  username?: string | null;              // = kòd MC (MC-XXXXX)
  must_change_password?: boolean;
  created_at?: string;
}

/** Statut entèn (admin sèlman) + "Facturé" (facturation) + fleksibilite pou ansyen valè. */
export type PackageStatus = (typeof INTERNAL_STATUSES)[number] | "Facturé" | (string & {});

/** Statuts entèn STANDA — se ADMIN sèlman ki chanje yo (MCPACK pa manyen yo) */
export const INTERNAL_STATUSES = [
  "Reçu à Miami", "En préparation", "En transit", "Arrivé en Haïti",
  "En route vers agence", "Disponible", "Livré"
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// CONDUCE -> STATUT OTOMATIK
// ───────────────────────────────────────────────────────────────────────────
// RÈG BIZNIS: yon nimewo Conduce se yon manifest Caribe Tours. Depi nou gen
// nimewo a nan men nou, lo a DEJA RIVE AN AYITI (Ouanaminthe). Donk chak koli
// ki antre nan yon conduce pase otomatikman nan "Arrivé en Haïti".
//
// GAD KRITIK — YON KOLI PA JANM RECULE:
//   Si yon koli deja pi lwen ("En route vers agence", "Disponible", "Livré",
//   "Facturé"), nou PA touche l. Fè yon koli disponib retounen "Arrivé en
//   Haïti" ta twonpe kliyan an epi kase travay agans lan.
//
// Statut la viv nan YON SÈL kote: colonn `packages.status`. Chanje l isit la
// epi li chanje PATOU otomatikman — admin, employé, app kliyan, imèl, PDF.
// ═══════════════════════════════════════════════════════════════════════════
export const CONDUCE_ARRIVAL_STATUS = "Arrivé en Haïti";

/**
 * Èske nou dwe monte koli sa a nan "Arrivé en Haïti"?
 * true sèlman si statut aktyèl la pi ba pase "Arrivé en Haïti".
 */
export function shouldPromoteOnConduce(current?: string | null, invoiceId?: string | null): boolean {
  if (invoiceId) return false;                       // deja fakti — pa touche
  const st = String(current ?? "").trim();
  if (st === "Facturé") return false;
  const cible = INTERNAL_STATUSES.indexOf(CONDUCE_ARRIVAL_STATUS as never);
  const actuel = INTERNAL_STATUSES.indexOf(st as never);
  if (actuel < 0) return true;                       // statut vid/enkoni -> nou fikse l
  return actuel < cible;                             // sèlman si l ap AVANSE
}

export interface Conduce {
  id: string;
  conduce_number: string;
  office: string;
  conduce_date?: string | null;
  status: string;               // En cours | Complète | Facturée
  imported_by: string;
  imported_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Pkg {
  id: string;
  tracking_number: string;   // Tracking ID (Guía) — idantifyan inik la
  tracking_manual: string;   // Tracking Number (transpòtè) — admin antre l manyèlman, sync pa janm efase l
  status_mcpack: string;     // statut MCPACK orijinal (enfòmatif — mete ajou pa sync)
  fob: number;               // valè FOB Excel la (chan apa — li pa kole sou dat la)
  customer_code: string;
  customer_name: string;
  weight: number;
  quantity: number;
  content: string;
  created_date: string;
  status: PackageStatus;
  price_usd: number;
  tax_usd: number;
  total_usd: number;
  price_htg: number;
  tax_htg: number;
  total_htg: number;
  invoice_id?: string | null;
  mcpack_data?: Record<string, string>; // TOUT kolòn Excel MCPACK la
  received_at?: string | null;      // dat/lè resepsyon MCPACK (otomatik sèlman)
  received_method?: string;         // Synchronisation MCPACK | Import PDF | Analyse Photo | Extension Chrome
  archived?: boolean;               // pwen #4 — koli pa janm efase, jis archived
  src_extension?: boolean;          // sous miltip — koli pase pa Extension
  src_caribe?: boolean;             // sous miltip — koli scanne (Caribe Tours)
  src_facture?: boolean;            // sous miltip — koli nan yon Facture
  verified?: boolean;               // Scanner de Réception — koli verifye fizikman
  verified_at?: string | null;
  verified_by?: string;
  proof_photo_url?: string;         // Faz 3 — foto de preuve resepsyon
  proof_photo_at?: string | null;
  invoiced_at?: string | null;      // Archivage otomatik apre fakti
  conduce_id?: string | null;       // Modil Conduces — Single Source of Truth (filtè, pa dwaplikaj)
  selected?: boolean; // UI sèlman
}

/**
 * Kalite fakti a.
 *  - "shipping"      : fakti transpò klasik (defo — konpòtman istorik la).
 *  - "service_order" : fakti ki gen ANPLIS pri acha yon kòmand + frè sèvis.
 * Yon fakti "service_order" gen TOUDE: pati kòmand lan AK pati transpò a.
 */
export type InvoiceKind = "shipping" | "service_order";

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_code: string;
  customer_name: string;
  whatsapp: string;
  pickup_location: string;
  ville: string;             // vil kliyan an (fikse lè fakti a kreye)
  subtotal: number;       // USD
  tax: number;            // USD
  grand_total: number;
  frais_dga?: number;    // USD (Tax DGA — manyèl, si aktive)
  discount?: number;     // USD (rabè — si > 0)
  calc_mode?: string;    // "addition" | "small_control"
  per_lb_used?: number;  // Prix/LB ki te itilize (jounal finansye)
  exchange_rate_used: number;
  total_usd: number;
  total_htg: number;
  package_count: number;
  total_weight: number;

  // ── SERVICE ORDER (acha pou kliyan) ────────────────────────────────────
  // Tout chan sa yo OPSYONÈL epi yo vo 0 sou fakti shipping òdinè.
  // Yon fakti shipping klasik kontinye mache egzakteman menm jan.
  /** "shipping" (defo) oswa "service_order". */
  invoice_kind?: InvoiceKind;
  /** Pri acha TOTAL kòmand yo (USD) — sa STANDA te peye pou kliyan an. */
  order_purchase?: number;
  /** Frè sèvis acha, kalkile ak tablo tranch nan Paramètres (USD). */
  order_service_fee?: number;
  /** Acompte kliyan an te deja bay (USD). */
  order_deposit?: number;
  /** Sa kliyan an rete dwe: total_usd − order_deposit. */
  balance_due?: number;

  pdf_url?: string | null;
  created_at: string;
}

export interface InvoiceItem {
  id?: string;
  invoice_id: string;
  tracking_number: string;   // Tracking ID (Guía)
  tracking_manual?: string;  // Tracking Number manyèl (si admin te antre l)
  weight: number;
  content: string;
  price: number;
  tax: number;
  total: number;
  is_small?: boolean;   // koli sa a te sèvi ak tarif Petit Colis
  per_lb?: number;      // pri/lb ki te itilize (pou detay PDF)
  /** Non atik a pri fiks (fòfè) — AFICHAJ PDF SÈLMAN, pa yon kolòn bazdone. */
  fixed_label?: string;
}

export interface ImportLog {
  id?: string;
  filename: string;
  total_rows: number;
  new_packages: number;
  existing_packages: number;
  new_clients: number;
  errors: number;
  created_at?: string;
}

export interface DashboardStats {
  totalClients: number;
  disponibles: number;
  factures: number;
  totalInvoices: number;
  revenue: number;
  lastImport: ImportLog | null;
}

// ===== Demande de retrait de colis (v8) =====
export type RetraitStatus = "En attente" | "Préparé" | "Remis";

export interface Retrait {
  id: string;
  customer_code: string;
  customer_name: string;
  ville: string;
  package_count: number;
  total_weight: number;
  status: RetraitStatus;
  created_at: string;
  items?: RetraitItem[];
}

export interface RetraitItem {
  id?: string;
  retrait_id: string;
  tracking_number: string;   // Tracking ID (Guía)
  tracking_manual: string;   // Tracking Number (si disponib)
  content: string;
  weight: number;
}

// ===== v9: Authentication =====
export type StaffRole = "admin" | "employe";
export interface Staff {
  id?: string;
  auth_user_id?: string | null;
  role: StaffRole;
  username: string;
  nom: string;
  prenom: string;
  email: string;
  phone: string;
  id_number: string;
  id_photo_url: string;
  created_at?: string;
}
