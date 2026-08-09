"use client";
/*
 * STANDA COMMERCIAL — File d'attente WhatsApp (bulk)
 * ══════════════════════════════════════════════════════════
 * ⚠️ WhatsApp PA gen API otomatik konfigire (sa ta mande yon kont
 * WhatsApp Business API peye + verifikasyon biznis). Sistèm nan itilize
 * lyen wa.me — li louvri chat la ak mesaj pre-ranpli, MOUN NAN peze Send.
 * Sa fè yon "bulk" pi rapid: yon lis kliyan, ak yon bouton pa kliyan,
 * pou pa gen pou chèche chak dosye kliyan apa.
 */
import { useEffect, useState } from "react";
import { X, MessageCircle, CheckCircle2 } from "lucide-react";
import { getClientsByCodes, logAction } from "@/lib/db";
import { openPackagesWhatsApp } from "@/lib/whatsapp";
import { Pkg, Client } from "@/lib/types";

export default function WhatsAppQueue({ pkgs, onClose }: { pkgs: Pkg[]; onClose: () => void }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [sent, setSent] = useState<Set<string>>(new Set());

  const byClient = new Map<string, Pkg[]>();
  pkgs.forEach((p) => {
    const arr = byClient.get(p.customer_code) ?? []; arr.push(p); byClient.set(p.customer_code, arr);
  });
  const codes = Array.from(byClient.keys());

  useEffect(() => {
    getClientsByCodes(codes).then(setClients).finally(() => setLoading(false));
    /* eslint-disable-next-line */
  }, []);

  const envoyer = (code: string) => {
    const c = clients.find((x) => x.customer_code === code);
    const list = byClient.get(code) ?? [];
    if (!c) return;
    openPackagesWhatsApp(c, list.map((p) => ({
      tracking_number: p.tracking_number, content: p.content, status: p.status
    })));
    setSent((prev) => new Set(prev).add(code));
    void logAction("Envoi WhatsApp", `${list.length} colis → ${c.fullname}`, "", code);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[80] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-lift">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div className="flex items-center gap-2">
            <MessageCircle size={18} className="text-emerald-600" />
            <h2 className="font-bold text-navy">File d&apos;attente WhatsApp</h2>
          </div>
          <button onClick={onClose} className="text-mute hover:text-ink"><X size={18} /></button>
        </div>

        <p className="text-xs text-mute px-5 pt-3">
          {codes.length} client(s) — cliquez « Ouvrir » pour chaque client : WhatsApp s&apos;ouvre avec
          un message prêt, il ne reste qu&apos;à appuyer sur Envoyer.
        </p>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {loading && <p className="text-sm text-mute">Chargement…</p>}
          {!loading && codes.map((code) => {
            const c = clients.find((x) => x.customer_code === code);
            const list = byClient.get(code) ?? [];
            const isSent = sent.has(code);
            return (
              <div key={code} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${
                isSent ? "border-emerald-200 bg-emerald-50/50" : "border-line"}`}>
                <div className="min-w-0">
                  <p className="font-semibold text-ink truncate">{c?.fullname ?? code}</p>
                  <p className="text-[11px] text-mute">{code} · {list.length} colis · {c?.whatsapp || c?.phone || "— pas de numéro —"}</p>
                </div>
                <button
                  className={`btn !py-1.5 !px-3 text-xs shrink-0 ${isSent ? "btn-ghost" : "!bg-emerald-600 hover:!bg-emerald-700"}`}
                  onClick={() => envoyer(code)} disabled={!c?.whatsapp && !c?.phone}>
                  {isSent ? <><CheckCircle2 size={13} /> Envoyé</> : <><MessageCircle size={13} /> Ouvrir</>}
                </button>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t border-line flex items-center justify-between">
          <span className="text-xs text-mute">{sent.size}/{codes.length} envoyés</span>
          <button className="btn btn-ghost" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
