"use client";
/*
 * STANDA COMMERCIAL — Compléter une Conduce manuellement (fallback)
 * ══════════════════════════════════════════════════════════
 * Sekondè: si ou pa itilize Extension Chrome pou yon Conduce, ou ka kole
 * kontni li manyèlman isit la. Sistèm match ak Package ki egziste deja
 * (JANM kreye nouvo), montre verifikasyon, epi lye sou konfimasyon.
 */
import { useState } from "react";
import { ClipboardList, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { matchConduceCodes, linkPackagesToConduce, ConduceMatch } from "@/lib/db";
import { extractAnyCodesFromText } from "@/lib/factureimport";
import { useRole } from "@/lib/authx";

export default function ConduceManualPaste({
  conduceId, conduceNumber, onLinked,
}: { conduceId: string; conduceNumber: string; onLinked?: () => void }) {
  const { staff } = useRole();
  const staffName = staff ? `${staff.prenom ?? ""} ${staff.nom ?? ""}`.trim() || (staff.username ?? "") : "";

  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [matches, setMatches] = useState<ConduceMatch[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: "ok" | "err"; s: string } | null>(null);

  const analyser = async () => {
    const codes = extractAnyCodesFromText(text);
    if (!codes.length) { setMsg({ t: "err", s: "Aucun code détecté dans le texte collé." }); return; }
    setBusy(true); setMsg(null);
    try {
      setMatches(await matchConduceCodes(codes));
    } catch (e: any) {
      setMsg({ t: "err", s: "Erreur analyse : " + (e?.message ?? String(e)) });
    } finally { setBusy(false); }
  };

  const confirmer = async () => {
    if (!matches) return;
    setBusy(true);
    try {
      const r = await linkPackagesToConduce(conduceId, conduceNumber, matches, staffName);
      setMsg({ t: "ok", s: `✔ ${r.linked} colis liés` +
        (r.alreadyElsewhere ? ` (${r.alreadyElsewhere} déjà dans une autre conduce, ignorés)` : "") });
      setMatches(null); setText("");
      onLinked?.();
    } catch (e: any) {
      setMsg({ t: "err", s: "Erreur liaison : " + (e?.message ?? String(e)) });
    } finally { setBusy(false); }
  };

  const matched = matches?.filter((m) => m.matched && !m.currentConduceId) ?? [];
  const elsewhere = matches?.filter((m) => m.matched && m.currentConduceId) ?? [];
  const notFound = matches?.filter((m) => !m.matched) ?? [];

  return (
    <div className="card p-4">
      <button className="flex items-center justify-between w-full text-left" onClick={() => setOpen((v) => !v)}>
        <span className="flex items-center gap-2 text-sm font-semibold text-navy">
          <ClipboardList size={15} /> Compléter manuellement (sans Extension)
        </span>
        {open ? <ChevronUp size={15} className="text-mute" /> : <ChevronDown size={15} className="text-mute" />}
      </button>

      {open && (
        <div className="space-y-3 mt-3 pt-3 border-t border-line">
          <p className="text-xs text-mute">
            Collez ici le contenu de la conduce {conduceNumber} copié depuis MCPACK (utile si vous
            n&apos;utilisez pas encore l&apos;Extension pour celle-ci).
          </p>
          <textarea className="input !h-32 font-mono text-[11px]"
            placeholder="Collez le texte de la conduce (même désordonné)…"
            value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={analyser} disabled={busy || !text.trim()}>
              <CheckCircle2 size={15} /> Analyser
            </button>
          </div>

          {matches && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="pill pill-green"><span className="pill-dot" />{matched.length} à lier</span>
                <span className="pill pill-gray"><span className="pill-dot" />{elsewhere.length} dans une autre conduce</span>
                <span className="pill pill-red"><span className="pill-dot" />{notFound.length} introuvables</span>
              </div>
              {matched.length > 0 && (
                <button className="btn btn-brand" onClick={confirmer} disabled={busy}>
                  <CheckCircle2 size={15} /> Confirmer la liaison ({matched.length})
                </button>
              )}
            </div>
          )}

          {msg && (
            <div className={`rounded-lg px-3 py-2 text-xs font-semibold ${
              msg.t === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              {msg.s}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
