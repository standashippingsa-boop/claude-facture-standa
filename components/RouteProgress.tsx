"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import NProgress from "nprogress";

/**
 * Ti bann zoranj anwo ekran an lè yon paj ap chaje (navigasyon entèn).
 * Li kòmanse lè w klike yon lyen entèn epi li fini lè chemen an chanje.
 * Pa gen okenn done: se sèlman yon endikatè vizyèl.
 */
export default function RouteProgress() {
  const pathname = usePathname();

  useEffect(() => {
    NProgress.configure({ showSpinner: false, trickleSpeed: 140, minimum: 0.12 });
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest?.("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href") ?? "";
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      let url: URL;
      try { url = new URL(anchor.href, window.location.href); } catch { return; }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      NProgress.start();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Le chemin a chanje = paj la rive : nou fini bann nan.
  useEffect(() => { NProgress.done(); }, [pathname]);

  return null;
}
