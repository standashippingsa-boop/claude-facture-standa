"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { createInvoiceFromComputation, getSmallParcelConfig, getUsdRate, saveInvoicePdfUrl } from "@/lib/db";
import { computeInvoice, InvoiceComputation, verifyTotal } from "@/lib/invoice-engine";
import { TAX_THRESHOLD_LB } from "@/lib/pricing";
import { generateUploadDownload } from "@/lib/pdf";
import { sendInvoicePdfWhatsApp } from "@/lib/whatsapp";
import { Client, Pkg } from "@/lib/types";
import { htg, usd } from "@/lib/utils";

/**
 * FENÊTRE DE FACTURATION — CONFIGURATION UNIQUE (STANDA COMMERCIAL)
 * ════════════════════════════════════════════════════════════════
 * Konpozan sa a se SÈL sous verite pou jenerasyon fakti nan tout aplikasyon an:
 * Packages, Fiche Client, ak nenpòt paj fiti. Menm workflow, menm moteur
 * (computeInvoice), menm validasyon (verifyTotal), menm PDF/WhatsApp.
 *
 * Workflow obligatwa (menm tout kote):
 *   1) Ouvri fenèt konfigirasyon
 *   2) Mande: Taxe Fixe / Frais DGA / Discount / Mode de calcul
 *   3) Montre apèsi konplè
 *   4-5) Admin verifye epi konfime
 *   6) Jenere PDF
 *   7) Anrejistre fakti a
 *
 * TAXE FIKS (V13) — SE ADMIN KI METE TAKS YO:
 *   Lè pwa total la rive {TAX_THRESHOLD_LB} lb, fenèt la PWOPOZE taks la
 *   otomatikman (kaz la koche, montan an pre-ranpli). Admin an rete mèt:
 *   li ka chanje montan an oswa dekoche l. Motè a pa ajoute anyen an kachèt.
 *
 * KONT BUSINESS (V13):
 *   Pwa yo adisyone ANVAN, apre sa miltipliye yon sèl fwa pa Prix/LB Business.
 *   Chwa "mode de calcul" la pa aplike sou Business (li kache).
 *
 * Itilizasyon:
 *   <InvoiceDialog client={client} pkgs={selected} footer={footer}
 *     onClose={() => ...} onDone={(msg) => ...} />
 */
export default function InvoiceDialog({
  client, pkgs, footer, onClose, onDone
}: {
  client: Client;
  pkgs: Pkg[];
  footer: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [rate, setRate] = useState(0);
  const [smallCfg, setSmallCfg] = useState({ min: 0.1, max: 0.99, price: 3.7 });
  const [ready, setReady] = useState(false);

  const [useTaxe, setUseTaxe] = useState(false);
  const [taxeVal, setTaxeVal] = useState("");
  const [useDga, setUseDga] = useState(false);
  const [fraisDga, setFraisDga] = useState("");
  const [useDisc, setUseDisc] = useState(false);
  const [discount, setDiscount] = useState("");
  const [calcMode, setCalcMode] = useState<"addition" | "small_control">("addition");
  /** true depi admin an manyen kaz/montan taks la — nou sispann pwopoze. */
  const [taxeTouched, setTaxeTouched] = useState(false);

  const [comp, setComp] = useState<InvoiceComputation | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Chaje to + konfigirasyon ti koli (Paramètres)
  useEffect(() => {
    (async () => {
      const [r, cfg] = await Promise.all([getUsdRate(), getSmallParcelConfig()]);
      setRate(r); setSmallCfg(cfg); setReady(true);
    })();
  }, []);

  // Rekalkile ak MOTEUR FINANCIER chak fwa yon opsyon chanje
  useEffect(() => {
    if (!ready || !pkgs.length) { setComp(null); return; }
    setComp(computeInvoice({
      client, pkgs, rate, smallCfg, mode: calcMode,
      taxeFixe: useTaxe ? Number(taxeVal) || 0 : 0,
      fraisDga: useDga ? Number(fraisDga) || 0 : 0,
      discount: useDisc ? Number(discount) || 0 : 0
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, rate, calcMode, useTaxe, taxeVal, useDga, fraisDga, useDisc, discount]);

  /**
   * PWOPOZISYON TAKS — lè pwa total la rive nan sèy la, nou koche kaz la epi
   * nou pre-ranpli montan an YON SÈL FWA. Depi admin an manyen l, nou pa
   * touche l ankò: se li ki mèt taks yo.
   */
  useEffect(() => {
    if (!comp?.ok || taxeTouched) return;
    if (comp.taxThresholdReached && comp.fixedTaxSuggested > 0) {
      setUseTaxe(true);
      setTaxeVal(String(comp.fixedTaxSuggested));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comp?.taxThresholdReached, comp?.fixedTaxSuggested, comp?.ok, taxeTouched]);

  const generer = async () => {
    if (!comp) return;
    if (!comp.ok) { setErr(comp.errors.join(" ")); return; }
    if (!verifyTotal(comp)) { setErr("Erreur de calcul détectée. Facture bloquée."); return; }
    setBusy(true); setErr(null);
    try {
      const inv = await createInvoiceFromComputation(client, comp, rate, calcMode);
      const items = comp.lines.map((l) => ({
        invoice_id: inv.id, tracking_number: l.pkg.tracking_number,
        tracking_manual: l.pkg.tracking_manual ?? "",
        weight: l.weight, content: l.pkg.content, price: l.amount, tax: 0, total: l.amount,
        is_small: l.isSmall, per_lb: l.perLb
      }));
      const pdf = await generateUploadDownload(inv, items, footer, { download: true });
      if (pdf.url) { await saveInvoicePdfUrl(inv.id, pdf.url); inv.pdf_url = pdf.url; }
      const how = await sendInvoicePdfWhatsApp(inv, pdf.blob, pdf.filename);
      onDone(
        `Facture ${inv.invoice_number} créée (${items.length} colis → Facturé, taux ${rate.toFixed(2)}). ` +
        (how === "file" ? "PDF pataje sou WhatsApp."
          : how === "link" ? "WhatsApp ouvri — peze Send." : "Fakti a nan Invoices.")
      );
      onClose();
    } catch (e: unknown) {
      setErr((e as Error)?.message ?? "Erreur");
    } finally { setBusy(false); }
  };

  const clientName = [client.fullname, client.surname].filter(Boolean).join(" ") || client.customer_code;
  const totalWeight = comp?.totalWeight ?? 0;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold text-navy">Générer Facture — Options</h2>
          <button className="text-slate-400 hover:text-slate-600" onClick={onClose} disabled={busy}><X size={18} /></button>
        </div>
        <p className="text-sm text-slate-600 mb-3">
          <b className="text-navy">{client.customer_code}</b> — {clientName} · {pkgs.length} colis
        </p>

        {/* KONT BUSINESS — pwa yo adisyone ANVAN, yon sèl miltiplikasyon */}
        {client.account_type === "Business" && (
          <div className="border border-navy/20 bg-blue-50 rounded-lg p-3 mb-3">
            <p className="text-xs font-bold text-navy uppercase mb-1">Compte Business</p>
            <p className="text-[12px] text-slate-600 leading-relaxed">
              Tous les poids sont <b>additionnés d&apos;abord</b>, puis multipliés une seule fois
              par le Prix/LB Business. Le tarif « petits colis » ne s&apos;applique pas.
            </p>
          </div>
        )}

        {/* MODE DE CALCUL — lòt kont yo sèlman */}
        {client.account_type !== "Business" && (
        <div className="border border-line rounded-lg p-3 mb-3">
          <p className="text-xs font-bold text-navy uppercase mb-2">Mode de calcul des colis</p>
          <label className="flex items-start gap-2 text-sm py-1 cursor-pointer">
            <input type="radio" name="im" className="mt-1" checked={calcMode === "addition"}
              onChange={() => setCalcMode("addition")} />
            <span><b>Additionner tous les poids</b> — chaque colis = poids × Prix/LB</span>
          </label>
          <label className="flex items-start gap-2 text-sm py-1 cursor-pointer">
            <input type="radio" name="im" className="mt-1" checked={calcMode === "small_control"}
              onChange={() => setCalcMode("small_control")} />
            <span><b>Contrôle des petits colis</b> — {smallCfg.min}–{smallCfg.max} lb = tarif fixe {usd(smallCfg.price)} ; les autres = poids × Prix/LB</span>
          </label>
        </div>
        )}

        {/* ÉTAPES: Taxe / DGA / Discount */}
        <div className="space-y-2 mb-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={useTaxe}
              onChange={(e) => { setTaxeTouched(true); setUseTaxe(e.target.checked); }} />
            <b>Taxe Fixe</b>
            {useTaxe && <input type="number" step="0.01" min="0" placeholder="0.00"
              className="input !w-28 !py-1 text-right ml-auto" value={taxeVal}
              onChange={(e) => { setTaxeTouched(true); setTaxeVal(e.target.value); }} />}
          </label>
          {comp?.ok && comp.taxThresholdReached && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
              Poids total ≥ {TAX_THRESHOLD_LB} LB — taxe fixe proposée automatiquement.
              Vous pouvez modifier le montant ou décocher.
            </p>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={useDga} onChange={(e) => setUseDga(e.target.checked)} />
            <b>Frais DGA</b>
            {useDga && <input type="number" step="0.01" min="0" placeholder="0.00"
              className="input !w-28 !py-1 text-right ml-auto" value={fraisDga} onChange={(e) => setFraisDga(e.target.value)} />}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={useDisc} onChange={(e) => setUseDisc(e.target.checked)} />
            <b>Discount</b>
            {useDisc && <input type="number" step="0.01" min="0" placeholder="0.00"
              className="input !w-28 !py-1 text-right ml-auto" value={discount} onChange={(e) => setDiscount(e.target.value)} />}
          </label>
        </div>

        {/* PRIX/LB — lecture seule (Paramètres) */}
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-2">
          <span className="text-xs text-slate-600">Prix/LB utilisé <span className="text-slate-400">(Paramètres — lecture seule)</span></span>
          <b className="text-navy font-mono">{comp && comp.ok ? usd(comp.perLb) : "—"}
            {comp && comp.ok && <span className="text-slate-400 font-normal"> / {comp.ville}</span>}</b>
        </div>

        {/* ERÈ validasyon — bloke */}
        {comp && !comp.ok && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2 space-y-1">
            <p className="text-xs font-bold text-red-700">❌ Facture bloquée — corriger avant de continuer:</p>
            {comp.errors.map((e, i) => <p key={i} className="text-[11px] text-red-600">• {e}</p>)}
          </div>
        )}
        {err && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2 text-xs text-red-700">❌ {err}</div>}

        {/* APERÇU */}
        <div className="bg-mist rounded-lg p-3 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Poids total</span><b>{totalWeight.toFixed(2)} LB</b></div>
          <div className="flex justify-between"><span className="text-slate-500">Sous-total colis</span><b>{usd(comp?.subtotal ?? 0)}</b></div>
          {useTaxe && Number(taxeVal) > 0 && <div className="flex justify-between"><span className="text-slate-500">Taxe Fixe</span><b>{usd(Number(taxeVal))}</b></div>}
          {useDga && Number(fraisDga) > 0 && <div className="flex justify-between"><span className="text-slate-500">Frais DGA</span><b>{usd(Number(fraisDga))}</b></div>}
          {useDisc && Number(discount) > 0 && <div className="flex justify-between"><span className="text-slate-500">Discount</span><b>−{usd(Number(discount))}</b></div>}
          <div className="flex justify-between border-t border-line pt-1.5 text-navy"><span className="font-bold">TOTAL USD</span><b>{usd(comp?.totalUsd ?? 0)}</b></div>
          <div className="flex justify-between items-center bg-navy text-white rounded-lg px-3 py-2 mt-1">
            <span className="font-semibold">TOTAL HTG</span><b className="text-lg">{htg(comp?.totalHtg ?? 0)}</b>
          </div>
          <p className="text-[11px] text-slate-400 text-right">Taux: 1 USD = {rate.toFixed(2)} HTG · Prix/LB non modifié</p>
        </div>

        <div className="mt-5 flex gap-3">
          <button className="btn flex-1" onClick={generer} disabled={busy || !comp || !comp.ok}>
            {busy ? "Génération..." : "Confirmer & Générer PDF"}
          </button>
          <button className="btn btn-ghost border border-line" onClick={onClose} disabled={busy}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
