import { StaffRole } from "./types";

/**
 * CONTRÔLE D'ACCÈS CENTRALISÉ (RBAC) — STANDA COMMERCIAL
 * ══════════════════════════════════════════════════════════
 * Yon SÈL sous verite pou "ki wòl ka al ki paj". Shell la ak Sidebar la
 * tou de sèvi ak li — konsa pa gen 2 lojik diferan (prensip: yon sèl moteur).
 *
 * Wòl yo:
 *   - "admin"  : Administrateur — aksè konplè
 *   - "employe": Employé — zouti travay (koli, kliyan, fakti, sync, scanner)
 *                MEN pa Paramètres/Tarification/Taxes/Utilisateurs/API/Sécurité
 *   - "client" : Kliyan — sèlman espas pèsonèl li (/espace-client)
 *   - "agent_retrait": ajan pwen rekiperasyon — sèlman /espace-remise
 *
 * ⚠️ Sekirite reyèl la se sou SÈVÈ a (admin-auth valide wòl la). Gad sa a se
 * pou eksperyans + bloke navigasyon dirèk. Nou pa retire okenn gad ki egziste.
 */

export type AppRole = StaffRole | "client";

/**
 * Paj piblik (pa mande koneksyon)
 *
 * ⚠️ RÈG SEKIRITE ABSOLI — PA JANM AJOUTE "/" NAN LIS SA A.
 *    isPublicPath() sèvi ak startsWith(). Kòm TOUT chemen kòmanse ak "/",
 *    ajoute "/" ta rann sit la NÈT piblik: /clients, /invoices, /settings,
 *    /packages... tout ta louvri san koneksyon. Se yon katastwòf sekirite.
 *    Lè n ap mete Accueil la sou adrès prensipal la, n ap sèvi ak yon
 *    match EGZAK (path === "/"), pa ak yon prefiks.
 */
export const PUBLIC_PREFIXES = [
  // 3 LYEN OFISYÈL YO: /admin-login (admin) · /login (kliyan) · /employe (anplwaye)
  "/login", "/admin-login", "/employe", "/setup",
  "/inscription",                       // ansyen lyen -> redirije sou /login?tab=signup
  "/reset-password", "/nouveau-mot-de-passe", "/confidentialite",
  "/espace-client/connexion",            // koneksyon APLIKASYON an (anndan scope PWA)

  // ── SIT WÈB PIBLIK STANDA COMMERCIAL ──
  // Vizitè yo (moun ki poko kliyan) dwe ka wè paj sa yo san konekte.
  // Yo pa li okenn done kliyan: tracking piblik la pase pa /api/track.
  "/accueil",                           // paj akèy piblik la
  "/contact",                           // fòm kontak + WhatsApp
  "/agences"                            // lis ajans yo an Ayiti
];

/** Paj kliyan (wòl "client" sèlman) */
export const CLIENT_PREFIXES = ["/espace-client"];

/** Paj travay ajan remiz yo. Pa mete paj koneksyon an isit la: li piblik. */
export const PICKUP_AGENT_PREFIXES = ["/espace-remise"];

/**
 * Paj ADMIN sèlman (Employé bloke). Tout lòt paj staff yo louvri pou
 * admin + employé (koli, kliyan, fakti, sync, historique, journal, retraits).
 */
export const ADMIN_ONLY_PREFIXES = ["/settings", "/reviews", "/points-retrait"];

/**
 * Match yon prefiks ak yon fwontyè segman: "/login" matche "/login" ak
 * "/login/xxx" MEN PA "/login-secret". Yon `startsWith(p)` tou senp ta
 * louvri nenpòt chemen ki jis KÒMANSE ak tèks la — yon fwit aksè.
 */
function underPrefix(path: string, prefixes: string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(p + "/"));
}

/** Èske chemen sa a piblik? */
export function isPublicPath(path: string): boolean {
  // Match EGZAK sèlman: /point-retrait se pòt koneksyon an. Nou pa vle yon
  // paj fiti tankou /point-retrait/xxx vin piblik pa erè.
  return path === "/point-retrait" || underPrefix(path, PUBLIC_PREFIXES);
}

/** Èske chemen sa a se yon paj kliyan? */
export function isClientPath(path: string): boolean {
  return underPrefix(path, CLIENT_PREFIXES);
}

/** Èske se espas ki rezève pou ajan ki remèt koli yo? */
export function isPickupAgentPath(path: string): boolean {
  return underPrefix(path, PICKUP_AGENT_PREFIXES);
}

/** Èske chemen sa a admin-sèlman? */
export function isAdminOnlyPath(path: string): boolean {
  return underPrefix(path, ADMIN_ONLY_PREFIXES);
}

/**
 * Deside si yon wòl gen dwa sou yon chemen (paj staff yo).
 * Retounen { allowed, redirect } — redirect se kote pou voye si refize.
 */
export function resolveAccess(path: string, role: AppRole | null): {
  allowed: boolean; redirect: string | null;
} {
  // Paj piblik: tout moun
  if (isPublicPath(path)) return { allowed: true, redirect: null };

  // Pa gen wòl (pa konekte) -> login apwopriye
  if (!role) {
    if (isClientPath(path)) return { allowed: false, redirect: "/login" };
    if (isPickupAgentPath(path)) return { allowed: false, redirect: "/point-retrait" };
    return { allowed: false, redirect: "/admin-login" };
  }

  // Kliyan
  if (role === "client") {
    // Kliyan ka al SÈLMAN nan espas kliyan an
    if (isClientPath(path)) return { allowed: true, redirect: null };
    return { allowed: false, redirect: "/espace-client" };
  }

  // Ajan remiz la pa yon employé jeneral: li pa gen dwa sou okenn ekran
  // lojistik/finans, menm si li tape URL yo dirèkteman.
  if (role === "agent_retrait") {
    if (isPickupAgentPath(path)) return { allowed: true, redirect: null };
    return { allowed: false, redirect: "/espace-remise" };
  }

  // Staff (admin/employe) pa gen dwa nan espas kliyan an
  if (isClientPath(path)) return { allowed: false, redirect: "/dashboard" };

  // Espas remiz la se ekran ajan an sèlman.
  if (isPickupAgentPath(path)) return { allowed: false, redirect: "/dashboard" };

  // Admin: tout paj staff
  if (role === "admin") return { allowed: true, redirect: null };

  // Employé: tout paj staff SÒF admin-only yo
  if (isAdminOnlyPath(path)) return { allowed: false, redirect: "/dashboard" };
  return { allowed: true, redirect: null };
}
