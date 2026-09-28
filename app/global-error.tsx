"use client";
import { useEffect } from "react";

/**
 * Dènye filè sekirite : yon erè React ki pa kenbe okenn kote rive isit la.
 * Nou voye l bay Sentry (si aktive) epi nou montre yon paj pwòp — JANM
 * error.message (li ka gen enfrastrikti oswa done kliyan).
 * Sa ranplase root layout la : styles an liy (CSS Tailwind pa chaje isit la).
 * Import Sentry lazy + garde DSN (menm rezon ak instrumentation-client.ts :
 * san sa, SDK a ta antre nan bundle chak paj).
 */
export default function GlobalError({ error, reset }: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Fòm `if (DSN) { import() }` (pa `if (!DSN) return`) : sèl fòm webpack retire nèt.
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      import("@/lib/sentry-client")
        .then((Sentry) => Sentry.captureException(error))
        .catch(() => { /* pa kase paj erè a si rapò a echwe */ });
    }
  }, [error]);

  return (
    <html lang="fr">
      <body style={{
        margin: 0, minHeight: "100vh", display: "grid", placeItems: "center",
        background: "#f4f6f9", color: "#122b5c",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif"
      }}>
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Un problème technique est survenu</h1>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: "#4b5563", margin: "0 0 20px" }}>
            Veuillez réessayer. Si le problème continue, contactez STANDA COMMERCIAL.
          </p>
          <button onClick={() => reset()} style={{
            background: "#122b5c", color: "#fff", border: 0, borderRadius: 10,
            padding: "12px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer"
          }}>
            Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
