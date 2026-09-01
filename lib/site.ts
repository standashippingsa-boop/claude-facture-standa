/**
 * STANDA COMMERCIAL — ENFÒMASYON SIT PIBLIK LA (SITE)
 * ═══════════════════════════════════════════════════
 * ⚠️ FICHYE SA A DWE RETE "SÈVÈ-SAN-DANJE" (pa gen "use client" ladan l).
 *
 * Poukisa fichye sa a egziste apa:
 *   SITE te konn defini anndan components/site/SiteHeader.tsx — men fichye sa a
 *   gen "use client" (li itilize useState/usePathname pou meni telefòn lan).
 *   Lè yon PAJ SÈVÈ (tankou app/contact/page.tsx, ki PA "use client") enpòte
 *   yon valè senp (non-konpozan) sòti nan yon fichye "use client", Next.js
 *   rezoud valè sa a kòm undefined pandan jenerasyon paj la — sa te lakòz
 *   bouton Telefòn/WhatsApp/Imèl/Instagram parèt kase (tel:undefined, elatriye)
 *   sou paj Contact la, byenke kòd la te sanble kòrèk.
 *
 *   SOLISYON: mete SITE nan yon fichye SEPARE, san "use client", pou
 *   TOULEDE paj sèvè (page.tsx) AK konpozan client (SiteHeader/SiteFooter/
 *   ContactForm) ka enpòte l san danje.
 *
 * Pou chanje yon nimewo oswa yon imèl: se ISIT sèlman.
 */
export const SITE = {
  name: "STANDA COMMERCIAL",
  email: "standacommercialsa@gmail.com",
  phone: "+509 4673 8117",
  /** Nimewo san espas ni + — se fòma wa.me la mande */
  whatsapp: "50946738117",
  /** ⚠️ VERIFYE: non itilizatè Instagram lan (sa ki gen @ devan l) */
  instagram: "standa_commercial_sa",
  instagramUrl: "https://instagram.com/standa_commercial_sa",
  facebookUrl: "https://www.facebook.com/share/1DSwxDWqq5/",
  tiktokUrl: "https://www.tiktok.com/@standa_commercials.a"
};
