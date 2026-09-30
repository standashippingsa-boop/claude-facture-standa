"use client";
import { useRef, useState } from "react";
import { Download, Eye, FileSignature, Loader2, Upload, Wallet } from "lucide-react";
import { useNoticeToast } from "@/lib/notify";
import {
  AFFILIATE_PAYOUT_METHODS, AFFILIATE_PAYOUT_RATE_HTG, SIGNED_CONTRACT_MAX_BYTES, resolveSignedContractExt, signedContractMime,
  formatHtg, toPayoutHtg, type AffiliatePayoutMethod
} from "@/lib/affiliate-terms";

/**
 * KAT KONT AFILYE — kontra siyen + mòd peman. Itilize nan:
 *   - /espace-affilie (tablo bò): SÈLMAN pandan etap la poko fèt;
 *   - /espace-affilie/parametres: toujou, pou afilye a ka modifye yo.
 * Zewo enpòtasyon @/lib/db oswa @/lib/supabase: tout pase pa /api/affiliate-portal.
 * Chak chanjman avèti admin yo kote sèvè a (lib/affiliate-notify.ts).
 */

/** Kontra vid la (piblik — menm fichye admin nan voye pa Gmail). */
export const BLANK_CONTRACT_URL = "/contrat-affiliation-standa.pdf";

export const portal = async (payload: Record<string, unknown>) => {
  const res = await fetch("/api/affiliate-portal", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
  });
  return res.json().catch(() => ({ ok: false, reason: "Réponse invalide du serveur." }));
};

export const dateFr = (d?: string | null) => (d ? new Date(d).toLocaleDateString("fr-CA") : "");

/**
 * KONTRA SIYEN — afilye a telechaje kontra a, enprime l, siyen l, eskane l,
 * epi voye l isit la. Fichye a ale DIREK nan Storage (bucket prive) ak yon
 * URL siyen: li pa pase nan fonksyon sèvè a (limit 4,5 Mo Vercel).
 */
export function ContractSection({ uploadedAt, onUploaded }: { uploadedAt: string | null; onUploaded: (at: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  useNoticeToast(message, setMessage);

  const upload = async (file: File) => {
    setMessage(null);
    const ext = resolveSignedContractExt(file.type, file.name);
    if (!ext) { setMessage({ ok: false, text: "Format non accepté. Envoyez un PDF (ou une photo JPG/PNG)." }); return; }
    // Telefòn ki pa bay MIME: re-etikte fichye a, sinon Storage rejte l (octet-stream).
    const mime = signedContractMime(ext);
    const payload = file.type === mime ? file : new File([file], file.name || `contrat.${ext}`, { type: mime });
    if (file.size > SIGNED_CONTRACT_MAX_BYTES) { setMessage({ ok: false, text: "Fichier trop volumineux (15 Mo maximum)." }); return; }
    setBusy(true);
    try {
      const start = await portal({ action: "contract_upload_url", content_type: payload.type, filename: file.name, size: payload.size });
      if (!start.ok) throw new Error(start.reason || "Envoi impossible.");
      const form = new FormData();
      form.append("cacheControl", "3600");
      form.append("", payload);
      const apikey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
      const put = await fetch(start.signedUrl, { method: "PUT", body: form, headers: { "x-upsert": "false", ...(apikey ? { apikey } : {}) } });
      if (!put.ok) throw new Error("L'envoi du fichier a échoué. Vérifiez votre connexion et réessayez.");
      const done = await portal({ action: "contract_confirm", path: start.path });
      if (!done.ok) throw new Error(done.reason || "Envoi impossible.");
      onUploaded(done.signed_contract_uploaded_at);
      setMessage({ ok: true, text: "Contrat signé reçu. Merci !" });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Envoi impossible." });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const view = async () => {
    const j = await portal({ action: "contract_view" });
    if (j.ok) window.open(j.url, "_blank", "noopener");
    else setMessage({ ok: false, text: j.reason || "Contrat indisponible." });
  };

  return (
    <section className="rounded-2xl border border-line bg-white p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent-light text-accent"><FileSignature size={17} /></span>
        <div>
          <h2 className="text-[16px] font-bold text-navy">Mon contrat signé</h2>
          {uploadedAt
            ? <p className="text-[12px] font-semibold text-emerald-700">Reçu le {dateFr(uploadedAt)}</p>
            : <p className="text-[12px] font-semibold text-amber-700">À envoyer</p>}
        </div>
      </div>
      {!uploadedAt && (
        <ol className="mt-3 space-y-1.5 text-[13px] leading-relaxed text-mute">
          <li><b className="text-navy">1.</b> Téléchargez le contrat et imprimez-le.</li>
          <li><b className="text-navy">2.</b> Remplissez vos informations, paraphez chaque page et signez la dernière.</li>
          <li><b className="text-navy">3.</b> Scannez les pages en un seul PDF (ex. : « Numériser » dans Google Drive, ou CamScanner).</li>
          <li><b className="text-navy">4.</b> Envoyez le fichier ici.</li>
        </ol>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={BLANK_CONTRACT_URL} download className="inline-flex items-center gap-1.5 rounded-lg bg-mist px-3 py-2 text-[13px] font-bold text-navy hover:bg-accent-light">
          <Download size={15} /> Télécharger le contrat
        </a>
        <button type="button" disabled={busy} onClick={() => input.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[13px] font-bold text-white hover:bg-accent-dark disabled:opacity-60">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {busy ? "Envoi…" : uploadedAt ? "Remplacer le contrat" : "Envoyer le contrat signé"}
        </button>
        {uploadedAt && (
          <button type="button" onClick={view} className="inline-flex items-center gap-1.5 rounded-lg bg-mist px-3 py-2 text-[13px] font-bold text-navy hover:bg-accent-light">
            <Eye size={15} /> Voir
          </button>
        )}
        <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png" className="hidden"
          onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); }} />
      </div>
    </section>
  );
}

/** MÒD PEMAN — SÈLMAN an goud, a to fiks kontra a, pa MonCash oswa NatCash. */
export function PayoutSection({ method, phone, updatedAt, onSaved }: {
  method: AffiliatePayoutMethod | null; phone: string; updatedAt?: string | null;
  onSaved: (method: AffiliatePayoutMethod, phone: string, updatedAt: string | null) => void;
}) {
  const [choice, setChoice] = useState<AffiliatePayoutMethod | null>(method);
  const [number, setNumber] = useState(phone);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  useNoticeToast(message, setMessage);
  const dirty = choice !== method || number.trim() !== phone;

  const save = async () => {
    if (!choice) { setMessage({ ok: false, text: "Choisissez MonCash ou NatCash." }); return; }
    // Chanje yon nimewo ki deja la = chanje kote kòb la ale: konfimasyon.
    if (method && !confirm(`Remplacer ${method} ${phone} par ${choice} ${number.trim()} pour recevoir vos commissions ?\n\nStanda Commercial sera avertie de ce changement.`)) return;
    setBusy(true); setMessage(null);
    try {
      const j = await portal({ action: "set_payout", method: choice, phone: number });
      if (!j.ok) { setMessage({ ok: false, text: j.reason || "Enregistrement impossible." }); return; }
      onSaved(j.payout_method, j.payout_phone, j.payout_updated_at ?? null);
      setNumber(j.payout_phone);
      setMessage({ ok: true, text: "Mode de paiement enregistré." });
    } finally { setBusy(false); }
  };

  return (
    <section className="rounded-2xl border border-line bg-white p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-100 text-emerald-600"><Wallet size={17} /></span>
        <div>
          <h2 className="text-[16px] font-bold text-navy">Comment recevoir mes commissions</h2>
          <p className="text-[12px] text-mute">{method ? `${method} · ${phone}` : "Pas encore choisi"}{method && updatedAt ? ` · modifié le ${dateFr(updatedAt)}` : ""}</p>
        </div>
      </div>
      <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] leading-relaxed text-amber-900">
        Les commissions sont payées <b>une fois par mois</b>, <b>uniquement en gourdes</b>, au taux fixe de <b>{AFFILIATE_PAYOUT_RATE_HTG.toString().replace(".", ",")} HTG pour 1 USD</b>
        {" "}(ex. : 10 USD = {formatHtg(toPayoutHtg(10))}).
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {AFFILIATE_PAYOUT_METHODS.map((m) => (
          <button key={m} type="button" onClick={() => { setChoice(m); setMessage(null); }}
            className={`rounded-xl border-2 px-3 py-2.5 text-[14px] font-bold transition ${choice === m ? "border-accent bg-accent-light text-navy" : "border-line text-mute hover:border-accent/40"}`}>
            {m}
          </button>
        ))}
      </div>
      <label className="mt-3 block">
        <span className="mb-1 block text-[12px] font-semibold text-mute">Numéro {choice ?? "MonCash / NatCash"}</span>
        <input value={number} onChange={(e) => { setNumber(e.target.value); setMessage(null); }} inputMode="tel" autoComplete="tel"
          placeholder="Ex. : 3779 0068" className="w-full rounded-lg border border-line px-3 py-2 text-[14px] outline-none focus:border-accent" />
      </label>
      <button type="button" disabled={busy || !dirty} onClick={save}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-navy px-3 py-2 text-[13px] font-bold text-white disabled:opacity-50">
        {busy && <Loader2 size={15} className="animate-spin" />} Enregistrer
      </button>
      <p className="mt-2 text-[11px] text-mute">Pour votre sécurité, Standa Commercial est avertie de chaque changement de numéro.</p>
    </section>
  );
}
