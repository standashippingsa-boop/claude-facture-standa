"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileDown, LoaderCircle, Printer, ReceiptText } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useNoticeToast } from "@/lib/notify";
import {
  generateRemiseTicketPdf, qrSvgPath, ticketAmount, ticketDateTime, ticketHtg, ticketQrMatrix,
  ticketShortDateTime, ticketUsd, type RemiseTicket, type TicketWidth
} from "@/lib/remise-ticket";

const WIDTH_KEY = "standa:ticket-width";

/**
 * Paj TICKET DE REMISE — menm konpozan pou admin (/ticket-remise) ak ajan
 * (/espace-remise/ticket). Ticket la parèt sou fòm resi kès tèmik; bouton
 * « Imprimer » voye SÈLMAN ticket la bay enprimant lan (80 mm oswa 58 mm).
 * Avèk `print=1` nan URL la, fenèt enpresyon an louvri otomatikman yon fwa.
 */
export default function RemiseTicketPage({ packageId, backHref, autoPrint }: { packageId: string; backHref: string; autoPrint: boolean }) {
  const router = useRouter();
  const [ticket, setTicket] = useState<RemiseTicket | null>(null);
  const [qr, setQr] = useState<boolean[][] | null>(null);
  const [error, setError] = useState("");
  useNoticeToast(error, setError, { tone: "error", title: "Ticket indisponible" });
  const [width, setWidth] = useState<TicketWidth>(80);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pageHeight, setPageHeight] = useState(0);
  const printed = useRef(false);
  const ticketRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    try { if (window.localStorage.getItem(WIDTH_KEY) === "58") setWidth(58); } catch { /* préférence optionnelle */ }
  }, []);

  const chooseWidth = (value: TicketWidth) => {
    setWidth(value);
    try { window.localStorage.setItem(WIDTH_KEY, String(value)); } catch { /* préférence optionnelle */ }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token ?? "";
        const response = await fetch(`/api/remise-ticket?package=${encodeURIComponent(packageId)}`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.reason || "Ticket indisponible.");
        const data = result.ticket as RemiseTicket;
        const matrix = await ticketQrMatrix(data.qr_payload);
        if (!cancelled) { setTicket(data); setQr(matrix); }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Ticket indisponible.");
      }
    })();
    return () => { cancelled = true; };
  }, [packageId]);

  // Wotè paj enpresyon an = wotè ticket la (mm): enprimant woulo a koupe
  // papye a egzakteman nan bout ticket la, san paj vid ni koupi an de.
  useEffect(() => {
    const node = ticketRef.current;
    if (!ticket || !node) return;
    const measure = () => setPageHeight(Math.ceil(node.getBoundingClientRect().height * 25.4 / 96) + 6);
    measure();
    const images = Array.from(node.querySelectorAll("img"));
    images.forEach((image) => image.addEventListener("load", measure));
    return () => images.forEach((image) => image.removeEventListener("load", measure));
  }, [ticket, qr, width]);

  // Enpresyon otomatik apre remiz la: yon sèl fwa, lè ticket la fin parèt.
  useEffect(() => {
    if (!ticket || !pageHeight || !autoPrint || printed.current) return;
    printed.current = true;
    const timer = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(timer);
  }, [ticket, pageHeight, autoPrint]);

  const downloadPdf = async () => {
    if (!ticket || pdfBusy) return;
    setPdfBusy(true);
    try { await generateRemiseTicketPdf(ticket, width); }
    catch { setError("PDF indisponible pour le moment. Utilisez « Imprimer »."); }
    finally { setPdfBusy(false); }
  };

  if (!ticket && !error) return <div className="grid min-h-[60vh] place-items-center"><LoaderCircle className="animate-spin text-navy" size={34} /></div>;
  if (!ticket) return <section className="mx-auto mt-6 max-w-xl rounded-3xl border border-red-200 bg-red-50 p-6 text-center"><ReceiptText className="mx-auto text-red-600" size={34} /><h1 className="mt-3 text-xl font-black text-navy">Ticket indisponible</h1><p className="mt-2 text-sm text-red-700">{error}</p><button type="button" onClick={() => router.push(backHref)} className="btn btn-primary mt-5">Retour</button></section>;

  const t = ticket;
  const paperWidth = width === 80 ? "72mm" : "50mm";
  return <div className="mx-auto max-w-xl space-y-4 px-3 py-4 print:m-0 print:max-w-none print:p-0">
    <style jsx global>{`
      @media print {
        @page { size: ${width}mm ${pageHeight || 297}mm; margin: 0; }
        html, body { background: #fff !important; }
        body * { visibility: hidden; }
        #remise-ticket, #remise-ticket * { visibility: visible; }
        #remise-ticket { position: absolute; left: 0; top: 0; margin: 0 !important; box-shadow: none !important; border: 0 !important; }
      }
    `}</style>

    <div className="space-y-3 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => router.push(backHref)} className="btn btn-ghost inline-flex items-center gap-2"><ArrowLeft size={17} /> Retour</button>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void downloadPdf()} disabled={pdfBusy} className="btn btn-ghost inline-flex items-center gap-2 border border-slate-200">{pdfBusy ? <LoaderCircle className="animate-spin" size={17} /> : <FileDown size={17} />} PDF</button>
          <button type="button" onClick={() => window.print()} className="btn btn-primary inline-flex items-center gap-2"><Printer size={17} /> Imprimer le ticket</button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">
        <span className="font-semibold text-slate-600">Papier de l’imprimante</span>
        <div className="flex gap-1">{([80, 58] as TicketWidth[]).map((value) => <button key={value} type="button" aria-pressed={width === value} onClick={() => chooseWidth(value)} className={`rounded-lg px-3 py-1.5 font-bold ${width === value ? "bg-[#09295e] text-white" : "bg-slate-100 text-slate-700"}`}>{value} mm</button>)}</div>
      </div>
    </div>

    <article id="remise-ticket" ref={ticketRef} className="mx-auto bg-white text-black shadow-md ring-1 ring-slate-200"
      style={{ width: paperWidth, padding: width === 80 ? "4mm" : "2.5mm", boxSizing: "content-box", fontFamily: "'Courier New', Courier, monospace", fontSize: width === 80 ? "11.5px" : "10px", lineHeight: 1.35 }}>
      <div className="text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="mx-auto mb-1 object-contain grayscale" style={{ width: width === 80 ? 58 : 46, height: width === 80 ? 58 : 46 }} onError={(event) => { event.currentTarget.style.display = "none"; }} />
        <p className="font-bold" style={{ fontSize: "1.45em", letterSpacing: "0.02em" }}>{t.company.name}</p>
        {t.point && <p>Point de retrait : {t.point}</p>}
        <p>{t.company.phone}</p>
        <p>{t.company.website}</p>
      </div>
      <Rule />
      <p className="text-center font-bold" style={{ fontSize: "1.2em" }}>TICKET DE REMISE</p>
      <p>Date : {ticketDateTime(t.delivered_at)}</p>
      <p>Ticket # : {t.ticket_number}</p>
      <Rule />

      <p className="font-bold">{t.customer.is_central ? "Compte central" : "Client"}</p>
      <p className="font-bold">{t.customer.code}</p>
      {t.customer.name && <p>{t.customer.name}</p>}
      {t.customer.phone && <p>Tél : {t.customer.phone}</p>}
      {t.customer.city && <p>Ville : {t.customer.city}</p>}
      <Rule />

      <p className="font-bold">COLIS REMIS ({t.packages.length})</p>
      <div className="mt-1 space-y-1.5">{t.packages.map((item, index) => <div key={item.id}>
        <p className="break-all font-bold">{index + 1}. {item.guia || item.tracking || "—"}</p>
        <div className="pl-[1.5ch]">
          {item.tracking && item.tracking !== item.guia && <p className="break-all">Trk : {item.tracking}</p>}
          <p>{[item.content, `Qté ${item.quantity}`, `${item.weight.toFixed(2)} lb`].filter(Boolean).join(" · ")}</p>
          {item.invoice_number && <p>Facture : {item.invoice_number}</p>}
        </div>
      </div>)}</div>
      <Rule />
      <Row label="Nombre de colis" value={String(t.totals.packages)} />
      <Row label="Articles" value={String(t.totals.articles)} />
      <Row label="Poids total" value={`${t.totals.weight_lb.toFixed(2)} lb`} />
      <Rule />

      {t.invoices.length > 0 && <>
        <div className="space-y-2">{t.invoices.map((invoice) => <div key={invoice.invoice_number}>
          <Row label={`Facture ${invoice.invoice_number}`} value={ticketUsd(invoice.total_usd)} bold />
          <div className="pl-[1.5ch]">
            {invoice.deposit_usd > 0.009 && <><Row label="Acompte versé" value={"-" + ticketUsd(invoice.deposit_usd)} /><Row label="Solde facturé" value={ticketUsd(invoice.payable_usd)} /></>}
            <Row label="Équivalent HTG" value={ticketHtg(invoice.payable_htg)} />
            <Row label="Payé" value={ticketUsd(invoice.paid_usd)} />
            <Row label="Reste" value={ticketUsd(invoice.remaining_usd)} />
            <Row label="Statut" value={invoice.payment_status || "—"} />
            {invoice.payments.map((payment, index) => <div key={index} className="mt-1">
              <Row label={payment.method} value={ticketAmount(payment.amount, payment.currency)} />
              <p className="pl-[1ch]">{ticketShortDateTime(payment.created_at)}{payment.received_by ? " · " + payment.received_by : ""}</p>
              {payment.reference && <p className="break-all pl-[1ch]">Réf : {payment.reference}</p>}
            </div>)}
          </div>
        </div>)}</div>
        <Rule />
      </>}

      <Row label="Total facturé" value={ticketUsd(t.totals.payable_usd)} bold />
      <Row label="" value={ticketHtg(t.totals.payable_htg)} />
      <Row label="Total payé" value={ticketUsd(t.totals.paid_usd)} bold />
      <Row label="Solde restant" value={ticketUsd(t.totals.remaining_usd)} bold />
      <p className="my-1.5 overflow-hidden whitespace-nowrap text-center font-bold">****** REMISE CONFIRMÉE ******</p>
      <p>Remis par : {t.delivered_by || "—"}</p>
      <p>Imprimé par : {t.printed_by || "—"}</p>
      <p>Le : {ticketDateTime(t.printed_at)}</p>
      <Rule />

      {qr && <svg viewBox={`0 0 ${qr.length + 8} ${qr.length + 8}`} className="mx-auto block" style={{ width: width === 80 ? "32mm" : "27mm", height: width === 80 ? "32mm" : "27mm" }} shapeRendering="crispEdges" aria-label="QR code du ticket"><rect width="100%" height="100%" fill="#fff" /><path d={qrSvgPath(qr)} fill="#000" /></svg>}
      <p className="mt-1 text-center font-bold">Code de sécurité : {t.security_code}</p>
      <Rule />

      <p className="mt-4">Signature du client :</p>
      <div className="mt-7 border-b border-black" />
      <p className="mt-1.5 text-center" style={{ fontSize: "0.9em" }}>Le client confirme avoir reçu les colis ci-dessus en bon état.</p>
      <p className="mt-1.5 text-center font-bold">MERCI DE VOTRE CONFIANCE !</p>
      <p className="text-center" style={{ fontSize: "0.9em" }}>Conservez ce ticket comme preuve de remise.</p>
    </article>
  </div>;
}

function Rule() {
  return <div className="my-1.5 border-t border-dashed border-black" />;
}

function Row({ label, value, bold }: { label: ReactNode; value: string; bold?: boolean }) {
  return <div className={`flex items-start justify-between gap-2 ${bold ? "font-bold" : ""}`}><span className="min-w-0">{label}</span><span className="shrink-0 text-right">{value}</span></div>;
}
