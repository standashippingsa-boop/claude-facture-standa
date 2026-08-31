"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calculator, ClipboardList, FileText, FileSpreadsheet, Archive, Camera, CheckCircle2, Lock, Package, PackageCheck, Puzzle, Receipt, Pencil, RotateCcw, MessageCircle, Trash2 } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import Pagination from "@/components/Pagination";
import WhatsAppQueue from "@/components/WhatsAppQueue";
import RefreshButton from "@/components/RefreshButton";
import { usePackageSelection } from "@/lib/selection";
import {
  ClientTarifInfo, archivePackage, unarchivePackage, getClient, getClientTarifMap,
  getPackages, getPackagesPage, getAllPackagesMatching, detachPackagesFromInvoice, hardDeletePackage, getSettings, getUsdRate,
  saveTrackingManual, setPackagesStatus, logAction, updatePackagePrice
} from "@/lib/db";
import { computePrice, round2 } from "@/lib/pricing";
import { computeInvoice, InvoiceComputation, verifyTotal } from "@/lib/invoice-engine";
import { Client, INTERNAL_STATUSES, Pkg } from "@/lib/types";
import { dateFr, htg, parseMcpackDate, usd } from "@/lib/utils";
import { generateBonRemise } from "@/lib/bonremise";
import { exportPackagesPdf } from "@/lib/listpdf";
import { exportPackagesExcel } from "@/lib/listexcel";
import InvoiceDialog from "@/components/InvoiceDialog";
import { useRole } from "@/lib/authx";

const PER_PAGE = 25;

/** Sous MILTIP yon koli — yon koli ka gen plizyè (Extension + Caribe + Facture). */
type SrcKey = "extension" | "caribe" | "facture";
const SRC_DEFS: { key: SrcKey; label: string; Icon: any; cls: string }[] = [
  { key: "caribe",    label: "Caribe Tours (scan photo)", Icon: Camera,  cls: "bg-rose-100 text-rose-700" },
  { key: "facture",   label: "Facture",                   Icon: Receipt, cls: "bg-emerald-100 text-emerald-700" },
  { key: "extension", label: "Extension MCPACK",          Icon: Puzzle,  cls: "bg-blue-100 text-blue-700" },
];
function pkgSources(p: Pkg): SrcKey[] {
  const out: SrcKey[] = [];
  if (p.src_caribe) out.push("caribe");
  if (p.src_facture) out.push("facture");
  if (p.src_extension) out.push("extension");
  // Fallback pou vye koli san drapo: dedwi depi received_method
  if (!out.length && p.received_method) {
    const m = p.received_method.toLowerCase();
    if (m.includes("photo") || m.includes("caribe")) out.push("caribe");
    else if (m.includes("facture") || m.includes("pdf")) out.push("facture");
    else if (m.includes("extension")) out.push("extension");
  }
  return out;
}

export default function PackagesEngine({ conduceId, hideHeader = false }: { conduceId?: string; hideHeader?: boolean } = {}) {
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [tarifMap, setTarifMap] = useState<Map<string, ClientTarifInfo>>(new Map());
  const [rate, setRate] = useState(0);
  const [bulkStatus, setBulkStatus] = useState("");
  const [footer, setFooter] = useState("Mèsi paske ou fè STANDA COMMERCIAL konfyans.");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");   // filtè Source/Provenance (pwen: idantifye Caribe Tours vs Facture)
  const [dateF, setDateF] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showWaQueue, setShowWaQueue] = useState(false);
  const { role, staff } = useRole();
  const staffName = staff ? `${staff.prenom ?? ""} ${staff.nom ?? ""}`.trim() || (staff.username ?? "") : "";
  const [showArchived, setShowArchived] = useState(false);
  const sel = usePackageSelection();
  /** Ti rezime koli a pou seleksyon global la (pa gen done sansib). */
  const snap = (p: Pkg) => ({
    id: p.id, tracking_number: p.tracking_number, customer_code: p.customer_code,
    customer_name: p.customer_name, weight: Number(p.weight) || 0,
    status: p.status, conduce_id: p.conduce_id ?? null,
  });
  // ===== Performance (pou 1000-5000+ koli) =====
  // Vi Conduce (conduceId) rete SAN CHANJE: chaje tout (bounded natirèlman, bulk actions pa afekte).
  // Vi global (Packages, san conduceId): pagination + rechèch SÈVÈ pa default.
  const [fullyLoaded, setFullyLoaded] = useState<boolean>(!!conduceId);
  const [total, setTotal] = useState(0);
  const [loadingPage, setLoadingPage] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);
  /** Kòd kliyan ki matche non/telefòn/vil pou rechèch (kalkile sou tarifMap, ki toujou konplè). */
  const matchingClientCodes = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return [] as string[];
    const codes: string[] = [];
    tarifMap.forEach((info, code) => {
      if ((info.fullname ?? "").toLowerCase().includes(q) ||
          (info.phone ?? "").toLowerCase().includes(q) ||
          (info.ville?.name ?? "").toLowerCase().includes(q)) codes.push(code);
    });
    return codes;
  }, [debouncedSearch, tarifMap]);
  // ===== Tooltip modèn sou tracking (pwen #2) =====
  const [hover, setHover] = useState<{ p: Pkg; ville: string; x: number; y: number } | null>(null);
  const joursDepot = (p: Pkg): number | null => {
    const ref = p.received_at || p.created_date;
    if (!ref) return null;
    const t = parseMcpackDate(ref) || new Date(ref).getTime();
    if (!t || isNaN(t)) return null;
    const d = Math.floor((Date.now() - t) / 86400000);
    return d >= 0 ? d : null;
  };
  const showTip = (p: Pkg, e: any) => setHover({
    p, ville: tarifMap.get(p.customer_code)?.ville?.name ?? "—", x: e.clientX, y: e.clientY
  });
  // Opsyon fakti — chak toggle endepandan (admin chwazi pou CHAK fakti)

  const loadSide = async () => {
    const [tm, r, s] = await Promise.all([getClientTarifMap(), getUsdRate(), getSettings()]);
    setTarifMap(tm);
    setRate(r);
    if (s.invoice_footer) setFooter(s.invoice_footer);
  };

  /** Vi Conduce (bounded) oswa "chaje tout" eksplisit — konpòtman idantik ak anvan. */
  const load = async () => {
    await loadSide();
    const p = await getPackages(undefined, showArchived, conduceId);
    setPkgs(p);
    setTotal(p.length);
  };

  /** Vi global (san conduceId): yon paj sèlman, filtre + pagine KOTE SÈVÈ a. */
  const fetchServerPage = async (pageNum: number) => {
    setLoadingPage(true);
    try {
      const { rows, total: t } = await getPackagesPage({
        search: debouncedSearch, matchingClientCodes, status,
        source: (source as any) || "", dateF, includeArchived: showArchived, conduceId
      }, pageNum, PER_PAGE);
      setPkgs(rows);
      setTotal(t);
    } catch (e: any) {
      setNotice("Erè bazdone: " + e.message);
    } finally { setLoadingPage(false); }
  };

  /** Rechaje done yo apre yon aksyon (fakti, elatriye) — respekte mòd aktyèl la. */
  const refresh = async () => (fullyLoaded ? load() : fetchServerPage(page));

  /** Sou demand: chaje TOUT rezilta ki matche filtè yo, seleksyone yo, pou bulk actions sou anpil paj. */
  const loadAllForSelection = async () => {
    setLoadingPage(true);
    try {
      const rows = await getAllPackagesMatching({
        search: debouncedSearch, matchingClientCodes, status,
        source: (source as any) || "", dateF, includeArchived: showArchived, conduceId
      }, 3000);
      setPkgs(rows);
      sel.add(rows.map(snap));
      setTotal(rows.length);
      setFullyLoaded(true);
      setPage(1);
      setNotice(`${rows.length} colis chargés et sélectionnés.`);
    } catch (e: any) {
      setNotice("Erè chargement: " + e.message);
    } finally { setLoadingPage(false); }
  };

  // Chajman inisyal: vi Conduce (bounded) chaje tout dirèk; vi global chaje premye paj sèvè a.
  useEffect(() => {
    (async () => {
      try {
        await loadSide();
        if (fullyLoaded) {
          const p = await getPackages(undefined, showArchived, conduceId);
          setPkgs(p);
          setTotal(p.length);
        } else {
          await fetchServerPage(1);
        }
      } catch (e: any) { setNotice("Erè bazdone: " + e.message); }
    })();
    /* eslint-disable-next-line */
  }, [showArchived, conduceId]);

  // Vi global sèlman: chak fwa filtè/paj chanje, rechèch KOTE SÈVÈ a (san rechaje tout done yo).
  useEffect(() => {
    if (fullyLoaded) return;
    fetchServerPage(page);
    /* eslint-disable-next-line */
  }, [fullyLoaded, page, status, source, dateF, debouncedSearch, matchingClientCodes]);

  /** Lis statut ki egziste toutbon (pou filtre a) — san Livré, ki rete nan Historique */
  const statusOptions = useMemo(() => {
    const set = new Set<string>(INTERNAL_STATUSES.filter((s) => s !== "Livré"));
    pkgs.filter((p) => p.status !== "Livré").forEach((p) => set.add(p.status));
    set.add("Facturé");
    return Array.from(set);
  }, [pkgs]);

  const filtered = useMemo(() => {
    // Vi global paginée (sèvè a): pkgs se DEJA sèlman paj aktyèl la, filtre+triye kote sèvè a.
    if (!fullyLoaded) return pkgs;
    const q = search.trim().toLowerCase();
    return pkgs
      // Koli livré yo pa parèt isit la — yo rete nan Historique (anyen pa efase)
      // V8.5: koli Facturé yo kite lis aktif la — yo nan Historique
      .filter((p) => p.status !== "Livré" && p.status !== "Facturé")
      .filter((p) => {
        if (status && p.status !== status) return false;
        if (source && !pkgSources(p).includes(source as SrcKey)) return false;
        if (dateF && !p.created_date.includes(dateF)) return false;
        if (!q) return true;
        // Rechèch avanse an tan reyèl: tracking, kòd, non, telefòn kliyan, vil kliyan
        const info = tarifMap.get(p.customer_code);
        return p.tracking_number.toLowerCase().includes(q)
          || p.customer_code.toLowerCase().includes(q)
          || p.customer_name.toLowerCase().includes(q)
          || (info?.fullname ?? "").toLowerCase().includes(q)
          || (info?.phone ?? "").toLowerCase().includes(q)
          || (info?.ville?.name ?? "").toLowerCase().includes(q);
      })
      // Tri otomatik: koli ki fèk rive yo anlè, pi ansyen yo anba —
      // rete konsa apre chak import MCPACK
      .slice()
      .sort((a, b) => parseMcpackDate(b.created_date) - parseMcpackDate(a.created_date));
  }, [pkgs, search, status, source, dateF, tarifMap, fullyLoaded]);

  const pages = fullyLoaded
    ? Math.max(1, Math.ceil(filtered.length / PER_PAGE))
    : Math.max(1, Math.ceil(total / PER_PAGE));
  const pageRows = fullyLoaded ? filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE) : filtered;
  // Kenbe panèl seleksyon an enfòme ak dènye detay koli ki chaje yo
  useEffect(() => { if (pkgs.length) sel.hydrate(pkgs.map(snap)); /* eslint-disable-next-line */ }, [pkgs]);
  useEffect(() => { setPage(1); }, [search, status, source, dateF]);

  // ===== SÉLECTION GLOBALE (pataje ak tout sistèm nan) =====
  // Rechèch/filtè/paj/Conduce PA efase seleksyon an. Aksyon yo travay sou
  // koli seleksyone ki chaje kounye a; sa ki nan lòt paj rete seleksyone.
  const selectedAll = pkgs.filter((p) => sel.has(p.id));                        // Bon de Remise / Statut
  const selected = selectedAll.filter((p) => p.status === "Disponible");        // Facturation
  const toggle = (id: string) => {
    const p = pkgs.find((x) => x.id === id);
    if (p) sel.toggle(snap(p));
  };
  const toggleAll = (checked: boolean) => sel.setMany(pageRows.map(snap), checked);

  /**
   * Admin SÈLMAN: mete menm statut la sou tout koli ki make yo.
   * "Reçu à Miami" ak "Disponible" voye yon email otomatik bay chak kliyan konsène
   * (si kliyan an gen imèl epi RESEND_API_KEY konfigire nan Vercel).
   */
  const appliquerStatut = async () => {
    if (!bulkStatus || !selectedAll.length) return;
    // "Facturé" -> "Disponible" = koreksyon erè: detache fakti a kòrèkteman
    const factures = selectedAll.filter((p) => p.status === "Facturé");
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
        if (!r.ok) { setNotice("Erè: " + (r.reason ?? "inconnue")); return; }
        setNotice(`✅ ${r.detached} colis remis en « Disponible »` +
          (r.invoicesDeleted ? ` — ${r.invoicesDeleted} facture(s) vide(s) supprimée(s).` : "."));
        await refresh();
      } catch (e: any) {
        setNotice("Erè: " + (e?.message ?? String(e)));
      } finally { setBusy(false); }
      return;
    }
    const targets = selectedAll.filter((p) => p.status !== "Facturé");
    if (!targets.length) { setNotice("Koli Facturé yo ka sèlman pase « Disponible » (koreksyon)."); return; }
    try {
      await setPackagesStatus(targets.map((p) => p.id), bulkStatus);
      await logAction("Changement Statut", `${targets.length} colis → ${bulkStatus}`, "", targets[0]?.customer_code ?? "");
      setPkgs((prev) => prev.map((p) =>
        targets.some((t) => t.id === p.id) ? { ...p, status: bulkStatus } : p));

      let mailInfo = "";
      if (bulkStatus === "Reçu à Miami" || bulkStatus === "Disponible") {
        const type = bulkStatus === "Reçu à Miami" ? "recu_miami" : "disponible";
        const byClient = new Map<string, Pkg[]>();
        targets.forEach((p) => {
          const arr = byClient.get(p.customer_code) ?? [];
          arr.push(p); byClient.set(p.customer_code, arr);
        });
        let sent = 0, noEmail = 0;
        const problems: string[] = [];
        for (const [code, list] of Array.from(byClient.entries())) {
          const info = tarifMap.get(code);
          if (!info?.email) { noEmail++; continue; }
          try {
            const res = await fetch("/api/notify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type,
                client: { name: info.fullname || list[0].customer_name, code, ville: info.ville?.name ?? "", email: info.email },
                packages: list.map((p) => ({
                  tracking_number: p.tracking_number,
                  tracking_manual: p.tracking_manual,
                  content: p.content,
                  weight: p.weight,
                  fournisseur: p.mcpack_data?.["Proveedor"] ?? p.mcpack_data?.["proveedor"] ?? ""
                }))
              })
            });
            const j = await res.json();
            if (j.ok) sent++;
            else problems.push(`${code}: ${j.reason ?? j.error ?? "erè enkoni"}`);
          } catch (err: any) { problems.push(`${code}: ${err?.message ?? "erè rezo"}`); }
        }
        mailInfo = ` Email: ${sent} voye${noEmail ? `, ${noEmail} kliyan san imèl` : ""}.` +
          (problems.length ? ` ⚠️ ${problems.slice(0, 2).join(" | ").slice(0, 300)}` : "");
        // Tras dirab: si imèl echwe, kite yon antre nan Journal (toast la disparèt)
        if (problems.length) {
          await logAction("Notification email échouée",
            `${bulkStatus} — ${sent} envoyé(s), ${problems.length} échec(s): ${problems.join(" | ").slice(0, 400)}`,
            "", "");
        }
      }
      setNotice(`Statut "${bulkStatus}" appliqué sur ${targets.length} colis.` + mailInfo);
      setBulkStatus("");
    } catch (e: any) { setNotice("Erè: " + e.message); }
  };

  /** Bon de remise: lis koli w ap voye bay ajan yo nan lòt vil */
  const bonRemise = async () => {
    if (!selectedAll.length) return;
    try {
      await generateBonRemise(selectedAll, tarifMap);
      setNotice(`Bon de remise créé (${selectedAll.length} colis) — PDF telechaje.`);
    } catch (e: any) { setNotice("Erè: " + e.message); }
  };

  /** Modifikasyon manyèl: chanje fakti aktyèl la sèlman, PA tarif Paramètres yo */
  const savePrice = async (p: Pkg, priceUsd: number, taxUsd: number) => {
    setPkgs((prev) => prev.map((x) => (x.id === p.id ? {
      ...x, price_usd: priceUsd, tax_usd: taxUsd, total_usd: round2(priceUsd + taxUsd),
      price_htg: round2(priceUsd * rate), tax_htg: round2(taxUsd * rate),
      total_htg: round2((priceUsd + taxUsd) * rate)
    } : x)));
    try { await updatePackagePrice(p.id, priceUsd, taxUsd, rate); }
    catch (e: any) { setNotice("Erè sauvegarde prix: " + e.message); }
  };

  const applyTarif = async () => {
    const targets = selected.length ? selected : filtered.filter((p) => p.status === "Disponible");
    let n = 0, sans = 0;
    for (const p of targets) {
      const info = tarifMap.get(p.customer_code);
      const r = info ? computePrice(p.weight, info.account_type, info.ville) : null;
      if (r) { await savePrice(p, r.price, 0); n++; } else sans++;
    }
    setNotice(
      `Tarification appliquée sur ${n} colis${selected.length ? " sélectionnés" : " disponibles"}.` +
      (sans ? ` ${sans} colis ignoré(s): kliyan san vil aktif oswa ki pa nan bazdone a.` : "")
    );
  };

  /** Ouvri fenèt fakti pataje a (menm workflow ak tout lòt paj). */
  const [invClient, setInvClient] = useState<Client | null>(null);

  const ouvriFacture = async () => {
    if (!selected.length) return;
    const code = selected[0].customer_code;
    if (!selected.every((p) => p.customer_code === code)) {
      setNotice("Tout koli ki make yo dwe pou menm kliyan an."); return;
    }
    const client = await getClient(code);
    if (!client) { setNotice(`Client "${code}" pa nan bazdone a.`); return; }
    setInvClient(client);
  };

  /** EFASE NÈT (admin) — pou done kraze ki bloke. Koli a ka re-enpòte apre via Extension/Conduce. */
  const supprimerDefinitif = async (p: Pkg) => {
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
      setPkgs((prev) => prev.filter((x) => x.id !== p.id));
    } catch (e: any) {
      setNotice("Erè: " + (e?.message ?? String(e)));
    } finally { setBusy(false); }
  };

  const archive = async (p: Pkg) => {
    if (!confirm(`Archiver le colis ${p.tracking_number}?\n\nLes données restent dans la base (jamais supprimées). Il n'apparaîtra plus dans la liste active.`)) return;
    try {
      await archivePackage(p.id, staffName);
      await logAction("Archivage colis", p.tracking_number, p.tracking_number, p.customer_code);
      setPkgs((prev) => showArchived
        ? prev.map((x) => x.id === p.id ? { ...x, archived: true } : x)
        : prev.filter((x) => x.id !== p.id));
    } catch (e: any) { setNotice("Erè archivage: " + e.message); }
  };
  const restore = async (p: Pkg) => {
    try {
      await unarchivePackage(p.id);
      await logAction("Restauration colis", p.tracking_number, p.tracking_number, p.customer_code);
      setPkgs((prev) => prev.map((x) => x.id === p.id ? { ...x, archived: false } : x));
    } catch (e: any) { setNotice("Erè restauration: " + e.message); }
  };

  /** Koreksyon Tracking Number — ADMIN sèlman, ak audit log (pwen #3) */
  const correctTracking = async (p: Pkg) => {
    const nv = window.prompt(
      `Correction Tracking Number — ${p.tracking_number}\n` +
      `Ancien: ${p.tracking_manual}\n\n` +
      `⚠️ Cette correction sera enregistrée dans l'audit.\n\nNouveau Tracking Number:`,
      p.tracking_manual
    );
    if (nv === null) return;
    const v = nv.trim();
    if (!v || v === p.tracking_manual) return;
    try {
      await saveTrackingManual(p.id, v);
      await logAction("Correction Tracking Number",
        `${p.tracking_manual} → ${v}`, p.tracking_number, p.customer_code);
      setPkgs((prev) => prev.map((x) => x.id === p.id ? { ...x, tracking_manual: v } : x));
      setNotice("Tracking Number corrigé (enregistré dans l'audit).");
    } catch (er: any) { setNotice("Erè koreksyon: " + er.message); }
  };

  const tp = selected.reduce((s, p) => s + p.price_usd, 0);
  const tt = selected.reduce((s, p) => s + p.tax_usd, 0);
  const allChecked = pageRows.length > 0 && pageRows.every((p) => sel.has(p.id));


  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        {!hideHeader && (
          <div>
            <h1 className="h-page">Packages</h1>
            <p className="text-sm text-mute mt-0.5">Gestion des colis — statuts, tarification & facturation</p>
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <input className="input w-72" placeholder="Tracking, code, nom, telefòn, vil..." value={search}
            onChange={(e) => setSearch(e.target.value)} />
          <input className="input w-36" placeholder="Date (2026.07)" value={dateF}
            onChange={(e) => setDateF(e.target.value)} />
          <select className="input w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tous statuts</option>
            {statusOptions.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="input w-44" value={source} onChange={(e) => setSource(e.target.value)}
            title="Filtrer par provenance (un colis peut avoir plusieurs sources)">
            <option value="">Toutes provenances</option>
            <option value="caribe">Caribe Tours (photo)</option>
            <option value="facture">Facture</option>
            <option value="extension">Extension MCPACK</option>
          </select>
          <button
            className={`btn ${showArchived ? "btn-brand" : "btn-ghost"}`}
            onClick={() => setShowArchived((v) => !v)}
            title="Afficher les colis archivés">
            <Archive size={15} /> {showArchived ? "Archivés" : "Actifs"}
          </button>
          <RefreshButton onRefresh={refresh} />
        </div>
      </div>

      {!fullyLoaded && (
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-mute -mt-2">
          <span>{loadingPage ? "Chargement…" : `${total} colis correspondant aux filtres`}</span>
          {total > PER_PAGE && (
            <button className="text-navy hover:underline font-semibold" onClick={loadAllForSelection} disabled={loadingPage}>
              Charger tous les résultats ({total}) pour sélection globale
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-mute px-1">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300 inline-block" /> 🟢 Reçu chez MCPACK</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white border border-line inline-block" /> ⚪ En attente de réception</span>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr>
            <th className="thc"><input type="checkbox" checked={allChecked} onChange={(e) => toggleAll(e.target.checked)} /></th>
            {["Code", "Nom Client", "Ville", "Tracking ID (Guía)", "Tracking Number", "Lb", "Content", "Price $", "Total $", "Total HTG",
              ...(hideHeader ? [] : ["Source"]), "Status", ""]
              .map((h) => <th key={h} className="thc">{h}</th>)}
          </tr></thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={hideHeader ? 13 : 14} className="text-center py-10 text-mute">
                Aucun colis. Utilisez <a href="/sync" className="text-navy underline font-semibold">Synchronisation MCPACK</a>.
              </td></tr>
            ) : pageRows.map((p, i) => (
              <tr key={p.id} className={`${p.received_at ? "!bg-emerald-50" : i % 2 ? "bg-mist" : ""} ${sel.has(p.id) ? "!bg-blue-50" : ""}`}
                title={p.received_at ? `Reçu chez MCPACK — ${p.received_method}` : "En attente de réception"}>
                <td className="tdc">
                  <input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} />
                </td>
                <td className="tdc font-bold whitespace-nowrap">
                  <Link href={`/clients/${encodeURIComponent(p.customer_code)}`}
                    className="text-navy hover:underline" title="Ouvri dosye kliyan an">
                    {p.customer_code}
                  </Link>
                </td>
                <td className="tdc max-w-[110px] truncate" title={p.customer_name}>
                  <Link href={`/clients/${encodeURIComponent(p.customer_code)}`}
                    className="hover:text-navy hover:underline">
                    {p.customer_name}
                  </Link>
                </td>
                <td className="tdc max-w-[80px] truncate" title={tarifMap.get(p.customer_code)?.ville?.name ?? ""}>
                  {tarifMap.get(p.customer_code)?.ville?.name ?? <span className="text-amber-600">—</span>}
                </td>
                <td className="tdc font-mono text-[11px] whitespace-nowrap cursor-help"
                  onMouseEnter={(e) => showTip(p, e)}
                  onMouseMove={(e) => showTip(p, e)}
                  onMouseLeave={() => setHover(null)}>
                  {p.tracking_number}
                </td>
                <td className="tdc">
                  {!p.tracking_manual ? (
                    // Vid: pèmèt premye antre (yon sèl fwa)
                    <input type="text" defaultValue=""
                      placeholder="—" title="Tracking Number — antre yon sèl fwa (apre l ap fèmen)"
                      className="input !w-24 !py-0.5 !px-1 !text-[11px] font-mono"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (!v) return;
                        saveTrackingManual(p.id, v).then(() => {
                          logAction("Ajout Tracking Number", `${p.tracking_number} → ${v}`, p.tracking_number, p.customer_code);
                          setPkgs((prev) => prev.map((x) => x.id === p.id ? { ...x, tracking_manual: v } : x));
                        }).catch((er: any) => setNotice("Erè tracking: " + er.message));
                      }} />
                  ) : (
                    // Genyen valè: fèmen (read-only) — admin ka korije ak audit
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] whitespace-nowrap cursor-help"
                      onMouseEnter={(e) => showTip(p, e)}
                      onMouseMove={(e) => showTip(p, e)}
                      onMouseLeave={() => setHover(null)}>
                      <Lock size={10} className="text-slate-400 shrink-0" />
                      {p.tracking_manual}
                      {role === "admin" && (
                        <button className="text-slate-400 hover:text-navy ml-0.5 shrink-0"
                          title="Correction (admin) — enregistrée dans l'audit"
                          onClick={() => correctTracking(p)}>
                          <Pencil size={11} />
                        </button>
                      )}
                    </span>
                  )}
                </td>
                <td className="tdc text-right">{p.weight}</td>
                <td className="tdc max-w-[90px] truncate" title={p.content}>{p.content}</td>
                <td className="tdc text-right">{usd(p.price_usd)}</td>
                <td className="tdc text-right font-semibold whitespace-nowrap">{usd(p.total_usd)}</td>
                <td className="tdc text-right text-[11px] text-slate-500 whitespace-nowrap">{htg(p.total_htg)}</td>
                {!hideHeader && (
                  <td className="tdc">
                    <div className="flex items-center gap-1">
                      {(() => {
                        const keys = pkgSources(p);
                        if (!keys.length) return <span className="text-mute text-[11px]">—</span>;
                        return SRC_DEFS.filter((d) => keys.includes(d.key)).map((d) => (
                          <span key={d.key} className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${d.cls}`} title={d.label}>
                            <d.Icon size={13} />
                          </span>
                        ));
                      })()}
                    </div>
                  </td>
                )}
                <td className="tdc">
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={p.status} />
                    {p.verified && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 text-emerald-700 px-1.5 py-0.5 text-[9px] font-bold"
                        title={`Vérifié MCPACK${p.verified_at ? " — " + dateFr(p.verified_at) : ""}`}>
                        <CheckCircle2 size={10} /> Vérifié
                      </span>
                    )}
                    {p.proof_photo_url && (
                      <a href={p.proof_photo_url} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 text-blue-700 px-1.5 py-0.5 text-[9px] font-bold hover:bg-blue-200"
                        title="Voir la photo de preuve">
                        <Camera size={10} /> Photo
                      </a>
                    )}
                  </div>
                </td>
                <td className="tdc whitespace-nowrap">
                  {p.status !== "Disponible" && p.status !== "Facturé" && (
                    <button className="text-emerald-600 hover:text-emerald-800 mr-1"
                      title="Marquer Disponible (san email — sèvi ak seleksyon an pou voye email)"
                      onClick={() => { setPackagesStatus([p.id], "Disponible").then(() => setPkgs((prev) =>
                        prev.map((x) => x.id === p.id ? { ...x, status: "Disponible" } : x))); }}>
                      <PackageCheck size={14} />
                    </button>
                  )}
                  {role === "admin" && (
                    p.archived
                      ? <button className="text-slate-400 hover:text-emerald-600" title="Restaurer" onClick={() => restore(p)}><RotateCcw size={14} /></button>
                      : <button className="text-slate-400 hover:text-amber-600" title="Archiver (jamais supprimé)" onClick={() => archive(p)}><Archive size={14} /></button>
                  )}
                  {role === "admin" && (
                    <button className="text-slate-300 hover:text-red-600 ml-1.5"
                      title="Supprimer définitivement (données cassées — à ré-importer)"
                      onClick={() => supprimerDefinitif(p)}><Trash2 size={14} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={page} pages={pages} onPage={setPage} />
      </div>

      <div className="card p-4 flex flex-col md:flex-row md:items-center gap-4 sticky bottom-3">
        {selectedAll.length > 0 && (
          <div className="flex gap-6 flex-1 flex-wrap">
            <div><p className="text-xs text-mute">Sélection ({selected.length} colis)</p>
              <p className="text-lg font-bold text-navy">{usd(tp)}</p></div>
            <div><p className="text-xs text-mute">Tax</p>
              <p className="text-lg font-bold text-navy">{usd(tt)}</p></div>
            <div className="bg-navy rounded-lg px-4 py-1.5">
              <p className="text-xs text-white/70">Total USD</p>
              <p className="text-xl font-bold text-white">{usd(tp + tt)}</p></div>
            <div className="bg-navy/90 rounded-lg px-4 py-1.5">
              <p className="text-xs text-white/70">Total HTG (taux {rate.toFixed(2)})</p>
              <p className="text-xl font-bold text-white">{htg((tp + tt) * rate)}</p></div>
          </div>
        )}
        <div className="flex gap-2 flex-wrap items-center md:ml-auto">
          {selectedAll.length > 0 && (
            <>
              <select className="input !w-44 !py-2" value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}>
                <option value="">— Statut... —</option>
                {INTERNAL_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <button className="btn !bg-emerald-600 hover:!bg-emerald-700"
                onClick={appliquerStatut} disabled={busy || !bulkStatus}>
                <PackageCheck size={15} /> Appliquer ({selectedAll.length})
              </button>
              <button className="btn btn-ghost border border-line" onClick={bonRemise} disabled={busy}
                title="Lis koli pou ajan transpò yo">
                <ClipboardList size={15} /> Créer Bon de Remise ({selectedAll.length})
              </button>
            </>
          )}
          <button className="btn btn-ghost border border-line"
            onClick={() => exportPackagesPdf(selectedAll.length ? selectedAll : filtered, tarifMap,
              selectedAll.length ? "Colis sélectionnés" : "Liste des colis")}
            title="Exporter la liste en PDF">
            <FileText size={15} /> Exporter PDF
          </button>
          <button className="btn btn-ghost border border-line"
            onClick={() => exportPackagesExcel(selectedAll.length ? selectedAll : filtered, tarifMap,
              selectedAll.length ? "Colis sélectionnés" : "Liste des colis")}
            title="Exporter la liste en Excel">
            <FileSpreadsheet size={15} /> Exporter Excel
          </button>
          <button className="btn btn-ghost border border-line" onClick={applyTarif} disabled={busy}>
            <Calculator size={15} /> Appliquer tarification
          </button>
          {selectedAll.length > 0 && (
            <button className="btn !bg-emerald-600 hover:!bg-emerald-700" onClick={() => setShowWaQueue(true)}>
              <MessageCircle size={15} /> Envoyer WhatsApp ({selectedAll.length})
            </button>
          )}
          {selectedAll.length > 0 && (
            <button className="btn" onClick={ouvriFacture} disabled={busy || !selected.length}>
              <FileText size={15} /> Générer Facture
            </button>
          )}
        </div>
      </div>

      {showWaQueue && (
        <WhatsAppQueue pkgs={selectedAll} onClose={() => setShowWaQueue(false)} />
      )}

      {/* ===== Fenèt konfimasyon Facture (opsyon pa fakti) ===== */}
      {invClient && (
        <InvoiceDialog
          client={invClient}
          pkgs={selected}
          footer={footer}
          onClose={() => setInvClient(null)}
          onDone={(msg) => { setNotice(msg); refresh(); }}
        />
      )}

      {/* ===== Tooltip modèn koli (pwen #2) ===== */}
      {hover && (() => {
        const p = hover.p;
        const jrs = joursDepot(p);
        const rows: [string, React.ReactNode][] = [
          ["Code Client", <span className="font-bold text-navy">{p.customer_code}</span>],
          ["Nom Client", p.customer_name || "—"],
          ["Ville", hover.ville],
          ["Tracking ID", <span className="font-mono">{p.tracking_number}</span>],
          ["Tracking Number", <span className="font-mono">{p.tracking_manual || "—"}</span>],
          ["Poids", `${Number(p.weight || 0)} lb`],
          ["Contenu", p.content || "—"],
          ["Statut", <StatusBadge status={p.status} />],
          ["Date création", dateFr(p.created_date) || "—"],
          ["Date réception", p.received_at ? dateFr(p.received_at) : "—"],
          ["Facturé", p.invoice_id
            ? <span className="pill pill-green"><span className="pill-dot" />Oui</span>
            : <span className="pill pill-gray"><span className="pill-dot" />Non</span>],
          ["Jours en dépôt", jrs != null ? `${jrs} j` : "—"]
        ];
        // pozisyon: evite depase bò dwat/anba ekran
        const left = Math.min(hover.x + 16, (typeof window !== "undefined" ? window.innerWidth : 1200) - 300);
        const top = Math.min(hover.y + 16, (typeof window !== "undefined" ? window.innerHeight : 800) - 380);
        return (
          <div className="fixed z-[70] pointer-events-none" style={{ left, top }}>
            <div className="card shadow-lift w-72 p-3.5 text-xs">
              <p className="text-[10px] font-bold text-mute uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Package size={12} /> Détails du colis
              </p>
              <div className="space-y-1">
                {rows.map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-3">
                    <span className="text-mute shrink-0">{k}</span>
                    <span className="text-right text-ink font-medium min-w-0 truncate">{v}</span>
                  </div>
                ))}
              </div>
              {p.received_method && (
                <p className="mt-2 pt-2 border-t border-line text-[10px] text-mute">
                  Reçu via {p.received_method}
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {notice && <p className="card px-4 py-3 text-sm text-navy">{notice}</p>}
    </div>
  );
}
