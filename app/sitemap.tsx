import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/branding";

/*
 * STANDA COMMERCIAL — sitemap.xml
 * ═══════════════════════════════
 * Kat sit la pou Google. SÈLMAN paj piblik yo — yon paj entèn nan sitemap
 * la ta envite Google vin gade yon kote li pa gen dwa ale.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const jodi = new Date();
  return [
    { url: `${SITE_URL}/accueil`,          lastModified: jodi, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${SITE_URL}/agences`,          lastModified: jodi, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/contact`,          lastModified: jodi, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/confidentialite`,  lastModified: jodi, changeFrequency: "yearly",  priority: 0.3 }
  ];
}
