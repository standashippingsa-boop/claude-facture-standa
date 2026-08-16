"use client";
/*
 * STANDA COMMERCIAL — Barre de sélection GLOBALE
 * ══════════════════════════════════════════════
 * Parèt otomatikman depi gen koli seleksyone, sou TOUT paj admin/employé.
 * • Montre kantite + lis (tracking, kliyan, poids, statut)
 * • Retire yon sèl koli, oswa vide tout seleksyon an
 * • Rakoursi "Facturer" lè tout koli yo se menm kliyan
 * Responsive: bar konpak anba ekran an (mobil ak desktop).
 */
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CheckSquare, X, Trash2, ChevronUp, ChevronDown, FileText } from "lucide-react";
import { usePackageSelection } from "@/lib/selection";

/** Paj kliyan yo pa gen bar sa a (li se yon zouti admin/employé). */
const HIDDEN = ["/login", "/admin-login", "/inscription", "/espace-client", "/reset-password", "/nouveau-mot-de-passe"];

export default function SelectionBar() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const sel = usePackageSelection();
  const [open, setOpen] = useState(false);

  if (sel.count === 0) return null;
  if (HIDDEN.some((h) => pathname.startsWith(h))) return null;

  const snaps = sel.snapshots;
  const clients = Array.from(new Set(snaps.map((s) => s.customer_code).filter(Boolean)));
  const poids = snaps.reduce((t, s) => t + (Number(s.weight) || 0), 0);
  const uniqueClient = clients.length === 1 ? String(clients[0]) : null;

  const viderTout = () => {
    if (sel.count >= 5 && !confirm(`Vider la sélection de ${sel.count} colis ?`)) return;
    sel.clear(); setOpen(false);
  };

  const facturer = () => {
    if (!uniqueClient) return;
    setOpen(false);
    router.push(`/clients/${encodeURIComponent(uniqueClient)}`);
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-[70] pointer-events-none">
      <div className="mx-auto max-w-4xl p-3 pointer-events-auto">

        {/* Lis detay (deplyab) */}
        {open && (
          <div className="card shadow-lift mb-2 max-h-64 overflow-y-auto">
            <div className="px-3 py-2 border-b border-line flex items-center justify-between sticky top-0 bg-white">
              <span className="text-xs font-bold text-mute uppercase tracking-wide">Colis sélectionnés</span>
              <button onClick={() => setOpen(false)} className="text-mute hover:text-ink"><X size={15} /></button>
            </div>
            <div className="divide-y divide-line">
              {snaps.map((s) => (
                <div key={s.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[11px] text-ink truncate">{s.tracking_number ?? s.id.slice(0, 8)}</p>
                    <p className="text-mute text-[10px] truncate">
                      {s.customer_code ? `${s.customer_code} · ` : ""}{s.customer_name ?? ""}
                      {s.weight ? ` · ${s.weight} lb` : ""}{s.status ? ` · ${s.status}` : ""}
                    </p>
                  </div>
                  <button onClick={() => sel.remove(s.id)}
                    className="text-slate-400 hover:text-red-600 shrink-0" title="Retirer de la sélection">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bar konpak */}
        <div className="card shadow-lift px-3 py-2.5 flex items-center gap-2.5 flex-wrap">
          <span className="inline-flex items-center gap-1.5 font-bold text-navy text-sm shrink-0">
            <CheckSquare size={16} /> {sel.count} colis
          </span>
          <span className="text-[11px] text-mute hidden sm:inline">
            {poids > 0 ? `${poids.toFixed(1)} lb · ` : ""}
            {clients.length === 1 ? clients[0] : `${clients.length} clients`}
          </span>

          <div className="flex-1" />

          <button className="btn btn-ghost !py-1.5 !px-2.5 !text-xs border border-line"
            onClick={() => setOpen((v) => !v)}>
            {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />} Détails
          </button>
          {uniqueClient && (
            <button className="btn !py-1.5 !px-3 !text-xs" onClick={facturer} title="Ouvrir le dossier client pour facturer">
              <FileText size={14} /> Facturer
            </button>
          )}
          <button className="btn btn-ghost !py-1.5 !px-2.5 !text-xs border border-line text-red-600"
            onClick={viderTout} title="Vider la sélection">
            <Trash2 size={14} /> Vider
          </button>
        </div>
      </div>
    </div>
  );
}
