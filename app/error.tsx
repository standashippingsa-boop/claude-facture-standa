"use client";
import { useEffect } from "react";
import { MessageScreen } from "@/components/Toaster";

/**
 * Erè nan YON paj (pa nan layout rasin lan) : l ap parèt anndan layout la,
 * ak menu a ak sesyon an entak. Itilizatè a ka reeseye san pèdi koneksyon li.
 * (global-error.tsx rete dènye filè a pou erè layout rasin lan.)
 *
 * JANM error.message : li ka gen enfrastrikti oswa done kliyan. Menm règ ak
 * global-error.tsx pou Sentry : fòm `if (DSN) { import() }`, opt-in.
 */
export default function PageError({ error, reset }: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      import("@/lib/sentry-client")
        .then((Sentry) => Sentry.captureException(error))
        .catch(() => { /* pa kase paj erè a si rapò a echwe */ });
    }
  }, [error]);

  return (
    <MessageScreen
      tone="error"
      title="Cette page a rencontré un problème"
      text={"Vos données sont en sécurité.\nRéessayez, ou revenez à l'accueil si le problème continue."}
      actionLabel="Réessayer"
      onAction={() => reset()}
    />
  );
}
