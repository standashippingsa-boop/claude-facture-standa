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
 *
 * ⚠️ Sekirite reyèl la se sou SÈVÈ a (admin-auth valide wòl la). Gad sa a se
 * pou eksperyans + bloke navigasyon dirèk. Nou pa retire okenn gad ki egziste.
 */

export type AppRole = StaffRole | "client";

/** Paj piblik (pa mande koneksyon) */
export const PUBLIC_PREFIXES = [
  // 3 LYEN OFISYÈL YO: /admin-login (admin) · /login (kliyan) · /employe (anplwaye)
  "/login", "/admin-login", "/employe", "/setup",
  "/inscription",                       // ansyen lyen -> redirije sou /login?tab=signup
  "/reset-password", "/nouveau-mot-de-passe", "/confidentialite"
];

/** Paj kliyan (wòl "client" sèlman) */
export const CLIENT_PREFIXES = ["/espace-client"];

/**
 * Paj ADMIN sèlman (Employé bloke). Tout lòt paj staff yo louvri pou
 * admin + employé (koli, kliyan, fakti, sync, historique, journal, retraits).
 */
export const ADMIN_ONLY_PREFIXES = ["/settings"];

/** Èske chemen sa a piblik? */
export function isPublicPath(path: string): boolean {
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + "/") || path.startsWith(p));
}

/** Èske chemen sa a se yon paj kliyan? */
export function isClientPath(path: string): boolean {
  return CLIENT_PREFIXES.some((p) => path.startsWith(p));
}

/** Èske chemen sa a admin-sèlman? */
export function isAdminOnlyPath(path: string): boolean {
  return ADMIN_ONLY_PREFIXES.some((p) => path.startsWith(p));
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
    return { allowed: false, redirect: isClientPath(path) ? "/login" : "/admin-login" };
  }

  // Kliyan
  if (role === "client") {
    // Kliyan ka al SÈLMAN nan espas kliyan an
    if (isClientPath(path)) return { allowed: true, redirect: null };
    return { allowed: false, redirect: "/espace-client" };
  }

  // Staff (admin/employe) pa gen dwa nan espas kliyan an
  if (isClientPath(path)) return { allowed: false, redirect: "/" };

  // Admin: tout paj staff
  if (role === "admin") return { allowed: true, redirect: null };

  // Employé: tout paj staff SÒF admin-only yo
  if (isAdminOnlyPath(path)) return { allowed: false, redirect: "/" };
  return { allowed: true, redirect: null };
}
