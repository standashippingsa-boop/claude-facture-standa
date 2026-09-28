import { buildSentryOptions } from "@/lib/sentry-options";

/**
 * Sentry kote SÈVÈ (Node + Edge/middleware). Konfigirasyon an (ak retire done
 * pèsonèl) : lib/sentry-options.ts.
 *
 * LAZY + GARDE DSN : san NEXT_PUBLIC_SENTRY_DSN, `import()` yo retire nan build
 * la — SDK a pa antre nan okenn bundle (yon import estatik te double gwosè
 * middleware la, 33 → 77 kB, pou anyen).
 *
 * ⚠️ Kenbe fòm `if (process.env.NEXT_PUBLIC_SENTRY_DSN) { ...import()... }`.
 *    PA `if (!DSN) return;` : webpack pa retire kòd ki apre yon `return`, li
 *    ta kreye chunk Sentry a kanmenm (tès: middleware 33 → 104 kB).
 */
type SentryModule = typeof import("@sentry/nextjs");

/*
 * NODE SÈLMAN (NEXT_RUNTIME === "nodejs") : middleware la (Edge) sèlman fè
 * redireksyon/CORS/cookie ref — SDK Edge a ta ajoute ~72 kB sou li (33 → 105 kB)
 * pou yon kòd ki prèske pa kapab echwe. Erè wout API/paj yo ap pase pa Node.
 */
export async function register() {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init(buildSentryOptions());
  }
}

// Erè Server Components / route handlers (Next.js 15).
export async function onRequestError(...args: Parameters<SentryModule["captureRequestError"]>) {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureRequestError(...args);
  }
}
