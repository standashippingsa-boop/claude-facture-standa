"use client";
/*
 * STANDA COMMERCIAL — Import Conduces (Faz 2)
 * ══════════════════════════════════════════════════════════
 * Workflow SAN BOT (an sekirite):
 *   1. Kole nimewo conduce yo (youn pa liy)
 *   2. Pou chak, yon lyen dirèk MCPACK parèt (louvri manyèlman)
 *   3. Kopye kontni conduce a sou MCPACK, kole l isit
 *   4. Sistèm ekstrè kòd yo (WR / Tracking Number), match ak Package
 *      ki egziste deja (JANM kreye nouvo), montre verifikasyon
 *   5. Confirmer → lye Package yo ak Conduce a (conduce_id)
 *
 * RÈG: Package egziste yon sèl fwa (Single Source of Truth).
 */
import { useState } from "react";
import { ClipboardList, Link2, ExternalLink, CheckCircle2, X } from "lucide-react";
import {
  ensureConduce, matchConduceCodes, linkPackagesToConduce, getSettings, ConduceMatch
} from "@/lib/db";
import { extractAnyCodesFromText } from "@/lib/factureimport";
import { useRole } from "@/lib/authx";
import type { Conduce } from "@/lib/types";

type Step = "numbers" | "paste" | "review";

export default function ImportConduces({ onLinked }: { onLinked?: () => void }) {
  const { staff } = useRole();
  const staffName = staff ? `${staff.prenom ?? ""} ${staff.nom ?? ""}`.trim() || (staff.username ?? "") : "";

  const [step, setStep] = useState<Step>("numbers");
  const [numbersRaw, setNumbersRaw] = useState("");
  const [numbers, setNumbers] = useState<string[]>([]);
  const [urlTemplate, setUrlTemplate] = useState<string>("");
  const [current, setCurrent] = useState(0);          // index conduce k ap trete kounye a
  const [conduce, setConduce] = useState<Conduce | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [matches, setMatches] = useState<ConduceMatch[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: "ok" | "warn" | "err"; s: string } | null>(null);
  const [doneList, setDoneList] = useState<{ number: string; linked: number }[]>([]);

  // ---------- Etap 1: valide lis nimewo yo ----------
  const startImport = async () => {
    const list = Array.from(new Set(
      numbersRaw.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)
    ));
    if (!list.length) { setMsg({ t: "err", s: "Aucun numéro de conduce détecté." }); return; }
    setNumbers(list); setCurrent(0); setDoneList([]); setMsg(null);
    try {
      const s = await getSettings();
      setUrlTemplate(s.mcpack_conduce_url || "");
    } catch { /* opsyonèl */ }
    await openConduce(list[0]);
  };

  // ---------- Louvri (kreye si nesesè) yon Conduce ----------
  const openConduce = async (num: string) => {
    setBusy(true); setMsg(null);
    try {
      const c = await ensureConduce(num, "", staffName);
      setConduce(c); setPasteText(""); setMatches(null); setStep("paste");
    } catch (e: any) {
      setMsg({ t: "err", s: "Erreur : " + (e?.message ?? String(e)) });
    } finally { setBusy(false); }
  };

  const mcpackLink = (num: string) =>
    urlTemplate ? urlTemplate.replace("{num}", encodeURIComponent(num)) : "";

  // ---------- Etap 2: analize tèks kole a ----------
  const analyser = async () => {
    if (!conduce) return;
    const codes = extractAnyCodesFromText(pasteText);
    if (!codes.length) { setMsg({ t: "err", s: "Aucun code détecté dans le texte collé." }); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await matchConduceCodes(codes);
      setMatches(res); setStep("review");
    } catch (e: any) {
      setMsg({ t: "err", s: "Erreur analyse : " + (e?.message ?? String(e)) });
    } finally { setBusy(false); }
  };

  // ---------- Etap 3: confirme lyaj la ----------
  const confirmer = async () => {
    if (!conduce || !matches) return;
    setBusy(true);
    try {
      const r = await linkPackagesToConduce(conduce.id, conduce.conduce_number, matches, staffName);
      setDoneList((l) => [...l, { number: conduce.conduce_number, linked: r.linked }]);
      setMsg({ t: "ok", s: `✔ ${r.linked} colis liés à ${conduce.conduce_number}` +
        (r.alreadyElsewhere ? ` (${r.alreadyElsewhere} déjà dans une autre conduce, ignorés)` : "") });
      onLinked?.();
      // Pwochen conduce nan lis la, oswa fini
      const nextIdx = current + 1;
      if (nextIdx < numbers.length) {
        setCurrent(nextIdx);
        await openConduce(numbers[nextIdx]);
      } else {
        setStep("numbers"); setConduce(null); setMatches(null);
      }
    } catch (e: any) {
      setMsg({ t: "err", s: "Erreur liaison : " + (e?.message ?? String(e)) });
    } finally { setBusy(false); }
  };

  const skip = async () => {
    const nextIdx = current + 1;
    if (nextIdx < numbers.length) { setCurrent(nextIdx); await openConduce(numbers[nextIdx]); }
    else { setStep("numbers"); setConduce(null); setMatches(null); }
  };

  const matched = matches?.filter((m) => m.matched && !m.currentConduceId) ?? [];
  const elsewhere = matches?.filter((m) => m.matched && m.currentConduceId) ?? [];
  const notFound = matches?.filter((m) => !m.matched) ?? [];

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList size={18} className="text-navy" />
        <h2 className="h-sec">Importer des Conduces</h2>
      </div>

      {step === "numbers" && (
        <div className="space-y-3">
          <p className="text-sm text-mute">
            Collez les numéros de conduce (un par ligne). Pour chaque numéro, un lien MCPACK
            s&apos;affichera pour l&apos;ouvrir — collez ensuite son contenu pour lier les colis.
          </p>
          <textarea className="input !h-32 font-mono text-sm"
            placeholder={"10534\n10564\n10580\n10641"}
            value={numbersRaw} onChange={(e) => setNumbersRaw(e.target.value)} />
          <button className="btn btn-brand" onClick={startImport} disabled={busy || !numbersRaw.trim()}>
            <Link2 size={15} /> Importer
          </button>
          {doneList.length > 0 && (
            <div className="pt-2 border-t border-line">
              <p className="text-xs font-bold text-emerald-700 mb-1">Terminé cette session :</p>
              <div className="flex flex-wrap gap-1.5">
                {doneList.map((d, i) => (
                  <span key={i} className="text-[11px] bg-emerald-50 text-emerald-700 rounded px-2 py-0.5">
                    {d.number} ({d.linked})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {(step === "paste" || step === "review") && conduce && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2 bg-mist rounded-lg px-3 py-2">
            <div className="text-sm">
              <span className="font-bold text-navy">Conduce {conduce.conduce_number}</span>
              <span className="text-mute"> — {current + 1}/{numbers.length}</span>
            </div>
            {mcpackLink(conduce.conduce_number) ? (
              <a href={mcpackLink(conduce.conduce_number)} target="_blank" rel="noreferrer"
                className="btn btn-ghost !py-1.5 !text-xs">
                <ExternalLink size={13} /> Ouvrir sur MCPACK
              </a>
            ) : (
              <span className="text-[11px] text-mute">
                Configurez le lien MCPACK dans Réglages pour l&apos;ouverture directe.
              </span>
            )}
          </div>

          {step === "paste" && (
            <>
              <p className="text-xs text-mute">
                Collez ici le contenu de la conduce {conduce.conduce_number} (liste des colis) :
              </p>
              <textarea className="input !h-40 font-mono text-[11px]"
                placeholder="Collez le texte de la conduce (même désordonné)…"
                value={pasteText} onChange={(e) => setPasteText(e.target.value)} />
              <div className="flex gap-2">
                <button className="btn btn-brand" onClick={analyser} disabled={busy || !pasteText.trim()}>
                  <CheckCircle2 size={15} /> Analyser
                </button>
                <button className="btn btn-ghost" onClick={skip} disabled={busy}>Passer cette conduce</button>
              </div>
            </>
          )}

          {step === "review" && matches && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="pill pill-green"><span className="pill-dot" />{matched.length} à lier</span>
                <span className="pill pill-gray"><span className="pill-dot" />{elsewhere.length} dans une autre conduce</span>
                <span className="pill pill-red"><span className="pill-dot" />{notFound.length} introuvables</span>
              </div>

              {matched.length > 0 && (
                <div className="card overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead><tr>
                      {["Code", "Tracking ID", "Client", "Statut"].map((h) => <th key={h} className="thc">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {matched.map((m, i) => (
                        <tr key={i} className={i % 2 ? "bg-mist" : ""}>
                          <td className="tdc font-mono text-red-800 font-bold">{m.code}</td>
                          <td className="tdc font-mono text-[11px]">{m.guia}</td>
                          <td className="tdc"><span className="font-bold text-navy">{m.customerCode}</span> — {m.customerName}</td>
                          <td className="tdc">{m.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {notFound.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-red-700 mb-1">Introuvables ({notFound.length}) :</p>
                  <div className="flex flex-wrap gap-1.5">
                    {notFound.map((m, i) => (
                      <span key={i} className="font-mono text-[11px] bg-red-50 text-red-700 rounded px-2 py-0.5">{m.code}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 border-t border-line pt-3">
                <button className="btn btn-brand" onClick={confirmer} disabled={busy || !matched.length}>
                  <CheckCircle2 size={15} /> Confirmer la liaison ({matched.length})
                </button>
                <button className="btn btn-ghost" onClick={() => setStep("paste")} disabled={busy}>Retour</button>
                <button className="btn btn-ghost" onClick={skip} disabled={busy}>Passer</button>
              </div>
            </div>
          )}
        </div>
      )}

      {msg && (
        <div className={`rounded-lg px-4 py-2.5 text-sm font-semibold flex items-center gap-2 ${
          msg.t === "ok" ? "bg-emerald-50 text-emerald-700" :
          msg.t === "warn" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
          {msg.t === "ok" ? <CheckCircle2 size={16} /> : <X size={16} />} {msg.s}
        </div>
      )}
    </div>
  );
}
