import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Assemble des classes Tailwind : `clsx` gère les conditions (false, null, objets),
 * `tailwind-merge` garde la DERNIÈRE classe en cas de conflit
 * (cn("px-4 bg-navy", "bg-accent") → "px-4 bg-accent").
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
