"use client";
/*
 * STANDA COMMERCIAL — Scanner de Réception MCPACK (Faz 1)
 * ══════════════════════════════════════════════════════════
 * Scan fizik koli MCPACK (Caribe Tours). Sipòte:
 *   • Kamera telefòn / Webcam (ZXing barcode + QR)
 *   • Scanner USB / Bluetooth (klavye-wedge — tape kòd + Enter)
 * Workflow: Scan → Rechèch → Preview → CONFIRMER → "En route vers agence" + Vérifié.
 * SEKIRITE: modifye SÈLMAN statut + verified. JANM pri/pwa/tracking/kliyan.
 */
import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, CheckCircle2, Search, X, ScanLine, Package } from "lucide-react";
import { findPackageByScan, verifyPackageReception, logReceptionSession, ScanResult } from "@/lib/db";
import { useRole } from "@/lib/authx";
import { dateFr, parseMcpackDate } from "@/lib/utils";
import StatusBadge from "@/components/StatusBadge";
import type { Pkg } from "@/lib/types";

type Mode = "manuel" | "continu";
type BeepKind = "ok" | "already" | "notfound" | "error";

export default function ReceptionScanner() {
  const { staff } = useRole();
  const staffName = staff ? `${staff.prenom ?? ""} ${staff.nom ?? ""}`.trim() || (staff.username ?? "") : "";
  const [mode, setMode] = useState<Mode>("manuel");
  const [scanning, setScanning] = useState(false);      // kamera aktif
  const [result, setResult] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: "ok" | "warn" | "err"; s: string } | null>(null);
  const [toVerify, setToVerify] = useState<string[]>([]); // koli introuvables (À Vérifier)
  const [counts, setCounts] = useState({ scanned: 0, found: 0, already: 0, notfound: 0, validated: 0 });
  // ===== Faz 2 — Mode Réception Continue (Entrepôt) =====
  const [session, setSession] = useState<{ startedAt: number } | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [report, setReport] = useState<null | {
    scanned: number; found: number; validated: number; already: number; notfound: number;
    seconds: number; avg: number; who: string; date: string; toVerify: string[];
  }>(null);

  const videoRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const kbdRef = useRef<any>(null);
  const lastScan = useRef<{ code: string; t: number }>({ code: "", t: 0 });
  const audioCtx = useRef<any>(null);

  // ---------- Son (Web Audio) ----------
  const beep = (kind: BeepKind) => {
    try {
      if (!audioCtx.current) audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = audioCtx.current;
      const patterns: Record<BeepKind, [number, number][]> = {
        ok: [[880, 0.12]],
        already: [[440, 0.4]],
        notfound: [[320, 0.12], [320, 0.12]],
        error: [[200, 0.1], [200, 0.1], [200, 0.1]],
      };
      let t = ctx.currentTime;
      for (const [freq, dur] of patterns[kind]) {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.frequency.value = freq; o.type = "sine";
        o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.start(t); o.stop(t + dur + 0.02);
        t += dur + 0.06;
      }
    } catch { /* son opsyonèl */ }
  };

  // ---------- Trete yon kòd scanne ----------
  const handleScan = async (raw: string) => {
    const code = (raw || "").trim();
    if (!code) return;
    const now = Date.now();
    // Debounce: menm kòd nan mwens pase 2.5s = inyore (kamera repete)
    if (code === lastScan.current.code && now - lastScan.current.t < 2500) return;
    lastScan.current = { code, t: now };

    setBusy(true);
    setCounts((c) => ({ ...c, scanned: c.scanned + 1 }));
    try {
      const res = await findPackageByScan(code);
      if (res.outcome === "not_found") {
        beep("notfound");
        setCounts((c) => ({ ...c, notfound: c.notfound + 1 }));
        setToVerify((l) => (l.includes(code) ? l : [...l, code]));
        setResult(res);
        setMsg({ t: "warn", s: `Package introuvable : ${code}` });
      } else if (res.outcome === "already") {
        beep("already");
        setCounts((c) => ({ ...c, already: c.already + 1 }));
        setResult(res);
        setMsg({ t: "warn", s: "Ce colis a déjà été vérifié." });
      } else {
        setCounts((c) => ({ ...c, found: c.found + 1 }));
        setResult(res);
        if (mode === "continu") {
          await doConfirm(res.pkg!);   // validasyon otomatik
        } else {
          beep("ok");
          setMsg(null);
        }
      }
    } catch (e: any) {
      beep("error");
      setMsg({ t: "err", s: "Erreur scan : " + (e?.message ?? String(e)) });
    } finally { setBusy(false); }
  };

  // ---------- Session Réception Continue (Faz 2) ----------
  const startSession = () => {
    setCounts({ scanned: 0, found: 0, already: 0, notfound: 0, validated: 0 });
    setToVerify([]); setReport(null); setResult(null); setMsg(null);
    setSession({ startedAt: Date.now() });
    if (mode !== "continu") setMode("continu");
    refocusKbd();
  };
  const endSession = () => {
    if (!session) return;
    const seconds = Math.max(1, Math.round((Date.now() - session.startedAt) / 1000));
    setReport({
      scanned: counts.scanned, found: counts.found, validated: counts.validated,
      already: counts.already, notfound: counts.notfound,
      seconds, avg: counts.scanned ? +(seconds / counts.scanned).toFixed(2) : 0,
      who: staffName || "—", date: new Date().toLocaleString("fr-FR"), toVerify: [...toVerify],
    });
    void logReceptionSession({ ...counts, seconds, who: staffName });
    setSession(null); stopCamera(); setResult(null);
  };
  // Timer vivan (chak segond pandan sesyon an)
  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [session]);
  const elapsed = session ? Math.round((nowTick - session.startedAt) / 1000) : 0;
  const fmtDur = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;

  // ---------- CONFIRMER (verifikasyon) ----------
  const doConfirm = async (pkg: Pkg) => {
    setBusy(true);
    try {
      const r = await verifyPackageReception(pkg.id, scanning ? "Caméra" : "Scanner", staffName);
      if (r.ok) {
        beep("ok");
        setCounts((c) => ({ ...c, validated: c.validated + 1 }));
        setMsg({ t: "ok", s: `✔ Vérifié — ${pkg.tracking_number} → ${r.status}` });
        setResult(null);
      } else {
        beep("already");
        setMsg({ t: "warn", s: "Déjà vérifié ou non modifiable." });
      }
    } catch (e: any) {
      beep("error");
      setMsg({ t: "err", s: "Erreur validation : " + (e?.message ?? String(e)) });
    } finally { setBusy(false); refocusKbd(); }
  };

  // ---------- Kamera ----------
  const startCamera = async () => {
    try {
      const zxing: any = await import("@zxing/library");
      const reader = new zxing.BrowserMultiFormatReader();
      readerRef.current = reader;
      await reader.decodeFromVideoDevice(null, videoRef.current, (res: any) => {
        if (res) handleScan(res.getText());
      });
      setScanning(true);
      setMsg(null);
    } catch (e: any) {
      setMsg({ t: "err", s: "Impossible d'ouvrir la caméra : " + (e?.message ?? String(e)) });
    }
  };
  const stopCamera = () => {
    try { readerRef.current?.reset(); } catch { /* */ }
    setScanning(false);
  };
  useEffect(() => () => { try { readerRef.current?.reset(); } catch { /* */ } }, []);

  // ---------- Klavye-wedge (scanner USB/Bluetooth) ----------
  const refocusKbd = () => setTimeout(() => kbdRef.current?.focus(), 50);
  useEffect(() => { refocusKbd(); }, []);

  const jours = (p: Pkg): number | null => {
    const ref = p.received_at || p.created_date;
    if (!ref) return null;
    const t = parseMcpackDate(ref) || new Date(ref).getTime();
    if (!t || isNaN(t)) return null;
    const d = Math.floor((Date.now() - t) / 86400000);
    return d >= 0 ? d : null;
  };

  const pkg = result?.pkg;

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ScanLine size={18} className="text-navy" />
          <h2 className="h-sec">Scanner de Réception <span className="text-mute font-normal">(Caribe Tours)</span></h2>
        </div>
        {/* Switch Mode */}
        <div className="flex rounded-lg border border-line overflow-hidden text-xs">
          {(["manuel", "continu"] as Mode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-3 py-1.5 font-semibold ${mode === m ? "bg-navy text-white" : "bg-white text-mute"}`}>
              {m === "manuel" ? "Manuel (confirmer)" : "Continu (auto)"}
            </button>
          ))}
        </div>
      </div>

      {/* Ba Session — Mode Entrepôt (Faz 2) */}
      <div className={`rounded-xl p-4 flex items-center justify-between flex-wrap gap-3 ${session ? "bg-emerald-50 border border-emerald-300" : "bg-mist border border-line"}`}>
        {!session ? (
          <>
            <div className="text-sm text-mute">Mode Entrepôt — scanner en continu sans interruption.</div>
            <button className="btn btn-brand !py-2.5" onClick={startSession}>
              ▶ Commencer la Réception
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold text-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Réception en cours
              </span>
              <span className="text-sm text-ink font-mono">{fmtDur(elapsed)}</span>
              <span className="text-sm text-mute">Moy : <b className="text-ink">{counts.scanned ? (elapsed / counts.scanned).toFixed(2) : "0.00"}</b> s/colis</span>
            </div>
            <button className="btn btn-ghost !py-2.5 !border-red-300 !text-red-700" onClick={endSession}>
              ■ Terminer la Réception
            </button>
          </>
        )}
      </div>

      {/* Zòn scan */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Kamera */}
        <div className="space-y-2">
          <div className="relative bg-slate-900 rounded-xl overflow-hidden aspect-video flex items-center justify-center">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Camera size={32} /><span className="text-xs">Caméra désactivée</span>
              </div>
            )}
            {scanning && <div className="absolute inset-x-6 top-1/2 h-0.5 bg-red-500/80 animate-pulse" />}
          </div>
          {!scanning ? (
            <button className="btn btn-brand w-full" onClick={startCamera}>
              <Camera size={15} /> Démarrer la caméra
            </button>
          ) : (
            <button className="btn btn-ghost w-full" onClick={stopCamera}>
              <CameraOff size={15} /> Arrêter la caméra
            </button>
          )}
        </div>

        {/* Scanner USB / recherche manyèl */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-ink">Scanner USB / Bluetooth ou recherche manuelle</label>
          <div className="flex gap-2">
            <input ref={kbdRef} className="input flex-1 font-mono"
              placeholder="Scannez ou tapez un Tracking ID / Number…"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const v = (e.target as any).value;
                  (e.target as any).value = "";
                  handleScan(v);
                }
              }} />
            <button className="btn btn-ghost" onClick={() => {
              const v = kbdRef.current?.value; if (kbdRef.current) kbdRef.current.value = ""; if (v) handleScan(v);
            }}><Search size={15} /></button>
          </div>
          <p className="text-[11px] text-mute">
            Un scanner USB/Bluetooth qui « tape » le code fonctionne automatiquement (il envoie Entrée après le code).
          </p>
          {/* Compteur */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            {[["Scannés", counts.scanned, "text-navy"], ["Validés", counts.validated, "text-emerald-600"],
              ["Déjà", counts.already, "text-amber-600"], ["Introuv.", counts.notfound, "text-red-600"]].map(([l, n, c]) => (
              <div key={l as string} className="rounded-lg border border-line p-2 text-center">
                <div className={`text-lg font-extrabold ${c}`}>{n as number}</div>
                <div className="text-[10px] text-mute">{l as string}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mesaj feedback */}
      {msg && (
        <div className={`rounded-lg px-4 py-2.5 text-sm font-semibold flex items-center gap-2 ${
          msg.t === "ok" ? "bg-emerald-50 text-emerald-700" :
          msg.t === "warn" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
          {msg.t === "ok" ? <CheckCircle2 size={16} /> : <X size={16} />} {msg.s}
        </div>
      )}

      {/* PREVIEW koli jwenn */}
      {pkg && result?.outcome !== "not_found" && (
        <div className={`rounded-2xl border-2 p-4 ${result?.outcome === "already" ? "border-amber-300 bg-amber-50/40" : "border-emerald-400 bg-emerald-50/40"}`}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Package size={18} className="text-navy" />
              <span className="font-extrabold text-navy text-lg">{pkg.customer_code}</span>
              <span className="text-mute">— {pkg.customer_name}</span>
            </div>
            {pkg.verified || result?.outcome === "already"
              ? <span className="pill pill-green"><span className="pill-dot" />Vérifié MCPACK</span>
              : <StatusBadge status={pkg.status} />}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5 text-sm">
            {[
              ["Tracking ID", <span className="font-mono">{pkg.tracking_number}</span>],
              ["Tracking Number", <span className="font-mono">{pkg.tracking_manual || "—"}</span>],
              ["Poids", `${Number(pkg.weight || 0)} lb`],
              ["Contenu", pkg.content || "—"],
              ["Statut actuel", <StatusBadge status={pkg.status} />],
              ["Date réception", pkg.received_at ? dateFr(pkg.received_at) : "—"],
              ["Facturé", pkg.invoice_id ? "Oui" : "Non"],
              ["Jours en dépôt", jours(pkg) != null ? `${jours(pkg)} j` : "—"],
            ].map(([k, v], i) => (
              <div key={i}>
                <div className="text-[11px] text-mute">{k as string}</div>
                <div className="text-ink font-medium">{v as any}</div>
              </div>
            ))}
          </div>

          {result?.outcome === "found" && mode === "manuel" && (
            <div className="flex gap-2 mt-4">
              <button className="btn btn-brand flex-1 !py-2.5 text-base" onClick={() => doConfirm(pkg)} disabled={busy}>
                <CheckCircle2 size={18} /> CONFIRMER la réception
              </button>
              <button className="btn btn-ghost" onClick={() => { setResult(null); refocusKbd(); }}>
                Scanner suivant
              </button>
            </div>
          )}
          {result?.outcome === "already" && (
            <p className="mt-3 text-sm text-amber-700 font-semibold">⚠ Ce colis a déjà été vérifié — aucune modification.</p>
          )}
        </div>
      )}

      {/* Koli introuvable */}
      {result?.outcome === "not_found" && (
        <div className="rounded-2xl border-2 border-red-300 bg-red-50/40 p-4">
          <p className="font-bold text-red-700">Package introuvable</p>
          <p className="text-sm text-mute mt-1">Code scanné : <span className="font-mono">{result.code}</span></p>
          <div className="flex gap-2 mt-3">
            <button className="btn btn-ghost" onClick={() => { setResult(null); refocusKbd(); }}>Nouvelle recherche</button>
          </div>
        </div>
      )}

      {/* Lis À Vérifier (introuvables) */}
      {toVerify.length > 0 && (
        <div className="border-t border-line pt-3">
          <p className="text-xs font-bold text-red-700 mb-1.5">À Vérifier — introuvables ({toVerify.length}) :</p>
          <div className="flex flex-wrap gap-1.5">
            {toVerify.map((c, i) => (
              <span key={i} className="font-mono text-[11px] bg-red-50 text-red-700 rounded px-2 py-0.5">{c}</span>
            ))}
          </div>
        </div>
      )}
      {/* Rapport final (Faz 2) */}
      {report && (
        <div className="rounded-2xl border-2 border-navy/20 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-extrabold text-navy text-lg">Rapport de Réception</h3>
            <button className="text-mute hover:text-navy" onClick={() => setReport(null)}><X size={18} /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              ["Total scanné", report.scanned, "text-navy"],
              ["Validés", report.validated, "text-emerald-600"],
              ["Déjà vérifiés", report.already, "text-amber-600"],
              ["Introuvables", report.notfound, "text-red-600"],
            ].map(([l, n, c]) => (
              <div key={l as string} className="rounded-xl border border-line p-3 text-center">
                <div className={`text-2xl font-extrabold ${c}`}>{n as number}</div>
                <div className="text-[11px] text-mute mt-0.5">{l as string}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5 text-sm border-t border-line pt-3">
            <div><span className="text-mute">Temps total : </span><b>{fmtDur(report.seconds)}</b></div>
            <div><span className="text-mute">Moyenne : </span><b>{report.avg} s/colis</b></div>
            <div><span className="text-mute">Utilisateur : </span><b>{report.who}</b></div>
            <div className="md:col-span-3"><span className="text-mute">Date : </span><b>{report.date}</b></div>
          </div>
          {report.toVerify.length > 0 && (
            <div className="mt-3 pt-3 border-t border-line">
              <p className="text-xs font-bold text-red-700 mb-1.5">À Vérifier — introuvables ({report.toVerify.length}) :</p>
              <div className="flex flex-wrap gap-1.5">
                {report.toVerify.map((c, i) => (
                  <span key={i} className="font-mono text-[11px] bg-red-50 text-red-700 rounded px-2 py-0.5">{c}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
