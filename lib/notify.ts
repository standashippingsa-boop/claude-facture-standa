"use client";
/**
 * STANDA — notifications de l'application (une seule source pour TOUT le système).
 *
 * Tout message (succès, erreur, information, avertissement) passe par ici et
 * s'affiche dans <Toaster /> (monté une fois dans app/layout.tsx) : une page
 * blanche plein écran avec un grand ✓ vert (succès) ou un grand ✕ rouge
 * (échec) et le texte de ce qui s'est passé. Aucune page ne dessine plus sa
 * propre bannière de texte.
 *
 *   notify.success("3 colis rendus disponibles.")
 *   notify.error("Paiement impossible.", { title: "Erreur de paiement" })
 *   useNoticeToast(notice, setNotice)   // convertit un ancien état `notice`
 */
import { useEffect } from "react";

export type ToastTone = "success" | "error" | "info" | "warning";
export type ToastItem = { id: number; tone: ToastTone; title: string; text: string; duration: number };
type ToastOptions = { title?: string; duration?: number };

const DEFAULT_TITLES: Record<ToastTone, string> = {
  success: "Opération confirmée",
  error: "Opération échouée",
  info: "À savoir",
  warning: "Attention"
};
// 0 = reste à l'écran jusqu'à ce que la personne touche le bouton.
const DEFAULT_DURATION: Record<ToastTone, number> = { success: 2800, info: 0, warning: 0, error: 0 };

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<(items: ToastItem[]) => void>();
const emit = () => listeners.forEach((listener) => listener(items));

export function subscribeToasts(listener: (items: ToastItem[]) => void) {
  listeners.add(listener);
  listener(items);
  return () => { listeners.delete(listener); };
}

export function dismissToast(id: number) {
  items = items.filter((item) => item.id !== id);
  emit();
}

function push(tone: ToastTone, text: string, options: ToastOptions = {}) {
  const clean = String(text ?? "").trim();
  if (!clean) return 0;
  // Le même message répété (ex. rafraîchissement automatique) ne s'empile pas.
  const duplicate = items.find((item) => item.text === clean && item.tone === tone);
  if (duplicate) dismissToast(duplicate.id);
  const item: ToastItem = {
    id: nextId++, tone, text: clean,
    title: options.title ?? DEFAULT_TITLES[tone],
    duration: options.duration ?? DEFAULT_DURATION[tone]
  };
  items = [...items, item].slice(-6);
  emit();
  return item.id;
}

export const notify = {
  success: (text: string, options?: ToastOptions) => push("success", text, options),
  error: (text: string, options?: ToastOptions) => push("error", text, options),
  info: (text: string, options?: ToastOptions) => push("info", text, options),
  warning: (text: string, options?: ToastOptions) => push("warning", text, options),
  /** Choisit le ton à partir du texte, pour les anciens messages sans type. */
  auto: (text: string, options?: ToastOptions) => push(guessTone(text), text, options)
};

const ERROR_WORDS = /impossible|erreur|échec|echec|invalide|introuvable|refus|indisponible|interdit|non autorisé|requis|dépasse|expir|n'a pas pu|n’a pas pu|manquant|incorrect|bloqué/i;
const WARNING_WORDS = /attention|vérifiez|verifiez|déjà|deja|aucun|en attente|à vérifier/i;

export function guessTone(text: string): ToastTone {
  const value = String(text ?? "");
  if (ERROR_WORDS.test(value)) return "error";
  if (WARNING_WORDS.test(value)) return "warning";
  if (/enregistr|modifi|créé|cree|ajout|supprim|confirm|mis à jour|mise à jour|envoy|activ|synchronis|copi|importé|généré|disponible|clôtur|réussi|valid|terminé|sauvegard/i.test(value)) return "success";
  return "info";
}

/**
 * Pont pour les écrans qui gardent un état `notice` (texte) : chaque nouveau
 * message devient une notification, puis l'état est vidé.
 */
export function useNoticeToast(
  notice: string | { type?: string; tone?: string; ok?: boolean; text?: string; s?: string; t?: string } | null | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clear?: (value: any) => void,
  options?: ToastOptions & { tone?: ToastTone }
) {
  useEffect(() => {
    if (!notice) return;
    if (typeof notice === "string") {
      const marked = /^\s*(✅|✔️?|❌|⚠️?)\s*/.exec(notice);
      const clean = marked ? notice.slice(marked[0].length) : notice;
      const markTone: ToastTone | undefined = marked ? (/✅|✔/.test(marked[1]) ? "success" : /❌/.test(marked[1]) ? "error" : "warning") : undefined;
      push(options?.tone ?? markTone ?? guessTone(clean), clean, options);
    }
    else {
      const text = notice.text ?? notice.s ?? "";
      const kind = notice.type ?? notice.tone ?? notice.t ?? (notice.ok === true ? "ok" : notice.ok === false ? "error" : "");
      const tone: ToastTone = kind === "ok" || kind === "success" ? "success"
        : kind === "error" || kind === "err" ? "error"
          : kind === "warn" || kind === "warning" ? "warning"
            : kind === "info" ? "info" : guessTone(text);
      push(tone, text, options);
    }
    clear?.(typeof notice === "string" ? "" : null);
    // `options` est volontairement ignoré des dépendances : seul le message déclenche.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice, clear]);
}
