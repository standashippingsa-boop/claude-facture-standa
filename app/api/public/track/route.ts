import { NextResponse } from "next/server";

/*
 * STANDA COMMERCIAL — ANSYEN WOUT TRACKING (FÈMEN)
 * ════════════════════════════════════════════════
 * Wout sa a te premye vèsyon tracking piblik la. Sit wèb la sèvi ak
 * /api/track kounye a.
 *
 * POUKISA NOU FÈMEN L OLYE EFASE L
 * ────────────────────────────────
 * De pòt pou menm done = de kote pou siveye, epi de kote ki ka divèje
 * (youn resevwa yon koreksyon sekirite, lòt la pa resevwa l). Nou kenbe
 * YON SÈL pòt: /api/track.
 *
 * Nou kite fichye a la, fèmen, olye nou efase l — konsa si yon ansyen
 * lyen, yon script oswa yon kach rele l toujou, li resevwa yon repons
 * klè olye yon 404 ki ta ka fè yon moun panse gen yon bug.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ferme = () =>
  NextResponse.json(
    { ok: false, moved: true, use: "/api/track", reason: "Endpoint déplacé." },
    {
      status: 410,   // Gone — li te la, li pa la ankò
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
        "X-Robots-Tag": "noindex, nofollow"
      }
    }
  );

export function POST() { return ferme(); }
export function GET() { return ferme(); }
