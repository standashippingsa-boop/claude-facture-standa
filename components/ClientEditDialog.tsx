"use client";
/*
 * FENÊTRE « MODIFIER LE CLIENT » (bouton crayon)
 * Toutes les informations de la fiche. L'enregistrement passe par le serveur
 * (/api/admin-auth → update_client) qui recopie le code, le nom et le
 * WhatsApp dans les colis, factures, demandes de retrait et l'identifiant de
 * connexion du client.
 */
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { adminApi, useRole } from "@/lib/authx";
import { getVilles } from "@/lib/db";
import { getAgences, type Agence } from "@/lib/agences";
import { pickupLabel, pickupLocationForCity } from "@/lib/pickup-location";
import type { Client, Ville } from "@/lib/types";

type Props = {
  client: Client;
  onClose: () => void;
  /** Appelé après un enregistrement réussi avec le code final du client. */
  onSaved: (newCode: string, message: string) => void;
};

export default function ClientEditDialog({ client, onClose, onSaved }: Props) {
  const { role } = useRole();
  const isAdmin = role === "admin";
  const [villes, setVilles] = useState<Ville[]>([]);
  const [agences, setAgences] = useState<Agence[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    customer_code: client.customer_code ?? "",
    fullname: client.fullname ?? "",
    surname: client.surname ?? "",
    whatsapp: client.whatsapp ?? "",
    phone: client.phone ?? "",
    email: client.email ?? "",
    address: client.address ?? "",
    ville_id: client.ville_id ?? "",
    account_type: client.account_type ?? "Personnel",
    vip_price_per_lb: client.vip_price_per_lb ? String(client.vip_price_per_lb) : "",
    id_type: client.id_type ?? "",
    id_number: client.id_number ?? "",
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((prev) => ({ ...prev, [k]: e.target.value }));

  useEffect(() => {
    void Promise.all([getVilles(), getAgences().catch(() => [] as Agence[])]).then(([v, a]) => { setVilles(v); setAgences(a); });
  }, []);

  const ville = villes.find((v) => v.id === f.ville_id);
  const agency = ville ? pickupLocationForCity(ville.name, agences) : null;
  const codeChanged = (client.customer_code ?? "") !== f.customer_code.trim();

  const save = async () => {
    setErr(null);
    if (codeChanged && client.customer_code && !confirm(
      `Changer le code ${client.customer_code} en ${f.customer_code.trim()} ?\n\n` +
      `Tous ses colis, factures et demandes de retrait passeront sur le nouveau code, ` +
      `et le client devra se connecter avec ${f.customer_code.trim()} (même mot de passe).`
    )) return;
    setBusy(true);
    try {
      const j = await adminApi("update_client", { client_id: client.id, client: f });
      if (!j?.ok) { setErr(j?.reason ?? "Enregistrement impossible."); return; }
      const parts = (j.changes as string[] | undefined) ?? [];
      const warn = (j.warnings as string[] | undefined)?.length ? ` Attention : mise à jour incomplète (${j.warnings.join(", ")}).` : "";
      onSaved(f.customer_code.trim() || client.customer_code, (parts.length ? `Client modifié : ${parts.join(" · ")}.` : "Aucun changement.") + warn);
    } catch (e: any) {
      setErr(e?.message ?? "Erreur réseau.");
    } finally { setBusy(false); }
  };

  const field = (k: keyof typeof f, label: string, extra: Record<string, unknown> = {}) => (
    <label className="block">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <input className="input mt-1" value={f[k]} onChange={set(k)} {...extra} />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="card mt-10 w-full max-w-2xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-navy">Modifier le client {client.customer_code}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-navy" aria-label="Fermer"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {field("customer_code", "Code client")}
          {field("fullname", "Prénom *")}
          {field("surname", "Nom")}
          {field("whatsapp", "WhatsApp", { inputMode: "tel" })}
          {field("phone", "Téléphone", { inputMode: "tel" })}
          {field("email", "Courriel", { type: "email" })}
          <label className="block md:col-span-2">
            <span className="text-xs font-medium text-slate-500">Adresse</span>
            <input className="input mt-1" value={f.address} onChange={set("address")} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Ville</span>
            <select className="input mt-1" value={f.ville_id} onChange={set("ville_id")}>
              <option value="">Choisissez la ville</option>
              {villes.filter((v) => v.active || v.id === client.ville_id).map((v) => (
                <option key={v.id} value={v.id}>{v.name}{!v.active ? " · inactive" : ""}</option>
              ))}
            </select>
          </label>
          <div className="block">
            <span className="text-xs font-medium text-slate-500">Lieu de récupération (automatique)</span>
            <p className={`input mt-1 flex items-center ${agency ? "bg-slate-50 font-semibold text-navy" : "bg-amber-50 text-amber-800"}`}>
              {!ville ? (client.pickup_location || "Choisissez la ville") : agency ? pickupLabel(agency) : `Aucune agence active pour ${ville.name}`}
            </p>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Type de compte</span>
            <select className="input mt-1" value={f.account_type} onChange={set("account_type")}>
              <option value="Personnel">Personnel</option>
              <option value="Business">Business</option>
              {(isAdmin || client.account_type === "VIP") && <option value="VIP">VIP (tarif spécial)</option>}
            </select>
          </label>
          {f.account_type === "VIP" && field("vip_price_per_lb", "Prix VIP par livre (USD)", { type: "number", step: "0.01", min: "0.01", readOnly: !isAdmin })}
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Pièce d&apos;identité</span>
            <select className="input mt-1" value={f.id_type} onChange={set("id_type")}>
              <option value="">Non précisée</option>
              <option value="Carte d'identité nationale">Carte d&apos;identité nationale</option>
              <option value="Passeport">Passeport</option>
              {f.id_type && !["Carte d'identité nationale", "Passeport"].includes(f.id_type) && <option value={f.id_type}>{f.id_type}</option>}
            </select>
          </label>
          {field("id_number", "Numéro de la pièce")}
        </div>
        {codeChanged && client.customer_code && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Le code change : colis, factures, demandes de retrait et connexion du client passeront sur le nouveau code.
          </p>
        )}
        {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{err}</p>}
        <div className="mt-5 flex gap-3">
          <button type="button" className="btn" disabled={busy} onClick={() => void save()}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
