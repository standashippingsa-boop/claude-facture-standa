"use client";
/*
 * ASSISTANT DE CALCUL (tableau de bord admin)
 * Les montants viennent du serveur, déjà calculés ; l'IA les explique.
 */
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export type McpackFacts = {
  rate: number;
  lotLbs: { standa: number; dokasav: number; blic: number };
  nextLotLbs: { standa: number; dokasav: number; blic: number };
  lotInvoiced: boolean;
  printedLbs: number | null;
  printedUsd: number | null;
  conduceCount: number;
  ergensReceived: boolean;
};

const QUICK = [
  "Konbyen m dwe peye MCPACK pou lot sa a ?",
  "Konbyen Ergens dwe remèt mwen ?",
  "Èske kalkil mwen an menm ak fakti MCPACK la ?",
  "Konbyen kòb kliyan yo dwe m toujou ?",
];

export default function AdminCalcAssistant({ mcpack }: { mcpack: McpackFacts | null }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [facts, setFacts] = useState<string | null>(null);
  const [showFacts, setShowFacts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async (q: string) => {
    const text = q.trim();
    if (text.length < 2 || busy) return;
    setQuestion(text); setBusy(true); setError(null); setAnswer(null); setShowFacts(false);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/admin-assistant", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: data.session?.access_token ?? "", question: text, mcpack }),
      });
      const j = await res.json().catch(() => ({ ok: false, reason: "Réponse illisible." }));
      if (!j.ok) throw new Error(j.reason || "Assistant indisponible.");
      setAnswer(j.answer); setFacts(j.facts ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assistant indisponible.");
    } finally { setBusy(false); }
  };

  return (
    <section className="card p-4" aria-label="Assistant de calcul">
      <h2 className="text-sm font-bold text-navy">Asistan kalkil</h2>
      <p className="mt-0.5 text-xs text-slate-500">Poze yon kesyon sou MCPACK, Ergens, kòb kliyan yo dwe oswa koli yo. Kalkil yo fèt pa sistèm nan, asistan an eksplike yo.</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {QUICK.map((q) => (
          <button key={q} type="button" disabled={busy} onClick={() => void ask(q)}
            className="rounded-full border border-line bg-mist px-3 py-1 text-[12px] text-navy transition hover:border-navy/40 disabled:opacity-50">{q}</button>
        ))}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void ask(question); }}>
        <input className="input flex-1" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ekri kesyon ou la…" maxLength={600} />
        <button type="submit" className="btn" disabled={busy || question.trim().length < 2}>{busy ? "Kalkil…" : "Mande"}</button>
      </form>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {answer && (
        <div className="mt-3 rounded-xl bg-navy/5 px-4 py-3">
          <p className="whitespace-pre-line text-[14px] leading-relaxed text-navy">{answer}</p>
          {facts && facts !== answer && (
            <button type="button" className="mt-2 text-xs font-semibold text-navy underline" onClick={() => setShowFacts((v) => !v)}>
              {showFacts ? "Kache chif yo" : "Wè chif sistèm nan itilize"}
            </button>
          )}
          {showFacts && facts && <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-3 text-[11.5px] leading-relaxed text-slate-600">{facts}</pre>}
        </div>
      )}
    </section>
  );
}
