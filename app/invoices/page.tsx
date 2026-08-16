"use client";
import { useEffect, useState } from "react";
import { Eye, Download, Printer, Send, XCircle } from "lucide-react";
import { cancelInvoice, getInvoiceItems, getInvoices, getSettings, saveInvoicePdfUrl } from "@/lib/db";
import { useRole } from "@/lib/authx";
import RefreshButton from "@/components/RefreshButton";
import { generateUploadDownload, openInvoicePdf } from "@/lib/pdf";
import { sendInvoicePdfWhatsApp } from "@/lib/whatsapp";
import { Invoice } from "@/lib/types";
import { dateFr, htg, usd } from "@/lib/utils";

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState("");
  const [footer, setFooter] = useState("Mèsi paske ou fè STANDA COMMERCIAL konfyans.");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { role } = useRole();

  const load = async () => {
    await getInvoices().then(setInvoices).catch((e) => setNotice("Erè: " + e.message));
    await getSettings().then((s) => s.invoice_footer && setFooter(s.invoice_footer)).catch(() => {});
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const withItems = async (inv: Invoice) => ({ inv, items: await getInvoiceItems(inv.id) });

  /** ANNULER une facture (koreksyon erè) — koli yo retounen "Disponible" pou refakturasyon. */
  const annuler = async (inv: Invoice) => {
    if (!confirm(
      `Annuler la facture ${inv.invoice_number} ?\n\n` +
      `Client : ${inv.customer_name}\n` +
      `Montant : ${usd(inv.total_usd)}\n` +
      `Colis : ${inv.package_count}\n\n` +
      `➜ Les colis redeviendront « Disponible » et pourront être re-facturés.\n` +
      `➜ La facture sera supprimée définitivement.\n` +
      `➜ L'opération est enregistrée dans l'audit.`
    )) return;
    setBusy(true);
    try {
      const r = await cancelInvoice(inv.id);
      if (r.ok) {
        setNotice(`✅ Facture ${inv.invoice_number} annulée — ${r.restored} colis remis en « Disponible ».`);
        setInvoices((prev) => prev.filter((x) => x.id !== inv.id));
      } else {
        setNotice("Erè anilasyon: " + (r.reason ?? "inconnue"));
      }
    } catch (e: any) {
      setNotice("Erè anilasyon: " + (e?.message ?? String(e)));
    } finally { setBusy(false); }
  };

  const voir = async (inv: Invoice) => {
    if (inv.pdf_url) { window.open(inv.pdf_url, "_blank"); return; }
    const { items } = await withItems(inv);
    await openInvoicePdf(inv, items, footer);
  };
  const telecharger = async (inv: Invoice) => {
    const { items } = await withItems(inv);
    const { url } = await generateUploadDownload(inv, items, footer, { download: true });
    if (url && !inv.pdf_url) { await saveInvoicePdfUrl(inv.id, url); inv.pdf_url = url; }
  };
  const imprimer = async (inv: Invoice) => {
    const { items } = await withItems(inv);
    await generateUploadDownload(inv, items, footer, { autoPrint: true });
  };
  const envoyer = async (inv: Invoice) => {
    const { items } = await withItems(inv);
    // Rejenere PDF la (san telechaje) pou nou ka pataje FICHYE a menm
    const pdf = await generateUploadDownload(inv, items, footer);
    if (pdf.url && !inv.pdf_url) { await saveInvoicePdfUrl(inv.id, pdf.url); inv.pdf_url = pdf.url; }
    const how = await sendInvoicePdfWhatsApp(inv, pdf.blob, pdf.filename);
    setNotice(how === "file"
      ? `PDF facture ${inv.invoice_number} pataje dirèkteman sou WhatsApp pou ${inv.customer_name}.`
      : how === "link"
      ? `WhatsApp ouvri pou ${inv.customer_name} — lyen PDF la nan mesaj la, peze Send sèlman.`
      : "Pataj la anile.");
  };

  const q = search.trim().toLowerCase();
  const filtered = q ? invoices.filter((f) =>
    f.invoice_number.toLowerCase().includes(q) || f.customer_code.toLowerCase().includes(q) ||
    f.customer_name.toLowerCase().includes(q)) : invoices;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-extrabold text-navy">Invoices</h1>
        <div className="flex gap-2 items-center">
          <input className="input w-80" placeholder="No facture, code ou nom client..." value={search}
            onChange={(e) => setSearch(e.target.value)} />
          <RefreshButton onRefresh={load} />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr>{["Date", "No Facture", "Code Client", "Nom Client", "Sous-total", "Tax", "Total USD", "Taux", "Total HTG", "Actions"]
            .map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-10 text-slate-400">Aucune facture.</td></tr>
            ) : filtered.map((f, i) => (
              <tr key={f.id} className={i % 2 ? "bg-mist" : ""}>
                <td className="td whitespace-nowrap">{dateFr(f.created_at)}</td>
                <td className="td font-bold text-navy">{f.invoice_number}</td>
                <td className="td">{f.customer_code}</td>
                <td className="td">{f.customer_name}</td>
                <td className="td text-right">{usd(f.subtotal)}</td>
                <td className="td text-right">{usd(f.tax)}</td>
                <td className="td text-right font-bold">{usd(f.grand_total)}</td>
                <td className="td text-right text-xs text-slate-500">{Number(f.exchange_rate_used).toFixed(2)}</td>
                <td className="td text-right font-bold text-navy">{htg(f.total_htg || f.grand_total * f.exchange_rate_used)}</td>
                <td className="td whitespace-nowrap">
                  <button title="Voir" className="text-navy hover:text-navy-light mr-3" onClick={() => voir(f)}><Eye size={16} /></button>
                  <button title="Télécharger" className="text-navy hover:text-navy-light mr-3" onClick={() => telecharger(f)}><Download size={16} /></button>
                  <button title="Ré-imprimer" className="text-navy hover:text-navy-light mr-3" onClick={() => imprimer(f)}><Printer size={16} /></button>
                  <button title="Envoyer sur WhatsApp" className="text-[#128C4B] hover:text-[#25D366]" onClick={() => envoyer(f)}><Send size={16} /></button>
                  {role === "admin" && (
                    <button title="Annuler la facture (colis redeviennent Disponible)"
                      className="text-slate-400 hover:text-red-600 ml-3" disabled={busy}
                      onClick={() => annuler(f)}><XCircle size={16} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {notice && <p className="card px-4 py-3 text-sm text-navy">{notice}</p>}
    </div>
  );
}
