#!/usr/bin/env node
/*
 * STANDA COMMERCIAL — GAD ISOLASYON SIT PIBLIK
 * ════════════════════════════════════════════
 * POUKISA SA EGZISTE
 * ──────────────────
 * Yon règ ki ekri nan yon dokiman ap kase yon jou. Yon règ ki KRAZE BUILD
 * la pa ka kase. Script sa a kouri anvan chak deplwaman: si yon paj piblik
 * eseye pale ak bazdone a, Vercel refize deplwaye.
 *
 * RÈG LA
 * ──────
 * Tout bagay anndan app/(site)/ se SIT PIBLIK la. Li PA GEN DWA enpòte:
 *    @/lib/supabase   -> kle Supabase la nan navigatè chak vizitè
 *    @supabase/...    -> menm bagay
 *    @/lib/db         -> aksè dirèk sou tab yo
 *    @/lib/authx      -> lojik kont
 *    @/lib/access     -> règ wòl entèn
 *
 * Sit piblik la gen YON SÈL pòt: fetch("/api/public/track").
 * Kle a rete sou sèvè a. Vizitè a resevwa JSON, pa yon kle.
 *
 * Si yon jou ou VLE louvri yon lòt pòt piblik, ajoute yon wout anba
 * app/api/public/ — pa yon enpòtasyon dirèk nan yon paj.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const ZONE = "app/(site)";
const INTERDI = [
  { motif: "@/lib/supabase",   pou: "kle Supabase la ta ale nan navigatè chak vizitè" },
  { motif: "@supabase/",       pou: "kliyan Supabase dirèk nan yon paj piblik" },
  { motif: "@/lib/db",         pou: "aksè dirèk sou tab bazdone yo" },
  { motif: "@/lib/authx",      pou: "lojik kont/otantifikasyon" },
  { motif: "@/lib/access",     pou: "règ wòl entèn yo" },
  { motif: "SUPABASE_SERVICE_ROLE", pou: "kle sèvis la pa janm ale nan kliyan an" }
];

function fichyeYo(dir) {
  const out = [];
  for (const nom of readdirSync(dir)) {
    const chemen = join(dir, nom);
    if (statSync(chemen).isDirectory()) out.push(...fichyeYo(chemen));
    else if (/\.(tsx?|jsx?|mjs)$/.test(nom)) out.push(chemen);
  }
  return out;
}

if (!existsSync(ZONE)) {
  console.log(`[isolation] ${ZONE} poko egziste — gad la pare pou lè sit la rive.`);
  process.exit(0);
}

const pwoblem = [];
for (const f of fichyeYo(ZONE)) {
  const src = readFileSync(f, "utf8");
  src.split("\n").forEach((liy, i) => {
    for (const { motif, pou } of INTERDI) {
      if (liy.includes(motif)) pwoblem.push({ f, n: i + 1, motif, pou, liy: liy.trim() });
    }
  });
}

if (pwoblem.length) {
  console.error("\n╔══════════════════════════════════════════════════════════════╗");
  console.error("║  DEPLWAMAN BLOKE — SIT PIBLIK LA TOUCHE BAZDONE A            ║");
  console.error("╚══════════════════════════════════════════════════════════════╝\n");
  for (const p of pwoblem) {
    console.error(`  ${p.f}:${p.n}`);
    console.error(`    ${p.liy}`);
    console.error(`    ✖ "${p.motif}" entèdi isit la — ${p.pou}\n`);
  }
  console.error("  SOLISYON: yon paj piblik pale ak sistèm nan YON SÈL fason:");
  console.error("      fetch(\"/api/public/track\", { method: \"POST\", ... })\n");
  console.error("  Si w bezwen yon lòt done piblik, kreye yon nouvo wout anba");
  console.error("  app/api/public/ — pa yon enpòtasyon dirèk nan yon paj.\n");
  process.exit(1);
}

console.log(`[isolation] ✅ ${ZONE} pwòp — okenn aksè bazdone dirèk.`);
