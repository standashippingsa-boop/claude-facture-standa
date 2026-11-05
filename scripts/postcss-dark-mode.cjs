/**
 * STANDA — MODE SOMBRE AUTOMATIQUE (plugin PostCSS, à la compilation).
 * ════════════════════════════════════════════════════════════════════
 * Le système contient des milliers de couleurs écrites directement dans les
 * classes (bg-white, text-navy, #eef2f8…). Plutôt que de modifier chaque écran,
 * ce plugin lit TOUT le CSS produit (Tailwind + globals.css) et ajoute, pour
 * chaque couleur, sa version sombre sous `html.dark` :
 *   • fonds clairs   → bleu nuit (la teinte est gardée pour les fonds colorés) ;
 *   • textes foncés  → textes clairs ;
 *   • bordures claires → bordures sombres discrètes ;
 *   • couleurs de marque (bleu marine, orange, vert…) et textes clairs : inchangés.
 * Les règles sombres sont dans `@media not print` : tickets, factures et PDF
 * s'impriment toujours en clair.
 * Activation : classe `dark` sur <html> (script dans app/layout.tsx : réglage du
 * téléphone par défaut, ou choix « Clair / Sombre » de la personne).
 */
const BG_PROPS = new Set(["background", "background-color", "background-image", "--tw-gradient-from", "--tw-gradient-to", "--tw-gradient-stops", "--tw-gradient-via", "--tw-ring-offset-color"]);
const TEXT_PROPS = new Set(["color", "fill", "stroke", "caret-color", "text-decoration-color", "-webkit-text-fill-color"]);
const BORDER_PROPS = new Set(["border-color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color", "border", "border-top", "border-bottom", "border-left", "border-right", "outline-color", "--tw-ring-color", "column-rule-color"]);

const NAMED = { white: [255, 255, 255], black: [0, 0, 0] };
const COLOR_RE = /rgba?\(([^()]*(?:\([^()]*\))?[^()]*)\)|#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|(?<![\w-])(white|black)(?![\w-])/g;

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/** Nouvelle couleur sombre, ou null si la couleur reste telle quelle. */
function mapColor(rgb, kind) {
  const [h, s, l] = rgbToHsl(...rgb);
  const neutral = s < 0.08;
  if (kind === "bg") {
    if (l < 0.6) return null;                                   // fonds de marque et fonds déjà sombres
    return hslToRgb(neutral ? 219 : h, neutral ? 0.34 : Math.min(s, 0.6) * 0.55, 0.075 + (1 - l) * 0.45);
  }
  if (kind === "border") {
    if (l < 0.6) return null;
    return hslToRgb(neutral ? 219 : h, neutral ? 0.25 : Math.min(s, 0.6) * 0.45, 0.19 + (1 - l) * 0.3);
  }
  // texte
  if (l < 0.42) return hslToRgb(neutral ? 219 : h, neutral ? 0.12 : Math.min(s, 0.5), 0.97 - l * 0.25);
  if (l < 0.6 && s < 0.35) return hslToRgb(h, s, Math.min(0.86, l + 0.26));  // gris moyens nettement plus clairs
  return null;
}

function parseColor(match) {
  if (match[3]) return { rgb: NAMED[match[3]], alpha: null, fn: false };
  if (match[2]) {
    let hex = match[2];
    if (hex.length <= 4) hex = hex.split("").map((c) => c + c).join("");
    const rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const alpha = hex.length === 8 ? (parseInt(hex.slice(6, 8), 16) / 255).toFixed(3) : null;
    return { rgb, alpha, fn: false };
  }
  const inner = match[1];
  const [colorPart, alphaPart] = inner.includes("/") ? inner.split("/") : (() => { const p = inner.split(","); return p.length === 4 ? [p.slice(0, 3).join(" "), p[3]] : [inner, null]; })();
  const nums = colorPart.split(/[\s,]+/).filter(Boolean).map(Number);
  if (nums.length < 3 || nums.some((n) => Number.isNaN(n))) return null;
  return { rgb: nums.slice(0, 3), alpha: alphaPart ? alphaPart.trim() : null, fn: true };
}

function transformValue(value, kind) {
  let changed = false;
  const out = value.replace(COLOR_RE, (...m) => {
    const parsed = parseColor(m);
    if (!parsed) return m[0];
    const next = mapColor(parsed.rgb, kind);
    if (!next) return m[0];
    changed = true;
    let alpha = parsed.alpha;
    // Textes pâles (text-navy/40, /50…) : sur fond sombre la transparence les rend
    // illisibles. On garde un léger écart entre eux mais ils restent bien blancs.
    if (kind === "text" && alpha !== null && /^\s*[\d.]+%?\s*$/.test(alpha)) {
      const a = alpha.includes("%") ? parseFloat(alpha) / 100 : parseFloat(alpha);
      if (a > 0 && a < 1) alpha = (0.78 + a * 0.22).toFixed(3);
    }
    return alpha !== null ? `rgb(${next.join(" ")} / ${alpha})` : `rgb(${next.join(" ")})`;
  });
  return changed ? out : null;
}

function kindOf(prop) {
  if (BG_PROPS.has(prop)) return "bg";
  if (TEXT_PROPS.has(prop)) return "text";
  if (BORDER_PROPS.has(prop)) return "border";
  return null;
}

function darkSelector(sel) {
  const s = sel.trim();
  if (s.startsWith("html.dark") || s.includes(".dark ")) return null;
  if (s === ":root" || s === "html") return "html.dark";
  if (s.startsWith("html")) return "html.dark" + s.slice(4);
  if (s.startsWith(":root")) return "html.dark" + s.slice(5);
  return "html.dark " + s;
}

module.exports = () => ({
  postcssPlugin: "standa-dark-mode",
  OnceExit(root, { AtRule }) {
    const pending = [];
    root.walkRules((rule) => {
      const parentName = rule.parent && rule.parent.type === "atrule" ? rule.parent.name : "";
      if (/keyframes$/.test(parentName) || parentName === "font-face") return;
      if (rule.parent && rule.parent.type === "atrule" && rule.parent.params && /\bprint\b/.test(rule.parent.params) && !/not print/.test(rule.parent.params)) return;
      const decls = [];
      rule.each((node) => {
        if (node.type !== "decl") return;
        const kind = kindOf(node.prop);
        if (!kind) return;
        const v = transformValue(node.value, kind);
        if (v) decls.push({ prop: node.prop, value: v, important: node.important });
      });
      if (!decls.length) return;
      const selectors = rule.selectors.map(darkSelector).filter(Boolean);
      if (!selectors.length) return;
      const clone = rule.clone({ selectors, nodes: [] });
      for (const d of decls) clone.append({ prop: d.prop, value: d.value, important: d.important });
      pending.push({ rule, clone });
    });
    for (const { rule, clone } of pending) {
      const media = new AtRule({ name: "media", params: "not print" });
      media.append(clone);
      rule.after(media);
    }
    // Contrôles natifs (champs, barres de défilement) et logo principal plus lumineux sur fond sombre.
    root.append(`@media not print {
html.dark { color-scheme: dark; }
html.dark img[src="/logo.png"]:not(.invert), html.dark img[src$="/logo.png"]:not(.invert) { filter: brightness(1.75) saturate(1.15); }
}`);
  }
});
module.exports.postcss = true;
