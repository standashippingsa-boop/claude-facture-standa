"use client";
import { use, useEffect, useRef, useState } from "react";
import Loader, { BusyButton, Spinner } from "@/components/Loader";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Calculator, FileText, PackageCheck, Pencil, Upload, X, Trash2, Printer } from "lucide-react";
import ClientEditDialog from "@/components/ClientEditDialog";
import ClientSendPanel from "@/components/ClientSendPanel";
import StatusBadge from "@/components/StatusBadge";
import RefreshButton from "@/components/RefreshButton";
import FilterConsole from "@/components/FilterConsole";
import { usePackageSelection } from "@/lib/selection";
import {
  commitPdfImport, detachPackagesFromInvoice, hardDeletePackage, getClient, getClientPackagesAndInvoices, getClientRetraits, getConduces,
  getInvoiceFlags, getSettings, getUsdRate, logAction, setPackagesStatus, setRetraitStatus, updatePackagePrice, notifyEmail
} from "@/lib/db";
import { useRole } from "@/lib/authx";
import { parseMcpackPdf, PdfPkgRow } from "@/lib/pdfimport";
import { computePrice, round2, villeForClient } from "@/lib/pricing";
import InvoiceDialog from "@/components/InvoiceDialog";
import TimeSeriesBarChart from "@/components/TimeSeriesBarChart";
import { bucketByMonth, peakIndex } from "@/lib/dashboard-charts";
import { Client, INTERNAL_STATUSES, Invoice, Pkg } from "@/lib/types";
import { dateFr, sortPackagesAvailableFirst, usd } from "@/lib/utils";
import { returnToOr, useRememberListContext, withReturnTo } from "@/lib/list-context";
import { specialPackageInfo } from "@/lib/special-package";

import { useNoticeToast } from "@/lib/notify";
import { RemiseTicketOverlay } from "@/components/RemiseTicketPage";
type SelPkg = Pkg & { selected?: boolean };

/**
 * DOSYE KLIYAN (V7.2) — tout enfòmasyon + tout operasyon koli yo yon sèl kote:
 * seleksyon, tarification, chanjman statut (Disponible/Livré...), facturation.
 * Admin AK Employé ka fè operasyon sa yo (Paramètres sèlman ki rezève admin).
 */
export default function ClientDossier({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const decoded = decodeURIComponent(code);
  const searchParams = useSearchParams();
  const router = useRouter();
  const backHref = returnToOr(searchParams.get("returnTo"), "/clients");
  const [client, setClient] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState(false);
  const [pkgs, setPkgs] = useState<SelPkg[]>([]);
  const [invs, setInvs] = useState<Invoice[]>([]);
  /** Nimewo Conduce pa id — pou montre nan ki Conduce chak koli ye. */
  const [conduceNumbers, setConduceNumbers] = useState<Map<string, string>>(new Map());
  const [rate, setRate] = useState(132);
  const [footer, setFooter] = useState("Mèsi paske ou fè STANDA COMMERCIAL konfyans.");
  const [bulkStatus, setBulkStatus] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("");
  const [dateF, setDateF] = useState("");
  const [specialF, setSpecialF] = useState("");
  const [minWeight, setMinWeight] = useState("");
  const [maxWeight, setMaxWeight] = useState("");
  useRememberListContext(`client-dossier:${decoded}`, { search, statusF, dateF, specialF, minWeight, maxWeight }, (saved) => {
    const text = (name: string) => typeof saved[name] === "string" ? saved[name] : "";
    setSearch(text("search")); setStatusF(text("statusF")); setDateF(text("dateF"));
    setSpecialF(text("specialF")); setMinWeight(text("minWeight")); setMaxWeight(text("maxWeight"));
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [ticketPackageId, setTicketPackageId] = useState<string | null>(null);
  useNoticeToast(notice, setNotice);
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
      setNotice(`✅ Import PDF : ${r.created} créés, ${r.updated} mis à jour, ${r.ignored} ignorés.`);
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
    getConduces().then((list) => setConduceNumbers(new Map(list.map((conduce) => [conduce.id, conduce.conduce_number])))).catch(() => undefined);
    const { pkgs: p, invs: i } = await getClientPackagesAndInvoices(decoded);
    setPkgs(sortPackagesAvailableFirst(p));
    setInvs(i);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [decoded]);
  // Kenbe panèl seleksyon global la enfòme (DWE anvan nenpòt return kondisyonèl)
  useEffect(() => { if (pkgs.length) sel.hydrate(pkgs.map(snap)); /* eslint-disable-next-line */ }, [pkgs]);

  const visible = sortPackagesAvailableFirst(pkgs.filter((p) => {
    if (p.status === "Livré") return false;
    const q = search.trim().toLowerCase();
    if (statusF && p.status !== statusF) return false;
    if (dateF && !String(p.created_date ?? "").includes(dateF)) return false;
    const special = specialPackageInfo(p).isSpecial;
    if (specialF === "special" && !special) return false;
    if (specialF === "regular" && special) return false;
    if (minWeight && (Number(p.weight) || 0) < Number(minWeight)) return false;
    if (maxWeight && (Number(p.weight) || 0) > Number(maxWeight)) return false;
    return !q || [p.tracking_number, p.tracking_manual, p.content, p.status].some((value) => String(value ?? "").toLowerCase().includes(q));
  }));
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
  const clearFilters = () => { setSearch(""); setStatusF(""); setDateF(""); setSpecialF(""); setMinWeight(""); setMaxWeight(""); };

  // ===== Estatistik =====
  const totalLbs = round2(pkgs.reduce((s, p) => s + p.weight, 0));
  const totalFacture = round2(invs.reduce((s, i) => s + Number(i.grand_total ?? 0), 0));
  const lastInvoiceAt = invs.reduce((latest, i) => String(i.created_at ?? "") > latest ? String(i.created_at) : latest, "");
  const nonFacture = round2(visible.filter((p) => p.status === "Disponible")
    .reduce((s, p) => s + p.price_usd + p.tax_usd, 0));

  // ===== Aktivite pa mwa — menm dat ak grafik dashboard la (resepsyon Miami, sinon antre nan sistèm nan) =====
  const activitySeries = bucketByMonth(pkgs.map((p) => p.received_at ?? (p as { created_at?: string }).created_at ?? p.created_date), 12);
  const activityPeak = activitySeries[peakIndex(activitySeries)];

  // ===== Tarification (menm règ ak paj Packages) =====
  const applyTarif = async () => {
    if (!client?.ville) { setNotice("Kliyan sa a poko gen vil tarification · Modifye l nan Clients."); return; }
    const targets = (selected.length ? selected : visible).filter((p) => p.status === "Disponible");
    if (!targets.length) { setNotice("Pa gen koli Disponible pou tarife."); return; }
    setBusy(true);
    try {
      for (const p of targets) {
        const r = computePrice(p.weight, client.account_type, villeForClient(client));
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
      `Client : ${p.customer_code} · ${p.customer_name}\n` +
      `Statut : ${p.status}\n\n` +
      `➜ Le colis sera retiré de TOUT le système.\n` +
      `➜ Sa ligne de facture sera retirée ; la facture sera recalculée ou supprimée si vide.\n` +
      `➜ CETTE ACTION EST IRRÉVERSIBLE.\n\n` +
      `Vous pourrez le réimporter depuis MCPACK.`
    )) return;
    if (!confirm(`Dernière confirmation · supprimer ${p.tracking_number} définitivement ?`)) return;
    setBusy(true); setBusyId(p.id);
    try {
      const r = await hardDeletePackage(p.id);
      if (!r.ok) { setNotice("Erè: " + (r.reason ?? "inconnue")); return; }
      setNotice(`🗑 Colis ${p.tracking_number} supprimé définitivement` +
        (r.invoiceDeleted ? " · facture devenue vide supprimée." : "."));
      await load();
    } catch (e: any) {
      setNotice("Erè: " + (e?.message ?? String(e)));
    } finally { setBusy(false); setBusyId(null); }
  };

  // ===== Chanjman statut (ak email Reçu à Miami / Disponible) =====
  const appliquerStatut = async () => {
    if (!bulkStatus || !selected.length) return;
    // "Facturé" -> "Disponible" = koreksyon erè: detache fakti a kòrèkteman
    const factures = selected.filter((p) => p.status === "Facturé");
    if (bulkStatus === "Disponible" && factures.length) {
      if (!confirm(
        `${factures.length} colis déjà facturé(s) vont être retirés de leur facture.\n\n` +
        `➜ Ils redeviendront « Disponible » et pourront être refacturés.\n` +
        `➜ La facture sera recalculée ou supprimée si elle devient vide.\n` +
        `➜ Opération enregistrée dans l'audit.`
      )) return;
      setBusy(true);
      try {
        const r = await detachPackagesFromInvoice(factures.map((p) => p.id));
        if (!r.ok) { setNotice("Erè: " + (r.reason ?? "inconnue")); setBusy(false); return; }
        setNotice(`✅ ${r.detached} colis remis en « Disponible » · rien n'est supprimé, ils restent dans le système.` +
          (r.invoicesDeleted ? ` ${r.invoicesDeleted} facture(s) vide(s) supprimée(s).` : ""));
        // GAD: si yon filtè Statut aktif ap kache koli nou fèk chanje yo,
        // chanje filtè a pou yo rete VIZIB — yo pa dwe sanble disparèt.
        if (statusF && statusF !== "Disponible") setStatusF("Disponible");
        await load();
      } catch (e: any) {
        setNotice("Erè: " + (e?.message ?? String(e)));
      } finally { setBusy(false); }
      return;
    }
    const targets = selected.filter((p) => p.status !== "Facturé" || bulkStatus === "Livré");
    if (!targets.length) { setNotice("Chwazi koli."); return; }
    // Garde-fou : remettre un colis jamais facturé le fait sortir de la liste
    // à facturer. On demande une confirmation explicite.
    if (bulkStatus === "Livré") {
      const nonFactures = targets.filter((p) => !p.invoice_id);
      if (nonFactures.length && !confirm(
        `Attention : ${nonFactures.length} colis sélectionné(s) ne sont PAS encore facturés.\n\n` +
        `Si vous continuez, ils passeront en « Livré » et ne seront plus proposés à la facturation.\n\n` +
        `Confirmer la remise sans facture ?`
      )) return;
    }
    setBusy(true);
    try {
      await setPackagesStatus(targets.map((p) => p.id), bulkStatus);
      if (bulkStatus === "Livré") {
        await logAction("Remise colis", `${targets.length} colis remis au client par l'administration`, targets[0]?.tracking_number ?? "", decoded);
        sel.setMany(targets.map(snap), false);
        // Pour l'administration le ticket n'est pas obligatoire (il l'est pour les
        // agents de retrait) : on demande. Il reste imprimable plus tard depuis
        // le bouton « Ticket » de chaque colis livré.
        setNotice(`Statut "Livré" aplike sou ${targets.length} colis.`);
        await load();
        if (confirm(`Remise enregistrée (${targets.length} colis).\n\nSortir le ticket de remise maintenant ?`)) {
          setTicketPackageId(targets[0].id);
        }
        return;
      }
      let mailInfo = "";
      // Sans email, le client reçoit quand même l'alerte sur son téléphone :
      // le serveur envoie le push et ignore seulement l'email.
      if ((bulkStatus === "Reçu à Miami" || bulkStatus === "Disponible") && client?.customer_code) {
        try {
          const j = await notifyEmail({
            type: bulkStatus === "Reçu à Miami" ? "recu_miami" : "disponible",
            client: { name: [client.fullname, client.surname].filter(Boolean).join(" "),
              code: client.customer_code, ville: client.ville?.name ?? "", email: client.email || undefined },
            packages: targets.map((p) => ({
              tracking_number: p.tracking_number, tracking_manual: p.tracking_manual,
              content: p.content, weight: p.weight,
              fournisseur: p.mcpack_data?.["Proveedor"] ?? ""
            }))
          });
          const phone = ` Notifikasyon telefòn: ${j.pushSent ?? 0} aparèy.`;
          mailInfo = (j.ok ? " Email voye." : client.email ? ` ⚠️ Email: ${j.reason ?? j.error ?? "echwe"}` : " Kliyan san imèl.") + phone;
          if (!j.ok && client.email) {
            await logAction("Notification courriel échouée",
              `${bulkStatus} · ${client.customer_code}: ${j.error ?? j.reason ?? "echwe"}`,
              "", client.customer_code);
          }
        } catch { mailInfo = " ⚠️ Email pa pati."; }
      }
      // GAD: si yon filtè Statut aktif ap kache koli nou fèk chanje yo,
      // chanje filtè a pou yo rete VIZIB — yo pa dwe sanble disparèt.
      if (statusF && statusF !== bulkStatus) setStatusF(bulkStatus);
      setNotice(`✅ ${targets.length} colis passés à "${bulkStatus}" · rien n'est supprimé, ils restent dans le système.` + mailInfo);
      setBulkStatus("");
      await load();
    } catch (e: any) { setNotice("Erè: " + e.message); }
    finally { setBusy(false); }
  };

  // ===== Facturation — MÊME fenêtre partagée que Packages =====
  const [showInvoice, setShowInvoice] = useState(false);
  // ===== Demande de retrait (lyen "Préparer" nan paj Retraits) =====
  // Koli demann lan seleksyone otomatikman; apre fakti a, demann lan pase "Préparé".
  const retraitId = searchParams.get("retrait");
  const retraitApplied = useRef(false);
  const [retraitCount, setRetraitCount] = useState<number | null>(null);
  useEffect(() => {
    if (!retraitId || retraitApplied.current || !pkgs.length) return;
    retraitApplied.current = true;
    getClientRetraits(decoded).then((list) => {
      const retrait = list.find((r) => r.id === retraitId);
      if (!retrait) { setNotice("Demande de retrait introuvable pour ce client."); return; }
      const trackings = new Set((retrait.items ?? []).map((item) => item.tracking_number));
      const wanted = pkgs.filter((p) => trackings.has(p.tracking_number) && p.status === "Disponible");
      // Sèl koli demann lan rete seleksyone pou kliyan sa a, epi okenn filtè pa kache yo.
      clearFilters();
      sel.setMany(pkgs.map(snap), false);
      sel.setMany(wanted.map(snap), true);
      setRetraitCount(wanted.length);
    }).catch((e: unknown) => setNotice("Erè: " + (e as Error).message));
    /* eslint-disable-next-line */
  }, [retraitId, pkgs]);
  const apresFacture = async (msg: string) => {
    if (!retraitId || retraitCount === null) { setNotice(msg); await load(); return; }
    try {
      await setRetraitStatus(retraitId, "Préparé");
      setNotice(msg + " Demande de retrait marquée « Préparé ».");
    } catch {
      setNotice(msg + " La facture est créée, mais le statut de la demande doit être actualisé.");
    }
    setRetraitCount(null);
    await load();
  };

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
        <Link href={backHref} className="btn btn-ghost !px-2.5" title="Retour à la liste précédente"><ArrowLeft size={16} /></Link>
        <h1 className="text-xl font-extrabold text-navy">{client.customer_code} · {non}</h1>
        <span className={`badge ${client.account_status === "Actif" || !client.account_status
          ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
          {client.account_status ?? "Actif"}</span>
        <span className="badge bg-slate-100 text-slate-600">{client.account_type}</span>
        <button type="button" className="btn btn-ghost border border-line !px-2.5" title="Modifier les informations du client"
          onClick={() => setEditingClient(true)}><Pencil size={15} /> Modifier</button>
      </div>
      {editingClient && (
        <ClientEditDialog client={client} onClose={() => setEditingClient(false)}
          onSaved={(newCode, message) => {
            setEditingClient(false);
            setNotice(message);
            if (newCode && newCode !== client.customer_code) {
              router.replace(withReturnTo(`/clients/${encodeURIComponent(newCode)}`, backHref));
            } else void load();
          }} />
      )}

      <ClientSendPanel client={client} onNotice={setNotice} />

      {/* ===== Enfòmasyon + estatistik ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="card p-4 lg:col-span-2">
          <h2 className="text-xs font-bold text-navy uppercase tracking-wide mb-3">Informations client</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5 text-xs">
            {([["Téléphone", client.phone], ["WhatsApp", client.whatsapp], ["Email", client.email],
               ["Pays", client.country], ["Ville", [client.city, client.city2].filter(Boolean).join(" / ") || client.ville?.name],
               ["Ville tarifaire", client.ville?.name], ["Adresse", client.address],
               ["Pièce", `${client.id_type ?? ""} ${client.id_number ?? ""}`.trim()],
               ["Username", client.username]] as const).map(([k, v]) => (
              <div key={k}><span className="text-slate-400">{k}:</span>{" "}
                <span className="font-semibold">{v || "·"}</span></div>
            ))}
          </div>
        </section>
        <section className="card p-4 grid grid-cols-2 gap-3 text-center">
          {[["Total des colis", pkgs.length], ["Livrés", livres.length],
            ["Poids total (lb)", totalLbs.toFixed(2)],
            ["Total facturé", usd(totalFacture)],
            ["Disponible à facturer", usd(nonFacture)],
            ["Factures", invs.length]].map(([k, v]) => (
            <div key={String(k)} className="bg-mist rounded-lg py-2 px-1">
              <p className="text-[10px] text-slate-500 uppercase">{k}</p>
              <p className="text-sm font-extrabold text-navy">{v}</p>
            </div>
          ))}
        </section>
      </div>

      {/* ===== Aktivite kliyan an mwa pa mwa (12 dènye mwa) ===== */}
      <section className="card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xs font-bold text-navy uppercase tracking-wide">Activité par mois</h2>
          <p className="text-xs text-mute">
            {activityPeak
              ? <>Mois le plus actif : <b className="text-ink">{activityPeak.label}</b> · <b className="text-ink">{activityPeak.value} colis</b></>
              : "Aucun colis sur les 12 derniers mois."}
          </p>
        </div>
        <div className="mt-3"><TimeSeriesBarChart series={activitySeries} color="#122B5C" height={120} /></div>
      </section>

      {retraitCount !== null && (
        <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-navy">
          {retraitCount > 0
            ? <><b>Demande de retrait</b> · {retraitCount} colis sélectionné(s). Cliquez sur <b>Générer la facture</b> pour préparer le retrait.</>
            : <><b>Demande de retrait</b> · aucun colis de cette demande n&apos;est encore « Disponible » et non facturé.</>}
        </p>
      )}

      {/* ===== Operasyon sou koli yo ===== */}
      <div className="flex gap-2 flex-wrap items-center">
        <RefreshButton onRefresh={load} />
        <BusyButton className="btn btn-ghost border border-line" onClick={applyTarif} busy={busy}>
          <Calculator size={14} /> Appliquer tarification
        </BusyButton>
        <select className="input !w-44 !py-1.5 !text-xs" value={bulkStatus}
          onChange={(e) => setBulkStatus(e.target.value)}>
          <option value="">Changer statut</option>
          {[...INTERNAL_STATUSES, "Livré"].filter((s, i, a) => a.indexOf(s) === i)
            .map((s) => <option key={s}>{s}</option>)}
        </select>
        <BusyButton className="btn !bg-emerald-600 hover:!bg-emerald-700" onClick={appliquerStatut}
          busy={busy} disabled={!bulkStatus || !selected.length}>
          <PackageCheck size={14} /> Appliquer ({selected.length})
        </BusyButton>
        <button className="btn" onClick={facturer} disabled={busy || !selectedDisponible.length}>
          <FileText size={14} /> Générer la facture ({selectedDisponible.length})
        </button>
        <label className="btn btn-ghost border border-line cursor-pointer">
          <Upload size={14} /> Importer PDF
          <input type="file" accept="application/pdf,.pdf" className="hidden"
            onChange={(e) => e.target.files?.[0] && handlePdf(e.target.files[0])} />
        </label>
      </div>

      <FilterConsole query={search} onQueryChange={setSearch} queryPlaceholder="Tracking, contenu, statut…"
        resultCount={visible.length} onClear={clearFilters}
        selection={{ selectedCount: selected.length, allSelected: visible.length > 0 && visible.every((p) => sel.has(p.id)), onToggleAll: () => {
          const allVisible = visible.length > 0 && visible.every((p) => sel.has(p.id));
          toggleAll(!allVisible);
        }, label: "Sélectionner les colis filtrés" }}
        fields={[
          { key: "status", label: "Statut", type: "select", value: statusF, onChange: setStatusF, options: Array.from(new Set(pkgs.filter((p) => p.status !== "Livré").map((p) => p.status))).sort((a, b) => a.localeCompare(b)).map((value) => ({ value, label: value })) },
          { key: "date", label: "Date", type: "text", value: dateF, onChange: setDateF, placeholder: "2026-09" },
          { key: "special", label: "Colis spécial", type: "select", value: specialF, onChange: setSpecialF, options: [{ value: "special", label: "Spécial" }, { value: "regular", label: "Normal" }] },
          { key: "min", label: "Poids min. (lb)", type: "number", value: minWeight, onChange: setMinWeight, min: 0, step: 0.01 },
          { key: "max", label: "Poids max. (lb)", type: "number", value: maxWeight, onChange: setMaxWeight, min: 0, step: 0.01 },
        ]} />

      {/* ===== Koli yo ===== */}
      <section className="card overflow-x-auto">
        <h2 className="text-xs font-bold text-navy uppercase tracking-wide p-3 pb-1">
          Colis · {visible.length} aktif{livres.length ? ` · ${livres.length} livré nan Historique` : ""}
        </h2>
        <table className="w-full text-xs">
          <thead><tr>
            <th className="thc"><input type="checkbox" checked={allChecked} onChange={(e) => toggleAll(e.target.checked)} /></th>
            {["Tracking ID", "Tracking Number", "Date", "Lb", "Content", "Price $", "Total $", "Status", ""]
              .map((h) => <th key={h} className="thc">{h}</th>)}
          </tr></thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-8 text-slate-400">Pa gen koli aktif.</td></tr>
            ) : visible.map((p, i) => {
              const special = specialPackageInfo(p);
              return (
              <tr key={p.id} className={`${i % 2 ? "bg-mist" : ""} ${sel.has(p.id) ? "!bg-blue-50" : ""}`}>
                <td className="tdc"><input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} /></td>
                <td className="tdc font-mono text-[11px]" title={p.conduce_id && conduceNumbers.get(p.conduce_id) ? `Conduce ${conduceNumbers.get(p.conduce_id)}` : "Sans conduce"}>
                  {p.tracking_number}
                  {p.conduce_id && conduceNumbers.get(p.conduce_id)
                    ? <span className="mt-0.5 block font-sans text-[10px] font-bold text-violet-700">Conduce {conduceNumbers.get(p.conduce_id)}</span>
                    : <span className="mt-0.5 block font-sans text-[10px] text-slate-400">Sans conduce</span>}
                </td>
                <td className="tdc font-mono text-[11px]">{p.tracking_manual || <span className="text-slate-300">·</span>}</td>
                <td className="tdc whitespace-nowrap">{p.created_date}</td>
                <td className="tdc text-right">{p.weight}</td>
                <td className="tdc max-w-[180px]" title={special.isSpecial ? `${p.content}\nRaison : ${special.reason}` : p.content}>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1">
                      {special.isSpecial && <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">* Spécial</span>}
                      <span className="truncate">{p.content}</span>
                    </div>
                    {special.isSpecial && <p className="truncate text-[10px] text-amber-800" title={special.reason}>Raison : {special.reason}</p>}
                  </div>
                </td>
                <td className="tdc text-right">{usd(p.price_usd)}</td>
                <td className="tdc text-right font-semibold">{usd(p.total_usd)}</td>
                <td className="tdc"><StatusBadge status={p.status} /></td>
                <td className="tdc whitespace-nowrap">
                  {p.status === "Livré" && (
                    <button type="button" className="mr-2 inline-flex items-center gap-1 rounded-md bg-navy px-2 py-1 text-[11px] font-bold text-white hover:bg-navy-light"
                      title="Ticket de remise" onClick={() => setTicketPackageId(p.id)}><Printer size={12} /> Ticket</button>
                  )}
                  {role === "admin" && (
                    <button className="text-slate-300 hover:text-red-600 disabled:opacity-50"
                      title="Supprimer définitivement"
                      disabled={busyId === p.id}
                      onClick={() => supprimerDefinitif(p)}>{busyId === p.id ? <Spinner size={14} /> : <Trash2 size={14} />}</button>
                  )}
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </section>

      {/* ===== Fakti: yon bouton ki mennen sou paj Factures la, filtre sou kliyan sa a
          (voir, PDF, paiement, clôture — tout aksyon fakti yo rete yon sèl kote). ===== */}
      <section className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-bold text-navy uppercase tracking-wide">Factures du client</h2>
          <p className="mt-1 text-sm text-slate-600">
            {invs.length
              ? <>{invs.length} facture{invs.length > 1 ? "s" : ""} · {usd(totalFacture)} au total{lastInvoiceAt ? ` · dernière le ${dateFr(lastInvoiceAt)}` : ""}</>
              : "Aucune facture pour ce client."}
          </p>
        </div>
        {client?.customer_code && (
          <Link href={`/invoices?client=${encodeURIComponent(client.customer_code)}`} className="btn">
            <FileText size={14} /> Voir les factures{invs.length ? ` (${invs.length})` : ""}
          </Link>
        )}
      </section>

      {/* ===== Modal: apèsi Import PDF pou kliyan sa a ===== */}
      {pdfRows && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setPdfRows(null)}>
          <div className="card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-navy uppercase tracking-wide">
                Import PDF{pdfRows.length} colis pour {client.customer_code}
              </h2>
              <button className="text-slate-400 hover:text-navy" onClick={() => setPdfRows(null)}><X size={18} /></button>
            </div>
            <div className="border border-line rounded-lg overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0"><tr>
                  {["Tracking ID", "Tracking Number", "Lb", "Contenu", "Date", "Heure", "Estatus"]
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
              <BusyButton className="btn" onClick={validerPdf} busy={busy} busyLabel="Import en cours…">
                {`Importer ${pdfRows.length} colis`}
              </BusyButton>
              <button className="btn btn-ghost" onClick={() => setPdfRows(null)}>Annuler</button>
            </div>
            <p className="text-[11px] text-slate-400">
              Guía = Tracking ID. Lòt kòd yo = Tracking Number. Anti-doublon aktif.
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
          onDone={apresFacture}
        />
      )}

      {ticketPackageId && <RemiseTicketOverlay packageId={ticketPackageId} onClose={() => setTicketPackageId(null)} />}
    </div>
  );
}
