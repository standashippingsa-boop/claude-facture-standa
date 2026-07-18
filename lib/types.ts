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
  selected?: boolean; // UI sèlman
}

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
  grand_total: number;    // USD
  exchange_rate_used: number;
  total_usd: number;
  total_htg: number;
  package_count: number;
  total_weight: number;
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
