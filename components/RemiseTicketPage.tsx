"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileDown, LoaderCircle, Printer, Scissors, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { notify } from "@/lib/notify";
import { printDocument, printUnsupported } from "@/lib/print";
import { MessageScreen } from "@/components/Toaster";
import {
  generateRemiseTicketPdf, qrSvgPath, ticketAmount, ticketDateTime, ticketHtg, ticketQrMatrix,
  ticketShortDateTime, ticketUsd, type RemiseTicket, type TicketWidth
} from "@/lib/remise-ticket";

const WIDTH_KEY = "standa:ticket-width";

/**
 * TICKET DE REMISE — même composant pour l'administration (/ticket-remise),
 * l'agent (/espace-remise/ticket) et la fenêtre qui s'ouvre juste après une
 * remise (RemiseTicketOverlay). L'aperçu montre le ticket exactement comme il
 * sortira de l'imprimante thermique (80 mm ou 58 mm). « Imprimer » envoie
 * SEULEMENT le ticket à l'imprimante — y compris dans l'application Android
 * « Standa Agence », via son pont d'impression natif (lib/print.ts).
 */
export default function RemiseTicketPage({ packageId, backHref, autoPrint }: { packageId: string; backHref: string; autoPrint: boolean }) {
  const router = useRouter();
  // Même fenêtre plein écran que l’aperçu après remise : à l’impression, seul le ticket sort (pas de pages blanches).
  return <RemiseTicketOverlay packageId={packageId} autoPrint={autoPrint} closeLabel="Retour" onClose={() => router.push(backHref)} />;
}

/** Fenêtre plein écran au-dessus de la page, ouverte juste après une remise ou depuis l'historique. */
export function RemiseTicketOverlay({ packageId, onClose, autoPrint = false, closeLabel = "Fermer" }: { packageId: string; onClose: () => void; autoPrint?: boolean; closeLabel?: string }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);
  return <div className="remise-ticket-portal fixed inset-0 z-[150] overflow-y-auto bg-slate-100" role="dialog" aria-modal="true" aria-label="Ticket de remise">
    <RemiseTicketView packageId={packageId} autoPrint={autoPrint} closeLabel={closeLabel} onClose={onClose} inOverlay />
  </div>;
}

function RemiseTicketView({ packageId, autoPrint, closeLabel, onClose, inOverlay = false }: {
  packageId: string; autoPrint: boolean; closeLabel: string; onClose: () => void; inOverlay?: boolean;
}) {
  const [ticket, setTicket] = useState<RemiseTicket | null>(null);
  const [qr, setQr] = useState<boolean[][] | null>(null);
  const [error, setError] = useState("");
  const [width, setWidth] = useState<TicketWidth>(80);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pageHeight, setPageHeight] = useState(0);
  const [inWebView, setInWebView] = useState(false);
  const printed = useRef(false);
  const ticketRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setInWebView(/\bwv\b/.test(navigator.userAgent));
    try { if (window.localStorage.getItem(WIDTH_KEY) === "58") setWidth(58); } catch { /* préférence optionnelle */ }
  }, []);

  const chooseWidth = (value: TicketWidth) => {
    setWidth(value);
    try { window.localStorage.setItem(WIDTH_KEY, String(value)); } catch { /* préférence optionnelle */ }
  };

  useEffect(() => {
    let cancelled = false;
    setTicket(null); setError("");
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

  // Hauteur de page = hauteur du ticket (mm) : le rouleau est coupé
  // exactement à la fin du ticket, sans page blanche.
  useEffect(() => {
    const node = ticketRef.current;
    if (!ticket || !node) return;
    const measure = () => setPageHeight(Math.ceil(node.getBoundingClientRect().height * 25.4 / 96) + 6);
    measure();
    const images = Array.from(node.querySelectorAll("img"));
    images.forEach((image) => image.addEventListener("load", measure));
    return () => images.forEach((image) => image.removeEventListener("load", measure));
  }, [ticket, qr, width]);

  const print = () => {
    if (!printDocument(`Ticket ${ticket?.ticket_number ?? "STANDA"}`)) {
      notify.warning("Cette version de l’application Standa Agence ne sait pas encore imprimer. Installez la nouvelle version de l’application, ou ouvrez le point de retrait dans Chrome pour imprimer.", { title: "Impression indisponible" });
    }
  };

  useEffect(() => {
    if (!ticket || !pageHeight || !autoPrint || printed.current || printUnsupported()) return;
    printed.current = true;
    const timer = window.setTimeout(print, 700);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket, pageHeight, autoPrint]);

  const downloadPdf = async () => {
    if (!ticket || pdfBusy) return;
    setPdfBusy(true);
    try { await generateRemiseTicketPdf(ticket, width); }
    catch { notify.error("PDF indisponible pour le moment. Utilisez « Imprimer ».", { title: "PDF indisponible" }); }
    finally { setPdfBusy(false); }
  };

  if (!ticket && !error) return <div className="grid min-h-[70vh] place-items-center"><LoaderCircle className="animate-spin text-navy" size={34} /></div>;
  if (!ticket) return <div className="mx-auto max-w-xl px-3 py-6"><MessageScreen tone="error" title="Ticket indisponible" text={error} actionLabel={closeLabel} onAction={onClose} /></div>;

  const t = ticket;
  const paperWidth = width === 80 ? "72mm" : "50mm";
  return <div className="mx-auto max-w-xl space-y-4 px-3 py-4 print:m-0 print:max-w-none print:p-0">
    <style jsx global>{`
      @media print {
        @page { size: ${width}mm ${pageHeight || 297}mm; margin: 0; }
        html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
        ${inOverlay ? "body *:not(:has(#remise-ticket)):not(#remise-ticket):not(#remise-ticket *) { display: none !important; } body *:has(#remise-ticket) { position: static !important; overflow: visible !important; height: auto !important; min-height: 0 !important; max-height: none !important; margin: 0 !important; padding: 0 !important; background: #fff !important; transform: none !important; box-shadow: none !important; }" : ""}
        body * { visibility: hidden; }
        #remise-ticket, #remise-ticket * { visibility: visible; }
        #remise-ticket { position: absolute; left: 0; top: 0; margin: 0 !important; box-shadow: none !important; border: 0 !important; }
        .ticket-edge { display: none !important; }
      }
    `}</style>

    <div className="sticky top-0 z-10 -mx-3 space-y-3 bg-slate-100/95 px-3 pb-3 pt-1 backdrop-blur print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-navy hover:bg-slate-50">{inOverlay ? <X size={17} /> : <ArrowLeft size={17} />} {closeLabel}</button>
        <div className="flex flex-wrap gap-2">
          {!inWebView && <button type="button" onClick={() => void downloadPdf()} disabled={pdfBusy} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-navy hover:bg-slate-50">{pdfBusy ? <LoaderCircle className="animate-spin" size={17} /> : <FileDown size={17} />} PDF</button>}
          <button type="button" onClick={print} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#e85e19] px-4 text-sm font-black text-white shadow-sm hover:bg-[#ce4e0d]"><Printer size={18} /> Imprimer le ticket</button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">
        <span className="font-semibold text-slate-600">Papier de l’imprimante</span>
        <div className="flex gap-1">{([80, 58] as TicketWidth[]).map((value) => <button key={value} type="button" aria-pressed={width === value} onClick={() => chooseWidth(value)} className={`rounded-lg px-3 py-1.5 font-bold ${width === value ? "bg-[#09295e] text-white" : "bg-slate-100 text-slate-700"}`}>{value} mm</button>)}</div>
      </div>
      <p className="text-center text-xs font-semibold text-slate-500">Aperçu : voici le ticket exactement comme il sortira de l’imprimante ({width} mm).</p>
    </div>

    <div className="rounded-3xl bg-slate-200/70 px-2 py-6 print:bg-transparent print:p-0">
      <div className="ticket-edge mx-auto flex items-center justify-center gap-1 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400" style={{ width: paperWidth }}><Scissors size={12} /> début du rouleau</div>
      <article id="remise-ticket" ref={ticketRef} className="mx-auto bg-white text-black shadow-[0_10px_30px_rgba(15,23,42,0.18)]"
        style={{ width: paperWidth, padding: width === 80 ? "4mm" : "2.5mm", boxSizing: "content-box", fontFamily: "'Courier New', Courier, monospace", fontSize: width === 80 ? "11.5px" : "10px", lineHeight: 1.35 }}>
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="mx-auto mb-1 object-contain grayscale" style={{ width: width === 80 ? 58 : 46, height: width === 80 ? 58 : 46 }} onError={(event) => { event.currentTarget.style.display = "none"; }} />
          <p className="font-bold" style={{ fontSize: "1.45em", letterSpacing: "0.02em" }}>{t.company.name}</p>
          <p>Expédition de colis USA → Haïti</p>
          <p>Tél / WhatsApp : {t.company.phone}</p>
          {t.company.email && <p className="break-all">{t.company.email}</p>}
          <p>{t.company.website}</p>
          {(t.point || t.agency) && <div className="mt-1.5">
            <p className="font-bold">Agence : {t.agency?.name || t.point}</p>
            {t.agency?.address && <p>{t.agency.address}</p>}
            {t.agency?.phone && t.agency.phone !== t.company.phone && <p>Tél agence : {t.agency.phone}</p>}
            {t.agency?.hours && <p>{t.agency.hours}</p>}
          </div>}
        </div>
        <Rule />
        <p className="text-center font-bold" style={{ fontSize: "1.2em" }}>TICKET DE REMISE</p>
        <p>Date : {ticketDateTime(t.delivered_at)}</p>
        <p>Ticket # : {t.ticket_number}</p>
        <Rule />

        <p className="font-bold">{t.customer.is_central ? "Compte central" : "CLIENT"}</p>
        <Row label="Code client" value={t.customer.code} bold />
        {t.customer.name && <p>Nom : {t.customer.name}</p>}
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
      <div className="ticket-edge mx-auto flex items-center justify-center gap-1 pt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400" style={{ width: paperWidth }}><Scissors size={12} /> coupe du papier</div>
    </div>
  </div>;
}

function Rule() {
  return <div className="my-1.5 border-t border-dashed border-black" />;
}

function Row({ label, value, bold }: { label: ReactNode; value: string; bold?: boolean }) {
  return <div className={`flex items-start justify-between gap-2 ${bold ? "font-bold" : ""}`}><span className="min-w-0">{label}</span><span className="shrink-0 text-right">{value}</span></div>;
}
