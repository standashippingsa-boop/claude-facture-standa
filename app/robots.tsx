import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/branding";

/*
 * STANDA COMMERCIAL — robots.txt
 * ══════════════════════════════
 * Di Google KLÈMAN sa pou l endekse epi sa pou l pa touche.
 *
 * ENDEKSE  : sit wèb piblik la sèlman (akèy, contact, agences, konfidansyalite)
 * PA TOUCHE: tout zouti entèn nan — dashboard, koli, kliyan, fakti, conduces,
 *            paj koneksyon, wout API. Yo pa gen anyen pou fè nan rechèch
 *            Google, epi yo ta ka bay yon atakè yon kat sistèm nan.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/accueil", "/contact", "/agences", "/confidentialite"],
        disallow: [
          "/api/",
          "/dashboard",                       // tablo de bò admin (te sou "/")
          "/admin-login", "/employe", "/login", "/inscription",
          "/espace-client", "/clients", "/packages", "/invoices",
          "/conduces", "/bon-remise", "/retraits", "/journal",
          "/historique", "/settings", "/sync", "/setup",
          "/reset-password", "/nouveau-mot-de-passe"
        ]
      }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  };
}
