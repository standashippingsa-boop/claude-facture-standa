"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { createInvoiceFromComputation, getCentralAccountCode, getSmallParcelConfig, getSpecialArticles, getUsdRate, getVilles, saveInvoicePdfUrl } from "@/lib/db";
import { computeInvoice, InvoiceComputation, verifyTotal } from "@/lib/invoice-engine";
import { FixedPriceMap, SpecialArticle, TAX_THRESHOLD_LB } from "@/lib/pricing";
import { Ville } from "@/lib/types";
import { MapPin } from "lucide-react";
import { generateUploadDownload } from "@/lib/pdf";
import { sendInvoicePdfWhatsApp } from "@/lib/whatsapp";
import { Client, Pkg } from "@/lib/types";
import { htg, usd } from "@/lib/utils";
import { Package } from "lucide-react";

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
 * COMPTE CENTRAL BUSINESS (V15):
 *   Kliyan biznis ki poko gen pwòp kont yo pase sou yon kont santral
 *   (Paramètres → code du compte central, ex: MC-36191). Kont sa a PA mare
 *   ak yon sèl vil: lè w ap fakti, yon meni parèt pou w chwazi VIL la
 *   (Gonaïves, Port-de-Paix…) epi TARIF vil sa a aplike. Konsa menm kont lan
 *   sèvi pou nenpòt destinasyon, san blokaj.
 *
 * ARTICLES À PRIX FIXE (V14):
 *   Kèk koli pa fakti pa liv (telefòn, laptòp, kamera…). Pou chak koli,
 *   admin ka chwazi yon atik nan katalòg la (Paramètres) — montan an vin
 *   yon FÒFÈ epi pwa a pa antre nan kalkil la.
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
  /** Katalòg atik a pri fiks (Paramètres). */
  const [articles, setArticles] = useState<SpecialArticle[]>([]);
  /** Chwa admin an pa koli: { [pkg.id]: article.id }. Vid = fakti pa liv. */
  const [fixedSel, setFixedSel] = useState<Record<string, string>>({});
  /** Kont santral: lis vil yo + vil ki chwazi pou fakti sa a. */
  const [centralCode, setCentralCode] = useState("");
  const [villes, setVilles] = useState<Ville[]>([]);
  const [villeId, setVilleId] = useState("");

  const [comp, setComp] = useState<InvoiceComputation | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Chaje to + konfigirasyon ti koli (Paramètres)
  useEffect(() => {
    (async () => {
      const [r, cfg, arts, cc] = await Promise.all([
        getUsdRate(), getSmallParcelConfig(), getSpecialArticles(), getCentralAccountCode()
      ]);
      setRate(r); setSmallCfg(cfg); setArticles(arts); setCentralCode(cc.toUpperCase());
      // Kont santral -> chaje vil yo pou admin ka chwazi destinasyon an
      if (cc && String(client.customer_code ?? "").trim().toUpperCase() === cc.toUpperCase()) {
        try {
          const vs = (await getVilles()).filter((v) => v.active);
          setVilles(vs);
          setVilleId(client.ville?.id ?? vs[0]?.id ?? "");
        } catch { /* pa bloke fakti a */ }
      }
      setReady(true);
    })();
  }, []);

  /** true si fakti sa a se pou KONT SANTRAL la. */
  const isCentral = !!centralCode &&
    String(client.customer_code ?? "").trim().toUpperCase() === centralCode;

  /**
   * KLIYAN EFEKTIF pou motè a. Pou kont santral, nou ranplase `ville` a pa
   * vil destinasyon admin an chwazi — konsa tarif la se tarif vil sa a.
   * Nou PA touche kliyan an nan bazdone a: se yon ranplasman kalkil sèlman.
   */
  const villeChoisie = villes.find((v) => v.id === villeId) ?? null;
  const effClient = isCentral && villeChoisie ? { ...client, ville: villeChoisie } : client;

  /** Kat fòfè a: { [pkg.id]: { label, price } } — sèlman koli ki gen yon atik. */
  const fixedPrices: FixedPriceMap = {};
  for (const [pkgId, artId] of Object.entries(fixedSel)) {
    const a = articles.find((x) => x.id === artId);
    if (a) fixedPrices[pkgId] = { label: a.label, price: a.price };
  }
  const fixedKey = JSON.stringify(fixedSel);

  // Rekalkile ak MOTEUR FINANCIER chak fwa yon opsyon chanje
  useEffect(() => {
    if (!ready || !pkgs.length) { setComp(null); return; }
    setComp(computeInvoice({
      client: effClient, pkgs, rate, smallCfg, mode: calcMode, fixedPrices,
      taxeFixe: useTaxe ? Number(taxeVal) || 0 : 0,
      fraisDga: useDga ? Number(fraisDga) || 0 : 0,
      discount: useDisc ? Number(discount) || 0 : 0
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, rate, calcMode, useTaxe, taxeVal, useDga, fraisDga, useDisc, discount, fixedKey, articles, villeId, centralCode]);

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
        is_small: l.isSmall, per_lb: l.perLb, fixed_label: l.isFixed ? l.fixedLabel : ""
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

        {/* COMPTE CENTRAL — chwazi vil destinasyon an (tarif flexib) */}
        {isCentral && (
          <div className="border border-brand/40 bg-brand/5 rounded-lg p-3 mb-3">
            <p className="text-xs font-bold text-brand-dark uppercase mb-1 flex items-center gap-1.5">
              <MapPin size={13} /> Compte central — {client.customer_code}
            </p>
            <p className="text-[11px] text-slate-600 mb-2 leading-relaxed">
              Ce compte n&apos;est lié à aucune ville. Choisissez la <b>ville de destination</b> :
              c&apos;est son tarif qui sera appliqué à cette facture.
            </p>
            <select className="input !py-1.5 !text-sm w-full" value={villeId}
              onChange={(e) => setVilleId(e.target.value)}>
              {villes.length === 0 && <option value="">Aucune ville active</option>}
              {villes.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} — {usd(client.account_type === "Business" ? v.price_business : v.price_personal)}/lb
                </option>
              ))}
            </select>
          </div>
        )}

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

        {/* ARTICLES À PRIX FIXE — koli ki pa fakti pa liv */}
        {articles.length > 0 && (
          <div className="border border-line rounded-lg p-3 mb-3">
            <p className="text-xs font-bold text-navy uppercase mb-1 flex items-center gap-1.5">
              <Package size={13} /> Articles à prix fixe
            </p>
            <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
              Téléphone, laptop, caméra… Choisissez l&apos;article : le poids ne sera pas facturé,
              c&apos;est le forfait qui s&apos;applique.
            </p>
            <div className="max-h-44 overflow-y-auto divide-y divide-line">
              {pkgs.map((p) => (
                <div key={p.id} className="flex items-center gap-2 py-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[11px] font-semibold text-ink truncate">{p.tracking_number}</p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {p.content || "—"} · {Number(p.weight) > 0 ? `${Number(p.weight).toFixed(2)} lb` : "—"}
                    </p>
                  </div>
                  <select
                    className="input !w-44 !py-1 !text-[11px] shrink-0"
                    value={fixedSel[p.id] ?? ""}
                    onChange={(e) => setFixedSel((prev) => {
                      const n = { ...prev };
                      if (e.target.value) n[p.id] = e.target.value; else delete n[p.id];
                      return n;
                    })}>
                    <option value="">Au poids (normal)</option>
                    {articles.map((a) => (
                      <option key={a.id} value={a.id}>{a.label} — {usd(a.price)}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
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
          {comp?.ok && comp.lines.some((l) => l.isFixed) && (
            <div className="flex justify-between"><span className="text-slate-500">
              dont forfaits ({comp.lines.filter((l) => l.isFixed).length} colis)</span>
              <b>{usd(comp.lines.filter((l) => l.isFixed).reduce((s, l) => s + l.amount, 0))}</b></div>
          )}
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
