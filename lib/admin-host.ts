/**
 * Domèn administrasyon an (ex: "admin.standacommercialsa.com").
 * Defini nan Vercel -> Settings -> Environment Variables: ADMIN_HOST.
 * Vid = sous-domèn admin lan pa aktive (konpòtman ansyen an).
 * Nou aksepte SÈLMAN yon sous-domèn standacommercialsa.com — yon valè
 * mal tape pa ka janm voye admin yo sou yon domèn etranje.
 */
const raw = (process.env.ADMIN_HOST ?? "").trim().toLowerCase();

export const ADMIN_HOST: string | null =
  /^[a-z0-9-]+\.standacommercialsa\.com$/.test(raw) && raw !== "www.standacommercialsa.com" ? raw : null;
