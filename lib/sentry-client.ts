/*
 * SÈL fichye ki enpòte @sentry/browser (kote navigatè). Li re-ekspòte SÈLMAN
 * sa nou sèvi, pou webpack ka koupe rès SDK a (Replay, Feedback, tracing...).
 * `import("@sentry/browser")` dirèk kenbe TOUT ekspò yo (~103 kB gzip).
 *
 * Pa ajoute `replayIntegration` isit la san revizyon: li anrejistre ekran
 * kliyan an (telefòn, adrès, idantite). Gade lib/sentry-options.ts.
 */
export { init, captureException } from "@sentry/browser";
