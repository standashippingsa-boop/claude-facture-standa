import { buildSentryOptions } from "@/lib/sentry-options";

/*
 * Sentry kote NAVIGATÈ — lib/sentry-options.ts pou tout règ done pèsonèl.
 *
 * @sentry/browser (pa @sentry/nextjs) : nou bezwen SÈLMAN kaptire erè. SDK
 * Next.js la peze ~145 kB gzip kote navigatè a; browser la ~5x mwens.
 * (@sentry/nextjs rete pou sèvè a — instrumentation.ts.)
 *
 * LAZY + GARDE DSN : san NEXT_PUBLIC_SENTRY_DSN, Next retire branch sa a nan
 * bundle la (valè a antre nan build — gade `env` nan next.config.mjs) epi SDK
 * a pa janm telechaje. Lè DSN a mete, li vini nan yon chunk apa, apre paj la.
 *
 * ⚠️ Kenbe fòm `if (DSN) { import() }` — PA `if (!DSN) return` (webpack pa
 *    retire kòd ki apre yon return, chunk la ta kreye kanmenm).
 */
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  import("@/lib/sentry-client")
    .then((Sentry) => Sentry.init(buildSentryOptions()))
    .catch(() => { /* rapò erè pa dwe janm kase aplikasyon an (offline, chunk pèdi) */ });
}
