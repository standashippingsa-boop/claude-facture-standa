"use client";
/*
 * STANDA COMMERCIAL — Créer les Conduces en attente (workflow réel)
 * ══════════════════════════════════════════════════════════
 * ÉTAPE 1 (ici, dans STANDA) : coller les numéros de conduce → créés
 *   immédiatement "en attente" (vides). AUCUNE saisie manuelle de contenu.
 * ÉTAPE 2 (dans l'Extension, sur MCPACK) : l'utilisateur entre le numéro
 *   de conduce dans l'extension → elle lit les colis sur MCPACK → les
 *   envoie à /api/ingest-conduce → liés automatiquement à LA MÊME conduce
 *   (même numéro, créée à l'étape 1). AUCUNE intervention supplémentaire.
 *
 * RÈG: Package egziste yon sèl fwa (Single Source of Truth). Conduce pa
 * janm doublon (ensureConduce). Si w vle konplete yon conduce manyèlman
 * (san Extension), sa fèt depi paj Conduce a (/conduces/[id]).
 */
import { useState } from "react";
import Link from "next/link";
import { ClipboardList, ExternalLink, CheckCircle2, Clock } from "lucide-react";
import { createPendingConduces } from "@/lib/db";
import { useRole } from "@/lib/authx";

export default function ImportConduces({ onLinked }: { onLinked?: () => void }) {
  const { staff } = useRole();
  const staffName = staff ? `${staff.prenom ?? ""} ${staff.nom ?? ""}`.trim() || (staff.username ?? "") : "";

  const [numbersRaw, setNumbersRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: "ok" | "err"; s: string } | null>(null);
  const [results, setResults] = useState<{ number: string; id: string; alreadyExisted: boolean }[]>([]);

  const creer = async () => {
    const list = Array.from(new Set(
      numbersRaw.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)
    ));
    if (!list.length) { setMsg({ t: "err", s: "Aucun numéro de conduce détecté." }); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await createPendingConduces(list, staffName);
      setResults((prev) => [...r, ...prev]);
      setNumbersRaw("");
      const nouvelles = r.filter((x) => !x.alreadyExisted).length;
      setMsg({ t: "ok", s: `✔ ${nouvelles} conduce(s) créée(s), ${r.length - nouvelles} déjà existante(s).` });
      onLinked?.();
    } catch (e: any) {
      setMsg({ t: "err", s: "Erreur : " + (e?.message ?? String(e)) });
    } finally { setBusy(false); }
  };

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList size={18} className="text-navy" />
        <h2 className="h-sec">Créer des Conduces</h2>
      </div>
      <p className="text-sm text-mute">
        Collez les numéros de conduce reçus (un par ligne). Ils sont créés immédiatement
        <b> en attente</b>. Utilisez ensuite l&apos;<b>Extension Chrome sur MCPACK</b> pour
        chaque numéro — elle importera automatiquement les colis dans la conduce correspondante.
      </p>
      <textarea className="input !h-28 font-mono text-sm"
        placeholder={"10534\n10564\n10580\n10641"}
        value={numbersRaw} onChange={(e) => setNumbersRaw(e.target.value)} />
      <button className="btn btn-brand" onClick={creer} disabled={busy || !numbersRaw.trim()}>
        <CheckCircle2 size={15} /> Créer les conduces en attente
      </button>

      {msg && (
        <div className={`rounded-lg px-4 py-2.5 text-sm font-semibold flex items-center gap-2 ${
          msg.t === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {msg.t === "ok" ? <CheckCircle2 size={16} /> : null} {msg.s}
        </div>
      )}

      {results.length > 0 && (
        <div className="border-t border-line pt-3">
          <p className="text-xs font-bold text-mute mb-2">Conduces (cette session) :</p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {results.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-navy">{r.number}</span>
                  {r.alreadyExisted
                    ? <span className="pill pill-gray"><span className="pill-dot" />Déjà existante</span>
                    : <span className="pill pill-amber"><Clock size={11} className="mr-0.5" />En attente</span>}
                </div>
                <Link href={`/conduces/${r.id}`} className="inline-flex items-center gap-1 text-navy hover:underline text-xs font-semibold">
                  Ouvrir <ExternalLink size={12} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
