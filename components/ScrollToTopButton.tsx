"use client";

import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";

/**
 * Raccourci commun aux espaces connectés.
 * Il reste discret et n'apparaît que lorsque la page contient assez de contenu.
 */
export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => setVisible(window.scrollY > 420);
    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Retourner en haut de la page"
      className="fixed bottom-20 right-3 z-40 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#0b3270] px-4 text-sm font-black text-white shadow-lg shadow-blue-950/25 transition hover:bg-[#154b91] focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 sm:right-6 md:bottom-6"
    >
      <ChevronUp size={18} aria-hidden="true" />
      Haut de page
    </button>
  );
}
