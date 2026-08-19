"use client";
import { use, useEffect, useState } from "react";
import Loader from "@/components/Loader";
import Link from "next/link";
import { ArrowLeft, Calculator, FileText, PackageCheck, Upload, X, Trash2 } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import RefreshButton from "@/components/RefreshButton";
import { usePackageSelection } from "@/lib/selection";
import {
  commitPdfImport, detachPackagesFromInvoice, hardDeletePackage, getClient, getClientPackagesAndInvoices,
  getInvoiceFlags, getSettings, getUsdRate, setPackagesStatus, updatePackagePrice
} from "@/lib/db";
import { useRole } from "@/lib/authx";
import { parseMcpackPdf, PdfPkgRow } from "@/lib/pdfimport";
import { computePrice, round2 } from "@/lib/pricing";
import InvoiceDialog from "@/components/InvoiceDialog";
import { Client, INTERNAL_STATUSES, Invoice, Pkg } from "@/lib/types";
import { dateFr, parseMcpackDate, usd } from "@/lib/utils";

type SelPkg = Pkg & { selected?: boolean };

/**
 * DOSYE KLIYAN (V7.2) — tout enfòmasyon + tout operasyon koli yo yon sèl kote:
 * seleksyon, tarification, chanjman statut (Disponible/Livré...), facturation.
 * Admin AK Employé ka fè operasyon sa yo (Paramètres sèlman ki rezève admin).
 */
export default function ClientDossier({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const decoded = decodeURIComponent(code);
  const [client, setClient] = useState<Client | null>(null);
  const [pkgs, setPkgs] = useState<SelPkg[]>([]);
  const [invs, setInvs] = useState<Invoice[]>([]);
  const [rate, setRate] = useState(132);
  const [footer, setFooter] = useState("Mèsi paske ou fè STANDA COMMERCIAL konfyans.");
  const [bulkStatus, setBulkStatus] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { role } = useRole();
  const sel = usePackageSelection();
  const [pdfRows, setPdfRows] = useState<PdfPkgRow[] | null>(null);   // Import PDF pou KLIYAN sa a
  const [flags, setFlags] = useState({ taxFix: false, taxDga: false });

  /** IMPORT PDF (V8.5 §9) — dirèkteman sou kont kliyan an */
  const handlePdf = async (f: File) => {
    setNotice(null); setBusy(true);
    try {
      const rows = await parseMcpackPdf(await f.arrayBuffer());
      if (!rows.length) { setNotice("Aucun colis détecté dans le PDF."); return; }
      setPdfRows(rows);
    } catch (e: any) { setNotice("Erè lekti PDF: " + (e.message ?? String(e))); }
    finally { setBusy(false); }
  };

  const validerPdf = async () => {
    if (!pdfRows || !client) return;
    setBusy(true);
    try {
      const r = await commitPdfImport(pdfRows, client, true);
      setNotice(`✅ Import PDF: ${r.created} créés, ${r.updated} mis à jour, ${r.ignored} ignorés.`);
      setPdfRows(null);
      await load();
    } catch (e: any) { setNotice("Erè: " + e.message); }
    finally { setBusy(false); }
  };

  const load = async () => {
    const [c, r, s, fl] = await Promise.all([getClient(decoded), getUsdRate(), getSettings(), getInvoiceFlags()]);
    setFlags(fl);
    setClient(c); setRate(r);
    if (s.invoice_footer) setFooter(s.invoice_footer);
    const { pkgs: p, invs: i } = await getClientPackagesAndInvoices(decoded);
    setPkgs(p.slice().sort((a, b) => parseMcpackDate(b.created_date) - parseMcpackDate(a.created_date)));
    setInvs(i);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [decoded]);
  // Kenbe panèl seleksyon global la enfòme (DWE anvan nenpòt return kondisyonèl)
  useEffect(() => { if (pkgs.length) sel.hydrate(pkgs.map(snap)); /* eslint-disable-next-line */ }, [pkgs]);

  const visible = pkgs.filter((p) => p.status !== "Livré");
  const livres = pkgs.filter((p) => p.status === "Livré");
  // SÉLECTION GLOBALE — pataje ak Packages/Conduces (li travèse kliyan yo)
  const snap = (p: SelPkg) => ({
    id: p.id, tracking_number: p.tracking_number, customer_code: p.customer_code,
    customer_name: p.customer_name, weight: Number(p.weight) || 0,
    status: p.status, conduce_id: p.conduce_id ?? null,
  });
  const selected = visible.filter((p) => sel.has(p.id));
  const selectedDisponible = selected.filter((p) => p.status === "Disponible");
  const toggle = (id: string) => { const p = pkgs.find((x) => x.id === id); if (p) sel.toggle(snap(p)); };
  const toggleAll = (ck: boolean) => sel.setMany(visible.filter((p) => p.status !== "Livré").map(snap), ck);

  // ===== Estatistik =====
  const totalLbs = round2(pkgs.reduce((s, p) => s + p.weight, 0));
  const totalFacture = round2(invs.reduce((s, i) => s + Number(i.grand_total ?? 0), 0));
  const nonFacture = round2(visible.filter((p) => p.status === "Disponible")
    .reduce((s, p) => s + p.price_usd + p.tax_usd, 0));

  // ===== Tarification (menm règ ak paj Packages) =====
  const applyTarif = async () => {
    if (!client?.ville) { setNotice("Kliyan sa a poko gen vil tarification — Modifye l nan Clients."); return; }
    const targets = (selected.length ? selected : visible).filter((p) => p.status === "Disponible");
    if (!targets.length) { setNotice("Pa gen koli Disponible pou tarife."); return; }
    setBusy(true);
    try {
      for (const p of targets) {
        const r = computePrice(p.weight, client.account_type, client.ville);
        if (r) await updatePackagePrice(p.id, r.price, flags.taxFix ? r.taxFix : 0, rate);
      }
      setNotice(`Tarification aplike sou ${targets.length} colis.`);
      await load();
    } catch (e: any) { setNotice("Erè: " + e.message); }
    finally { setBusy(false); }
  };

  /** EFASE NÈT (admin) — pou done kraze. Koli a ka re-enpòte apre via Extension/Conduce. */
  const supprimerDefinitif = async (p: SelPkg) => {
    if (!confirm(
      `⚠️ SUPPRIMER DÉFINITIVEMENT ce colis ?\n\n` +
      `Tracking ID : ${p.tracking_number}\n` +
      `Client : ${p.customer_code} — ${p.customer_name}\n` +
      `Statut : ${p.status}\n\n` +
      `➜ Le colis sera retiré de TOUT le système (Packages, Historique, Conduce, dossier client).\n` +
      `➜ Sa ligne de facture sera retirée ; la facture sera recalculée ou supprimée si vide.\n` +
      `➜ CETTE ACTION EST IRRÉVERSIBLE.\n\n` +
      `Vous pourrez le ré-importer depuis MCPACK (Extension / Import Conduce).`
    )) return;
    if (!confirm(`Dernière confirmation — supprimer ${p.tracking_number} définitivement ?`)) return;
    setBusy(true);
    try {
      const r = await hardDeletePackage(p.id);
      if (!r.ok) { setNotice("Erè: " + (r.reason ?? "inconnue")); return; }
      setNotice(`🗑 Colis ${p.tracking_number} supprimé définitivement` +
        (r.invoiceDeleted ? " — facture devenue vide supprimée." : "."));
      await load();
    } catch (e: any) {
      setNotice("Erè: " + (e?.message ?? String(e)));
    } finally { setBusy(false); }
  };

  // ===== Chanjman statut (ak email Reçu à Miami / Disponible) =====
  const appliquerStatut = async () => {
    if (!bulkStatus || !selected.length) return;
    // "Facturé" -> "Disponible" = koreksyon erè: detache fakti a kòrèkteman
    const factures = selected.filter((p) => p.status === "Facturé");
    if (bulkStatus === "Disponible" && factures.length) {
      if (!confirm(
        `${factures.length} colis déjà facturé(s) vont être retirés de leur facture.\n\n` +
        `➜ Ils redeviendront « Disponible » et pourront être re-facturés.\n` +
        `➜ La facture sera recalculée (ou supprimée si elle devient vide).\n` +
        `➜ Opération enregistrée dans l'audit.`
      )) return;
      setBusy(true);
      try {
        const r = await detachPackagesFromInvoice(factures.map((p) => p.id));
        if (!r.ok) { setNotice("Erè: " + (r.reason ?? "inconnue")); setBusy(false); return; }
        setNotice(`✅ ${r.detached} colis remis en « Disponible »` +
          (r.invoicesDeleted ? ` — ${r.invoicesDeleted} facture(s) vide(s) supprimée(s).` : "."));
        await load();
      } catch (e: any) {
        setNotice("Erè: " + (e?.message ?? String(e)));
      } finally { setBusy(false); }
      return;
    }
    const targets = selected.filter((p) => p.status !== "Facturé" || bulkStatus === "Livré");
    if (!targets.length) { setNotice("Chwazi koli (Facturé yo ka sèlman pase Livré oswa Disponible)."); return; }
    setBusy(true);
    try {
      await setPackagesStatus(targets.map((p) => p.id), bulkStatus);
      let mailInfo = "";
      if ((bulkStatus === "Reçu à Miami" || bulkStatus === "Disponible") && client?.email) {
        try {
          const res = await fetch("/api/notify", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: bulkStatus === "Reçu à Miami" ? "recu_miami" : "disponible",
              client: { name: [client.fullname, client.surname].filter(Boolean).join(" "),
                code: client.customer_code, ville: client.ville?.name ?? "", email: client.email },
              packages: targets.map((p) => ({
                tracking_number: p.tracking_number, tracking_manual: p.tracking_manual,
                content: p.content, weight: p.weight,
                fournisseur: p.mcpack_data?.["Proveedor"] ?? ""
              }))
            })
          });
          const j = await res.json();
          mailInfo = j.ok ? " Email voye." : ` ⚠️ Email: ${j.reason ?? j.error ?? "echwe"}`;
        } catch { mailInfo = " ⚠️ Email pa pati (rezo)."; }
      }
      setNotice(`Statut "${bulkStatus}" aplike sou ${targets.length} colis.` + mailInfo);
      setBulkStatus("");
      await load();
    } catch (e: any) { setNotice("Erè: " + e.message); }
    finally { setBusy(false); }
  };

  // ===== Facturation — MÊME fenêtre partagée que Packages =====
  const [showInvoice, setShowInvoice] = useState(false);
  const facturer = () => {
    if (!client || !selectedDisponible.length) return;
    setShowInvoice(true);
  };

  if (!client) return <Loader inline />;
  const non = [client.fullname, client.surname].filter(Boolean).join(" ");
  const allChecked = visible.length > 0 && visible.every((p) => sel.has(p.id));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/clients" className="btn btn-ghost !px-2.5"><ArrowLeft size={16} /></Link>
        <h1 className="text-xl font-extrabold text-navy">{client.customer_code} — {non}</h1>
        <span className={`badge ${client.account_status === "Actif" || !client.account_status
          ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
          {client.account_status ?? "Actif"}</span>
        <span className="badge bg-slate-100 text-slate-600">{client.account_type}</span>
      </div>

      {/* ===== Enfòmasyon + estatistik ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="card p-4 lg:col-span-2">
          <h2 className="text-xs font-bold text-navy uppercase tracking-wide mb-3">Informations client</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5 text-xs">
            {([["Téléphone", client.phone], ["WhatsApp", client.whatsapp], ["Email", client.email],
               ["Pays", client.country], ["Ville", [client.city, client.city2].filter(Boolean).join(" / ") || client.ville?.name],
               ["Ville tarif", client.ville?.name], ["Adresse", client.address],
               ["Pièce", `${client.id_type ?? ""} ${client.id_number ?? ""}`.trim()],
               ["Username", client.username]] as const).map(([k, v]) => (
              <div key={k}><span className="text-slate-400">{k}:</span>{" "}
                <span className="font-semibold">{v || "—"}</span></div>
            ))}
          </div>
        </section>
        <section className="card p-4 grid grid-cols-2 gap-3 text-center">
          {[["Colis total", pkgs.length], ["Livrés", livres.length],
            ["Poids total (lb)", totalLbs.toFixed(2)],
            ["Total facturé", usd(totalFacture)],
            ["Disponible (à facturer)", usd(nonFacture)],
            ["Factures", invs.length]].map(([k, v]) => (
            <div key={String(k)} className="bg-mist rounded-lg py-2 px-1">
              <p className="text-[10px] text-slate-500 uppercase">{k}</p>
              <p className="text-sm font-extrabold text-navy">{v}</p>
            </div>
          ))}
        </section>
      </div>

      {/* ===== Operasyon sou koli yo ===== */}
      <div className="flex gap-2 flex-wrap items-center">
        <RefreshButton onRefresh={load} />
        <button className="btn btn-ghost border border-line" onClick={applyTarif} disabled={busy}>
          <Calculator size={14} /> Appliquer tarification
        </button>
        <select className="input !w-44 !py-1.5 !text-xs" value={bulkStatus}
          onChange={(e) => setBulkStatus(e.target.value)}>
          <option value="">— Changer statut —</option>
          {[...INTERNAL_STATUSES, "Livré"].filter((s, i, a) => a.indexOf(s) === i)
            .map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="btn !bg-emerald-600 hover:!bg-emerald-700" onClick={appliquerStatut}
          disabled={busy || !bulkStatus || !selected.length}>
          <PackageCheck size={14} /> Appliquer ({selected.length})
        </button>
        <button className="btn" onClick={facturer} disabled={busy || !selectedDisponible.length}>
          <FileText size={14} /> Générer Facture ({selectedDisponible.length})
        </button>
        <label className="btn btn-ghost border border-line cursor-pointer">
          <Upload size={14} /> Importer PDF
          <input type="file" accept="application/pdf,.pdf" className="hidden"
            onChange={(e) => e.target.files?.[0] && handlePdf(e.target.files[0])} />
        </label>
      </div>

      {/* ===== Koli yo ===== */}
      <section className="card overflow-x-auto">
        <h2 className="text-xs font-bold text-navy uppercase tracking-wide p-3 pb-1">
          Colis ({visible.length} aktif{livres.length ? ` + ${livres.length} livré nan Historique` : ""})
        </h2>
        <table className="w-full text-xs">
          <thead><tr>
            <th className="thc"><input type="checkbox" checked={allChecked} onChange={(e) => toggleAll(e.target.checked)} /></th>
            {["Tracking ID (Guía)", "Tracking Number", "Date", "Lb", "Content", "Price $", "Total $", "Status", ""]
              .map((h) => <th key={h} className="thc">{h}</th>)}
          </tr></thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-8 text-slate-400">Pa gen koli aktif.</td></tr>
            ) : visible.map((p, i) => (
              <tr key={p.id} className={`${i % 2 ? "bg-mist" : ""} ${sel.has(p.id) ? "!bg-blue-50" : ""}`}>
                <td className="tdc"><input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} /></td>
                <td className="tdc font-mono text-[11px]">{p.tracking_number}</td>
                <td className="tdc font-mono text-[11px]">{p.tracking_manual || <span className="text-slate-300">—</span>}</td>
                <td className="tdc whitespace-nowrap">{p.created_date}</td>
                <td className="tdc text-right">{p.weight}</td>
                <td className="tdc max-w-[110px] truncate" title={p.content}>{p.content}</td>
                <td className="tdc text-right">{usd(p.price_usd)}</td>
                <td className="tdc text-right font-semibold">{usd(p.total_usd)}</td>
                <td className="tdc"><StatusBadge status={p.status} /></td>
                <td className="tdc">
                  {role === "admin" && (
                    <button className="text-slate-300 hover:text-red-600"
                      title="Supprimer définitivement (données cassées — à ré-importer)"
                      onClick={() => supprimerDefinitif(p)}><Trash2 size={14} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ===== Fakti / Historique ===== */}
      <section className="card overflow-x-auto">
        <h2 className="text-xs font-bold text-navy uppercase tracking-wide p-3 pb-1">Factures ({invs.length})</h2>
        <table className="w-full text-xs">
          <thead><tr>{["No Facture", "Date", "Colis", "Total USD", "Total HTG", "PDF"]
            .map((h) => <th key={h} className="thc">{h}</th>)}</tr></thead>
          <tbody>
            {invs.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-slate-400">Poko gen fakti.</td></tr>
            ) : invs.map((f, i) => (
              <tr key={f.id} className={i % 2 ? "bg-mist" : ""}>
                <td className="tdc font-bold text-navy">{f.invoice_number}</td>
                <td className="tdc">{dateFr(f.created_at)}</td>
                <td className="tdc text-center">{f.package_count}</td>
                <td className="tdc text-right font-semibold">{usd(f.grand_total)}</td>
                <td className="tdc text-right text-slate-500">{Number(f.total_htg ?? 0).toFixed(0)} HTG</td>
                <td className="tdc">{f.pdf_url
                  ? <a href={f.pdf_url} target="_blank" className="text-navy underline font-semibold">PDF</a> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ===== Modal: apèsi Import PDF pou kliyan sa a ===== */}
      {pdfRows && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setPdfRows(null)}>
          <div className="card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-navy uppercase tracking-wide">
                Import PDF — {pdfRows.length} colis pour {client.customer_code}
              </h2>
              <button className="text-slate-400 hover:text-navy" onClick={() => setPdfRows(null)}><X size={18} /></button>
            </div>
            <div className="border border-line rounded-lg overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0"><tr>
                  {["Tracking ID (Guía)", "Tracking Number", "Lb", "Contenu", "Date", "Heure", "Estatus"]
                    .map((h) => <th key={h} className="thc">{h}</th>)}
                </tr></thead>
                <tbody>
                  {pdfRows.map((r, i) => (
                    <tr key={i} className={i % 2 ? "bg-mist" : ""}>
                      <td className="tdc font-mono text-[11px]">{r.guia}</td>
                      <td className="tdc font-mono text-[11px]">{r.tracking_number}</td>
                      <td className="tdc text-right">{r.weight.toFixed(2)}</td>
                      <td className="tdc max-w-[110px] truncate" title={r.content}>{r.content}</td>
                      <td className="tdc whitespace-nowrap">{r.created_date}</td>
                      <td className="tdc whitespace-nowrap">{r.heure}</td>
                      <td className="tdc max-w-[110px] truncate" title={r.status_raw}>{r.status_raw}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3">
              <button className="btn" onClick={validerPdf} disabled={busy}>
                {busy ? "Import en cours..." : `Importer ${pdfRows.length} colis`}
              </button>
              <button className="btn btn-ghost" onClick={() => setPdfRows(null)}>Annuler</button>
            </div>
            <p className="text-[11px] text-slate-400">
              Guía (WR...) = Tracking ID. Lòt kòd yo = Tracking Number. Anti-doublon aktif.
            </p>
          </div>
        </div>
      )}

      {showInvoice && client && (
        <InvoiceDialog
          client={client}
          pkgs={selectedDisponible}
          footer={footer}
          onClose={() => setShowInvoice(false)}
          onDone={(msg) => { setNotice(msg); load(); }}
        />
      )}

      {notice && <p className="card px-4 py-3 text-sm text-navy">{notice}</p>}
    </div>
  );
}
