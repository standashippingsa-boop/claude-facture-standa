#!/usr/bin/env node
/*
 * STANDA COMMERCIAL — GAD ISOLASYON SIT PIBLIK  (v3)
 * ══════════════════════════════════════════════════
 * Yon règ ki ekri nan yon dokiman ap kase yon jou. Yon règ ki KRAZE BUILD
 * la pa ka kase. Script sa a kouri anvan chak deplwaman.
 *
 * DE BUG NOU KORIJE
 * ─────────────────
 * v1: li t ap gade app/(site)/ — men sit la bati nan app/accueil,
 *     app/contact, app/agences. Gad la t ap gade yon dosye vid epi li
 *     t ap di "pwòp" chak fwa. Yon gad ki pa gade bay FO KONFYANS.
 *
 * v2: li t ap gade bon dosye yo, men SÈLMAN enpòtasyon DIRÈK.
 *     app/agences/page.tsx enpòte @/lib/agences, ki li menm enpòte
 *     @/lib/supabase. Gad la pa t wè l. v3 SWIV CHÈN NAN jouk nan bout.
 *
 * SA GAD LA VERIFYE
 * ─────────────────
 *  A) Zòn obligatwa yo egziste (yon dosye ki chanje non pa ka fè gad la
 *     vin inèt an silans).
 *  B) Kle SÈVIS la (SUPABASE_SERVICE_ROLE) pa janm nan zòn piblik la.
 *     Yon paj piblik pa janm gen dwa manyen l — se pou wout API yo.
 *  C) Yon konpozan "use client" nan zòn piblik la pa janm rive sou yon
 *     modil bazdone, ni dirèk ni endirèk. Se KA KI PI GRAV la: kòd
 *     "use client" ale nan navigatè chak vizitè ak kle a ladan l.
 *  D) Yon konpozan SÈVÈ ka li bazdone a SÈLMAN atravè yon modil deklare
 *     nan MODIL_SÈVÈ_OTORIZE. Kòd sèvè pa ale nan navigatè a, men chak
 *     modil dwe pase yon revizyon (lis blanch kolòn) anvan.
 *
 * POU AJOUTE YON PAJ PIBLIK: mete chemen an nan ZONES.
 * POU AJOUTE YON LEKTI SÈVÈ: mete modil la nan MODIL_SÈVÈ_OTORIZE
 *                            APRE ou fin verifye li gen yon lis blanch.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const ZONES = ["app/accueil", "app/contact", "app/agences", "app/(site)", "components/site"];
const ZONES_OBLIGATWA = ["app/accueil", "components/site"];

/** Modil ki pale ak bazdone a. */
const MODIL_BAZDONE = ["@/lib/supabase", "@/lib/db", "@/lib/authx", "@/lib/access"];

/**
 * Modil bazdone yon paj SÈVÈ piblik gen dwa itilize.
 * Chak youn revize: li fè yon SELECT ak lis blanch kolòn, pa select("*").
 */
const MODIL_SÈVÈ_OTORIZE = ["@/lib/agences"];

const EXT = [".ts", ".tsx", ".js", ".jsx", ".mjs"];

function fichyeYo(dir) {
  const out = [];
  for (const nom of readdirSync(dir)) {
    const chemen = join(dir, nom);
    if (statSync(chemen).isDirectory()) out.push(...fichyeYo(chemen));
    else if (/\.(tsx?|jsx?|mjs)$/.test(nom)) out.push(chemen);
  }
  return out;
}

/** Rezoud yon spesifikatè "@/..." oswa "./..." an yon vre chemen fichye. */
function rezoud(spec, depiFichye) {
  let baz;
  if (spec.startsWith("@/")) baz = spec.slice(2);
  else if (spec.startsWith(".")) baz = resolve(dirname(depiFichye), spec).replace(process.cwd() + "/", "");
  else return null;                                  // pakè npm — pa nou
  for (const e of EXT) if (existsSync(baz + e)) return baz + e;
  for (const e of EXT) if (existsSync(join(baz, "index" + e))) return join(baz, "index" + e);
  return null;
}

const IMPORT_RE = /(?:import|export)[\s\S]*?from\s+["']([^"']+)["']/g;

function enpòtasyonYo(src) {
  const out = [];
  for (const m of src.matchAll(IMPORT_RE)) out.push(m[1]);
  return out;
}

/**
 * Swiv chèn enpòtasyon yo. Retounen premye chemen ki mennen sou yon
 * modil bazdone, oswa null.
 */
function chèneVèBazdone(fichye, vizite = new Set(), chemen = []) {
  if (vizite.has(fichye)) return null;
  vizite.add(fichye);
  const src = readFileSync(fichye, "utf8");

  for (const spec of enpòtasyonYo(src)) {
    if (spec.startsWith("@supabase/")) return [...chemen, fichye, spec];
    if (MODIL_BAZDONE.includes(spec)) return [...chemen, fichye, spec];
    const swivan = rezoud(spec, fichye);
    if (swivan && existsSync(swivan)) {
      const r = chèneVèBazdone(swivan, vizite, [...chemen, fichye]);
      if (r) return r;
    }
  }
  return null;
}

/** Premye modil otorize ki nan chèn nan (si genyen). */
function modilOtorizeNanChèn(fichye) {
  const src = readFileSync(fichye, "utf8");
  return enpòtasyonYo(src).find((s) => MODIL_SÈVÈ_OTORIZE.includes(s)) ?? null;
}

const erè = [];

// ── A. Zòn yo dwe egziste ────────────────────────────────────────────────
for (const z of ZONES_OBLIGATWA) {
  if (!existsSync(z)) {
    erè.push({ titre: "GAD LA PA JWENN SIT PIBLIK LA",
      detay: [`${z} pa egziste`,
              "Yon dosye chanje non? Mete nouvo chemen an nan ZONES."] });
  }
}

// ── B/C/D. Analize chak fichye ───────────────────────────────────────────
let konte = 0, sèvè = 0;
for (const zone of ZONES) {
  if (!existsSync(zone)) continue;
  for (const f of fichyeYo(zone)) {
    konte++;
    const src = readFileSync(f, "utf8");
    const estClient = /^\s*["']use client["']/m.test(src);

    // B. Kle sèvis la pa janm nan zòn piblik la
    src.split("\n").forEach((liy, i) => {
      if (liy.trim().startsWith("*") || liy.trim().startsWith("//")) return;
      if (liy.includes("SUPABASE_SERVICE_ROLE") || liy.includes("SUPABASE_SECRET_KEY")) {
        erè.push({ titre: "KLE SÈVIS LA NAN YON PAJ PIBLIK",
          detay: [`${f}:${i + 1}`, liy.trim(),
                  "Kle sèvis la se pou wout API sèlman, jamè yon paj."] });
      }
    });

    const chèn = chèneVèBazdone(f);
    if (!chèn) continue;

    if (estClient) {
      // C. KA KI PI GRAV: kòd sa a ale nan navigatè chak vizitè
      erè.push({ titre: "KONPOZAN NAVIGATÈ TOUCHE BAZDONE A",
        detay: [`${f}  ("use client")`,
                "Chèn: " + chèn.join("  ->  "),
                "Kòd \"use client\" ale nan navigatè chak vizitè.",
                "Sèvi ak fetch(\"/api/track\") olye sa."] });
    } else {
      const otorize = modilOtorizeNanChèn(f);
      if (!otorize) {
        // D. Paj sèvè ki li bazdone a atravè yon modil ki pa revize
        erè.push({ titre: "PAJ SÈVÈ PIBLIK LI BAZDONE A SAN OTORIZASYON",
          detay: [`${f}`,
                  "Chèn: " + chèn.join("  ->  "),
                  "Si lekti sa a nesesè epi li gen yon LIS BLANCH kolòn,",
                  "ajoute modil la nan MODIL_SÈVÈ_OTORIZE."] });
      } else sèvè++;
    }
  }
}

if (erè.length) {
  console.error("\n╔══════════════════════════════════════════════════════════════╗");
  console.error("║  DEPLWAMAN BLOKE — ISOLASYON SIT PIBLIK VYOLE                ║");
  console.error("╚══════════════════════════════════════════════════════════════╝\n");
  for (const e of erè) {
    console.error(`  ✖ ${e.titre}`);
    for (const d of e.detay) console.error(`      ${d}`);
    console.error("");
  }
  process.exit(1);
}

console.log(`[isolation] ✅ ${konte} fichye piblik analize (chèn enpòtasyon konplè)`
  + (sèvè ? ` · ${sèvè} lekti sèvè otorize` : "")
  + " — okenn fwit.");
