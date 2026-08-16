/*
 * STANDA COMMERCIAL — Validasyon fichye telechaje
 * ═══════════════════════════════════════════════
 * `accept="image/*"` se UX SÈLMAN — li pa yon sekirite: nenpòt moun ka
 * chanje non yon fichye oswa pase l via DevTools. Isit la nou verifye
 * vrèman: tip MIME, ekstansyon, gwosè, epi nou netwaye non fichye a.
 *
 * Objektif: anpeche fichye danjere oswa twò gwo antre nan Storage.
 */

export type UploadKind = "image" | "pdf" | "image-or-pdf" | "spreadsheet";

interface Rule { mimes: string[]; exts: string[]; maxMb: number; label: string }

const RULES: Record<UploadKind, Rule> = {
  image: {
    mimes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"],
    exts: ["jpg", "jpeg", "png", "webp", "heic", "heif"],
    maxMb: 12, label: "une image (JPG, PNG, WEBP, HEIC)",
  },
  pdf: {
    mimes: ["application/pdf"], exts: ["pdf"],
    maxMb: 25, label: "un fichier PDF",
  },
  "image-or-pdf": {
    mimes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"],
    exts: ["jpg", "jpeg", "png", "webp", "heic", "heif", "pdf"],
    maxMb: 25, label: "une image ou un PDF",
  },
  spreadsheet: {
    mimes: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel", "application/octet-stream", "",
    ],
    exts: ["xlsx", "xls"],
    maxMb: 20, label: "un fichier Excel (XLSX, XLS)",
  },
};

/** Non fichye san danje: pa gen chemen, pa gen karaktè espesyal. */
export function safeFileName(name: string): string {
  const base = String(name ?? "fichier").split(/[\\/]/).pop() ?? "fichier";
  const cleaned = base
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // aksan
    .replace(/[^\w.\-]/g, "_")                          // sèlman lèt/chif/._-
    .replace(/_{2,}/g, "_")
    .replace(/^\.+/, "")                                // pa gen fichye kache
    .slice(0, 80);
  return cleaned || "fichier";
}

export interface UploadCheck { ok: boolean; reason?: string; filename: string }

/** Verifye yon fichye anvan telechajman. */
export function validateUpload(file: File, kind: UploadKind): UploadCheck {
  const r = RULES[kind];
  const filename = safeFileName((file as any)?.name ?? "fichier");

  if (!file || typeof (file as any).size !== "number") {
    return { ok: false, reason: "Fichier invalide.", filename };
  }
  if (file.size <= 0) {
    return { ok: false, reason: "Le fichier est vide.", filename };
  }
  if (file.size > r.maxMb * 1024 * 1024) {
    return { ok: false, reason: `Fichier trop volumineux (max ${r.maxMb} Mo).`, filename };
  }

  const ext = (filename.split(".").pop() ?? "").toLowerCase();
  const mime = String((file as any).type ?? "").toLowerCase();

  const extOk = r.exts.includes(ext);
  // Kèk navigatè/telefòn pa bay MIME (vid) — nan ka sa a ekstansyon an desizif
  const mimeOk = !mime ? extOk : r.mimes.includes(mime);

  if (!extOk || !mimeOk) {
    return { ok: false, reason: `Format non accepté. Choisissez ${r.label}.`, filename };
  }
  return { ok: true, filename };
}

/** Chemen inik epi san danje pou Storage. */
export function storagePath(filename: string, prefix = ""): string {
  const safe = safeFileName(filename);
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}${stamp}_${rand}_${safe}`;
}
