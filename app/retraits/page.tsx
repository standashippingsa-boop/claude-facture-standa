"use client";
import { useEffect, useState } from "react";
import { Inbox } from "lucide-react";
import { getRetraits, setRetraitStatus } from "@/lib/db";
import { Retrait, RetraitStatus } from "@/lib/types";
import { dateFr } from "@/lib/utils";

const STATUTS: RetraitStatus[] = ["En attente", "Préparé", "Remis"];
const BADGE: Record<RetraitStatus, string> = {
  "En attente": "bg-amber-100 text-amber-700",
  "Préparé": "bg-blue-100 text-blue-700",
  "Remis": "bg-emerald-100 text-emerald-700"
};

export default function RetraitsPage() {
  const [retraits, setRetraits] = useState<Retrait[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [filtre, setFiltre] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const load = () => getRetraits().then(setRetraits).catch((e) => setNotice("Erè: " + e.message));
  useEffect(() => { load(); }, []);

  const changer = async (r: Retrait, status: RetraitStatus) => {
    try {
      await setRetraitStatus(r.id, status);
      setRetraits((prev) => prev.map((x) => (x.id === r.id ? { ...x, status } : x)));
      setNotice(`Demande ${r.customer_code} → ${status}. Kliyan an wè estati sa a sou kont li.`);
    } catch (e: any) { setNotice("Erè: " + e.message); }
  };

  const list = filtre ? retraits.filter((r) => r.status === filtre) : retraits;
  const enAttente = retraits.filter((r) => r.status === "En attente").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-extrabold text-navy flex items-center gap-2">
          <Inbox size={20} /> Demandes de retrait
          {enAttente > 0 && (
            <span className="badge bg-amber-100 text-amber-700">{enAttente} en attente</span>
          )}
        </h1>
        <select className="input w-44" value={filtre} onChange={(e) => setFiltre(e.target.value)}>
          <option value="">Tous statuts</option>
          {STATUTS.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      <p className="text-xs text-slate-500">
        Kliyan yo notifye davans ki koli yo pral vin pran — prepare yo, epi mete estati a ajou
        (kliyan an wè li sou kont li). Fonksyon sa a pa chanje statut koli yo.
      </p>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr>
            {["Date", "Code Client", "Nom", "Ville", "Colis", "Poids total (lb)", "Statut", "Aksyon"]
              .map((h) => <th key={h} className="th">{h}</th>)}
          </tr></thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-10 text-slate-400">
                Poko gen demande de retrait.
              </td></tr>
            ) : list.map((r, i) => (
              <RetraitRow key={r.id} r={r} zebra={i % 2 === 1} open={open === r.id}
                onToggle={() => setOpen(open === r.id ? null : r.id)}
                onStatus={(s) => changer(r, s)} />
            ))}
          </tbody>
        </table>
      </div>

      {notice && <p className="card px-4 py-3 text-sm text-navy">{notice}</p>}
    </div>
  );
}

function RetraitRow({ r, zebra, open, onToggle, onStatus }: {
  r: Retrait; zebra: boolean; open: boolean;
  onToggle: () => void; onStatus: (s: RetraitStatus) => void;
}) {
  return (
    <>
      <tr onClick={onToggle} className={`cursor-pointer hover:bg-blue-50 ${zebra ? "bg-mist" : ""}`}>
        <td className="td whitespace-nowrap">{dateFr(r.created_at)}</td>
        <td className="td font-bold text-navy">{r.customer_code}</td>
        <td className="td">{r.customer_name}</td>
        <td className="td">{r.ville || "—"}</td>
        <td className="td text-right">{r.package_count}</td>
        <td className="td text-right">{Number(r.total_weight).toFixed(2)}</td>
        <td className="td"><span className={`badge ${BADGE[r.status]}`}>{r.status}</span></td>
        <td className="td whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          {STATUTS.filter((s) => s !== r.status).map((s) => (
            <button key={s} onClick={() => onStatus(s)}
              className="text-navy hover:underline text-xs font-semibold mr-3">
              → {s}
            </button>
          ))}
        </td>
      </tr>
      {open && (
        <tr className="bg-blue-50/50">
          <td colSpan={8} className="px-8 py-3">
            <table className="w-full text-xs">
              <thead><tr className="text-slate-500 text-left">
                <th className="py-1 pr-3">Tracking ID (Guía)</th>
                <th className="py-1 pr-3">Tracking Number</th>
                <th className="py-1 pr-3">Contenu</th>
                <th className="py-1 text-right">Poids (lb)</th>
              </tr></thead>
              <tbody>
                {(r.items ?? []).map((it) => (
                  <tr key={it.id} className="border-t border-line/60">
                    <td className="py-1 pr-3 font-mono">{it.tracking_number}</td>
                    <td className="py-1 pr-3 font-mono">{it.tracking_manual || "—"}</td>
                    <td className="py-1 pr-3">{it.content || "—"}</td>
                    <td className="py-1 text-right">{Number(it.weight).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}
