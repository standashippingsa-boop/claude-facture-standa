import { redirect } from "next/navigation";

/*
 * RASIN DOMÈN NAN -> SIT PIBLIK LA
 * ════════════════════════════════
 * middleware.ts deja redirije "/" sou "/accueil" anvan React monte.
 * Fichye sa a se yon SEKOU: si yon jou middleware la pa kouri (ekzanp yon
 * chanjman nan `matcher` la), rasin lan ap toujou mennen sou sit piblik la
 * olye li montre yon paj vid oswa yon erè.
 *
 * Tablo de bò admin an kounye a sou /dashboard.
 */
export default function Root() {
  redirect("/accueil");
}
