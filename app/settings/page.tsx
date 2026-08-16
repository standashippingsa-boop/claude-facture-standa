"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Pencil, MapPin } from "lucide-react";
import {
  deleteVille, getSettings, getUsdRate,
  fixTrackingColumns, getVilles, logAction, reapplyTarifDisponible, setSetting, setUsdRate, toggleVille, upsertVille
} from "@/lib/db";
import { Staff, Ville } from "@/lib/types";
import { validateUpload, storagePath } from "@/lib/upload";
import { usd } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { adminApi, useRole } from "@/lib/authx";

const schema = z.object({
  name: z.string().min(1, "Non vil la obligatwa"),
  price_personal: z.coerce.number().min(0, "Dwe >= 0"),
  price_business: z.coerce.number().min(0, "Dwe >= 0"),
  tax_personal: z.coerce.number().min(0, "Dwe >= 0"),
  tax_business: z.coerce.number().min(0, "Dwe >= 0"),
  fixed_fee: z.coerce.number().min(0, "Dwe >= 0"),
  active: z.boolean().default(true)
});
type Form = z.infer<typeof schema>;

export default function SettingsPage() {
  const { role, loading: roleLoading } = useRole();
  const [villes, setVilles] = useState<Ville[]>([]);
  const [editing, setEditing] = useState<Ville | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [footer, setFooter] = useState("");
  const [mcpackConduceUrl, setMcpackConduceUrl] = useState("");
  const [autoPricing, setAutoPricing] = useState(true);
  const [taxFixOn, setTaxFixOn] = useState(false);
  const [taxDgaOn, setTaxDgaOn] = useState(false);
  const [spMin, setSpMin] = useState("0.10");
  const [spMax, setSpMax] = useState("0.99");
  const [spPrice, setSpPrice] = useState("3.70");
  const [rate, setRate] = useState("0");
  const [notice, setNotice] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<Form>({ resolver: zodResolver(schema) });

  const load = async () => {
    setVilles(await getVilles());
    const [s, r] = await Promise.all([getSettings(), getUsdRate()]);
    setFooter(s.invoice_footer ?? "");
    setMcpackConduceUrl(s.mcpack_conduce_url ?? "");
    setTaxFixOn(s.tax_fix_enabled === "true");
    setTaxDgaOn(s.tax_dga_enabled === "true");
    setSpMin(s.small_parcel_min ?? "0.10");
    setSpMax(s.small_parcel_max ?? "0.99");
    setSpPrice(s.small_parcel_price ?? "3.70");
    setAutoPricing(s.auto_pricing !== "false");
    setRate(String(r));
  };
  useEffect(() => { load().catch((e) => setNotice("Erè: " + e.message)); }, []);

  const openNew = () => {
    setEditing(null);
    reset({ name: "", price_personal: 0, price_business: 0, tax_personal: 0, tax_business: 0, fixed_fee: 0, active: true });
    setShowForm(true);
  };
  const openEdit = (v: Ville) => { setEditing(v); reset(v); setShowForm(true); };

  const onSubmit = async (f: Form) => {
    try {
      await upsertVille({ ...f, id: editing?.id });
      await logAction("Modification Prix", `Ville ${f.name}: ${f.price_personal}/${f.price_business} USD/lb`, "", "");
      let extra = "";
      if (editing) {
        const n = await reapplyTarifDisponible();
        extra = n > 0 ? ` — ${n} colis Disponible re-tarifés automatiquement.` : "";
      }
      setShowForm(false);
      setNotice(`✅ Ville "${f.name}" ${editing ? "modifiée" : "ajoutée"} avec succès.${extra}`);
      load();
    } catch (e: any) {
      setNotice(e.message?.includes("duplicate")
        ? `Vil "${f.name}" egziste deja.` : "Erè: " + e.message);
    }
  };

  const remove = async (v: Ville) => {
    if (!confirm(`Efase ville "${v.name}"?\n(Kliyan ki te lye ak vil sa a ap rete san vil — w ap bezwen ba yo yon lòt.)`)) return;
    try { await deleteVille(v.id!); load(); }
    catch (e: any) { setNotice("Erè: " + e.message); }
  };

  const toggle = async (v: Ville) => {
    await toggleVille(v.id!, !v.active);
    load();
  };

  const corrigerTracking = async () => {
    if (!confirm("Analyser toute la base et corriger les colonnes Tracking ID / Tracking Number mal placées?")) return;
    try {
      const r = await fixTrackingColumns();
      setNotice(`✅ Correction terminée: ${r.swapped} inversés, ${r.movedToId} corrigés (Guía), ${r.movedToManual} nettoyés.`);
    } catch (e: any) { setNotice("Erè: " + e.message); }
  };

  const saveGeneral = async () => {
    await setSetting("invoice_footer", footer);
    await setSetting("mcpack_conduce_url", mcpackConduceUrl);
    await setSetting("tax_fix_enabled", String(taxFixOn));
    await setSetting("tax_dga_enabled", String(taxDgaOn));
    await setSetting("small_parcel_min", String(Number(spMin) || 0.1));
    await setSetting("small_parcel_max", String(Number(spMax) || 0.99));
    await setSetting("small_parcel_price", String(Number(spPrice) || 3.7));
    await setSetting("auto_pricing", String(autoPricing));
    setNotice("Paramètres enregistrés.");
  };

  if (roleLoading) return <p className="text-slate-400">Ap verifye aksè...</p>;
  if (role !== "admin") {
    return (
      <div className="card p-10 max-w-md mx-auto text-center space-y-3">
        <p className="text-4xl">🚫</p>
        <h1 className="text-lg font-extrabold text-navy">Accès refusé.</h1>
        <p className="text-sm text-slate-500">Sèlman Administrateur ki gen aksè nan Paramètres.</p>
      </div>
    );
  }
  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-xl font-extrabold text-navy">Paramètres</h1>

      {/* ===== Tarification par ville ===== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-navy uppercase tracking-wide flex items-center gap-2">
            <MapPin size={15} /> Tarification par ville
          </h2>
          <button className="btn" onClick={openNew}><Plus size={15} /> Ajouter une ville</button>
        </div>
        <p className="text-xs text-slate-500">
          Tout tarif yo an <b>USD</b>. Pri = Pwa × Prix/lb (Personnel oswa Business) + Frais fixe.
          Tax = Pwa × Tax/lb. Chak kliyan lye ak yon vil ak yon tip kont (meni Clients) —
          lè w chanje tarif yon vil, tout <b>nouvo</b> fakti itilize nouvo tarif la otomatikman.
        </p>
        <p className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">
          <b>Petits colis (0.10–0.99 lb):</b> yo kalkile <b>Pwa × Prix/lb</b> vil la,
          menm jan ak tout lòt koli. Ex: 3.99 USD/lb × 0.60 lb = 2.39 USD.
        </p>

        {showForm && (
          <form onSubmit={handleSubmit(onSubmit)} className="card p-5">
            <h3 className="text-sm font-bold text-navy mb-4">
              {editing ? `Modifier ${editing.name}` : "Nouvelle ville"}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {([["name", "Ville *", "Ex: Port-au-Prince"],
                 ["price_personal", "Prix Personnel / lb (USD) *", "1.90"],
                 ["price_business", "Prix Business / lb (USD) *", "1.60"],
                 ["tax_personal", "Tax Personnel / lb (USD)", "0.20"],
                 ["tax_business", "Tax Business / lb (USD)", "0.15"],
                 ["fixed_fee", "Frais fixe (USD)", "0"]] as const).map(([k, label, ph]) => (
                <label key={k} className="block">
                  <span className="text-xs font-medium text-slate-500">{label}</span>
                  <input className="input mt-1" placeholder={ph} {...register(k)} />
                  {errors[k] && <span className="text-xs text-red-600">{String(errors[k]!.message)}</span>}
                </label>
              ))}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("active")} /> Ville active
            </label>
            <div className="mt-4 flex gap-3">
              <button type="submit" className="btn" disabled={isSubmitting}>Enregistrer</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Annuler</button>
            </div>
          </form>
        )}

        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr>{["Ville", "Prix Perso/lb", "Prix Business/lb", "Tax Perso/lb", "Tax Business/lb", "Frais fixe", "Statut", ""]
              .map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>
              {villes.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-slate-400">
                  Aucune ville. Ajoutez la première (ex: Port-au-Prince).
                </td></tr>
              ) : villes.map((v, i) => (
                <tr key={v.id} className={i % 2 ? "bg-mist" : ""}>
                  <td className="td font-semibold text-navy">{v.name}</td>
                  <td className="td">{usd(v.price_personal)}</td>
                  <td className="td">{usd(v.price_business)}</td>
                  <td className="td">{usd(v.tax_personal)}</td>
                  <td className="td">{usd(v.tax_business)}</td>
                  <td className="td">{Number(v.fixed_fee) ? usd(v.fixed_fee) : "—"}</td>
                  <td className="td">
                    <button onClick={() => toggle(v)}
                      className={`badge cursor-pointer ${v.active
                        ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}
                      title="Klike pou chanje estati a">
                      {v.active ? "Actif" : "Inactif"}
                    </button>
                  </td>
                  <td className="td text-right whitespace-nowrap">
                    <button className="text-navy mr-3" onClick={() => openEdit(v)}><Pencil size={15} /></button>
                    <button className="text-slate-400 hover:text-red-600" onClick={() => remove(v)}><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ===== Taux de change ===== */}
      <section className="card p-5 space-y-3">
        <h2 className="text-sm font-bold text-navy uppercase tracking-wide">Taux de change</h2>
        <p className="text-xs text-slate-500">
          Tout <b>nouvo</b> fakti itilize taux sa a. Ansyen fakti yo pa chanje —
          taux ki te itilize lè yo te kreye a rete anrejistre nan bazdone a.
        </p>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-navy">1 USD =</span>
          <input className="input !w-32 text-right" type="number" step="0.01" value={rate}
            onChange={(e) => setRate(e.target.value)} />
          <span className="text-sm font-semibold text-navy">HTG</span>
          <button className="btn" onClick={async () => {
            const r = Number(rate);
            if (!r || r <= 0) { setNotice("Taux la dwe pi gran pase 0."); return; }
            await setUsdRate(r);
            setNotice(`Taux enregistré: 1 USD = ${r.toFixed(2)} HTG. Tout nouvo facture ap itilize l.`);
          }}>Enregistrer le taux</button>
        </div>
      </section>

      {/* ===== Général ===== */}
      <section className="card p-5 space-y-4">
        <h2 className="text-sm font-bold text-navy uppercase tracking-wide">Général</h2>
        <p className="text-xs text-slate-500 bg-mist rounded-lg px-3 py-2">
          ℹ️ Petits colis (0.10–0.99 lb): depi v8, yo kalkile <b>Pwa × Prix/lb vil la</b> menm
          jan ak tout lòt koli (ex: 3.99 USD/lb × 0.60 lb = 2.39 USD). Pa gen pri fiks ankò.
        </p>
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Pied de page des factures</span>
          <input className="input mt-1" value={footer} onChange={(e) => setFooter(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500">
            Lien direct MCPACK pour une Conduce (utilise <code>{"{num}"}</code> comme numéro)
          </span>
          <input className="input mt-1 font-mono text-xs" placeholder="https://mcpack.exemple.com/conduce/{num}"
            value={mcpackConduceUrl} onChange={(e) => setMcpackConduceUrl(e.target.value)} />
          <span className="text-[11px] text-mute">
            Permet d&apos;ouvrir directement la conduce sur MCPACK depuis Synchronisation → Importer des Conduces.
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={autoPricing} onChange={(e) => setAutoPricing(e.target.checked)} />
          Tarification automatique lors de la synchronisation MCPACK (selon la ville du client)
        </label>
        <div className="border-t border-line pt-3 space-y-2">
          <p className="text-xs font-bold text-navy uppercase tracking-wide">Composition des factures</p>
          <p className="text-[11px] text-slate-500">
            Kolòn <b>Prix USD / HTG</b> yo montre <b>sèlman pri transpò a</b>. Tax yo rete anrejistre
            nan sistèm nan, men yo antre nan kalkil fakti a SÈLMAN si w aktive yo isit la.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={taxFixOn} onChange={(e) => setTaxFixOn(e.target.checked)} />
            Inclure <b>Tax Fix</b> dans les factures (tax/lb + frais fixe de la ville)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={taxDgaOn} onChange={(e) => setTaxDgaOn(e.target.checked)} />
            Inclure <b>Tax DGA</b> (douane — saisie manuelle sur chaque facture)
          </label>
        </div>
        <div className="border-t border-line pt-3 space-y-2">
          <p className="text-xs font-bold text-navy uppercase tracking-wide">Tarification des petits colis</p>
          <p className="text-[11px] text-slate-500">
            Lè administratè a chwazi mòd <b>Contrôle des petits colis</b> sou yon fakti, tout koli ki nan
            entèval sa a pran pri fiks la (olye pwa × pri/lb).
          </p>
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="text-xs text-slate-600">Poids min (lb)</span>
              <input type="number" step="0.01" min="0" className="input mt-1" value={spMin}
                onChange={(e) => setSpMin(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs text-slate-600">Poids max (lb)</span>
              <input type="number" step="0.01" min="0" className="input mt-1" value={spMax}
                onChange={(e) => setSpMax(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs text-slate-600">Prix fixe (USD)</span>
              <input type="number" step="0.01" min="0" className="input mt-1" value={spPrice}
                onChange={(e) => setSpPrice(e.target.value)} />
            </label>
          </div>
        </div>
        <button className="btn" onClick={saveGeneral}>Enregistrer</button>
      </section>

      {/* ===== MAINTENANCE (V8.5) ===== */}
      <section className="card p-6 space-y-3">
        <h2 className="text-sm font-bold text-navy uppercase tracking-wide">🔧 Maintenance</h2>
        <p className="text-xs text-slate-500">
          <b>Tracking ID (Guía)</b> se tout kòd ki kòmanse ak <b>WR</b> (ex: WR102600143471).
          Tout lòt (GFUS, TBA, 1Z, 9400...) se <b>Tracking Number</b>. Bouton sa a analize tout
          bazdone a epi korije koli kote de kolòn sa yo melanje.
        </p>
        <button className="btn btn-ghost border border-line" onClick={corrigerTracking}>
          Corriger les colonnes Tracking
        </button>
      </section>

      {role === "admin" && <ApiTokensSection onNotice={setNotice} />}

      <EmployesSection onNotice={setNotice} />

      {notice && <p className="card px-4 py-3 text-sm text-navy">{notice}</p>}
    </div>
  );
}

// ================= EMPLOYÉS (v9 — admin sèlman) =================
function EmployesSection({ onNotice }: { onNotice: (s: string) => void }) {
  const [list, setList] = useState<Staff[]>([]);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ nom: "", prenom: "", email: "", phone: "", id_number: "",
    username: "", password: "", role: "employe" as "employe" | "admin" });
  const [photo, setPhoto] = useState<File | null>(null);

  const load = () => supabase.from("staff").select("*").order("created_at")
    .then(({ data }: { data: Staff[] | null }) => setList((data ?? []) as Staff[]));
  useEffect(() => { load(); }, []);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  const save = async () => {
    if (!f.nom || !f.prenom || !f.username || f.password.length < 6) {
      onNotice("Nom, Prénom, Nom d'utilisateur ak Mot de passe (6+ karaktè) obligatwa."); return;
    }
    setBusy(true);
    try {
      let id_photo_url = "";
      if (photo) {
        // SEKIRITE: verifye tip/gwosè vre anvan telechajman
        const check = validateUpload(photo, "image-or-pdf");
        if (!check.ok) { onNotice(check.reason ?? "Fichier refusé."); return; }
        const path = storagePath(check.filename, "id/");
        const { error } = await supabase.storage.from("staff-docs")
          .upload(path, photo, { upsert: false, contentType: photo.type || "application/octet-stream" });
        if (!error) id_photo_url = supabase.storage.from("staff-docs").getPublicUrl(path).data.publicUrl;
      }
      const j = await adminApi("create_staff", { ...f, id_photo_url });
      if (!j.ok) { onNotice("Erè: " + j.reason); return; }
      onNotice(`${f.role === "admin" ? "Administrateur" : "Employé"} "${f.username}" kreye — li ka konekte sou /admin-login.`);
      setShow(false);
      setF({ nom: "", prenom: "", email: "", phone: "", id_number: "", username: "", password: "", role: "employe" });
      setPhoto(null);
      load();
    } finally { setBusy(false); }
  };

  const remove = async (s: Staff) => {
    if (!confirm(`Efase kont "${s.username}" (${s.prenom} ${s.nom})?`)) return;
    const j = await adminApi("delete_staff", { staff_id: s.id });
    if (!j.ok) { onNotice("Erè: " + j.reason); return; }
    load();
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-navy uppercase tracking-wide">👥 Employés</h2>
        <button className="btn" onClick={() => setShow((s) => !s)}>+ Nouvel Employé</button>
      </div>

      {show && (
        <div className="card p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block"><span className="text-xs font-medium text-slate-500">Nom *</span>
              <input className="input mt-1" value={f.nom} onChange={set("nom")} /></label>
            <label className="block"><span className="text-xs font-medium text-slate-500">Prénom *</span>
              <input className="input mt-1" value={f.prenom} onChange={set("prenom")} /></label>
            <label className="block"><span className="text-xs font-medium text-slate-500">Email</span>
              <input className="input mt-1" value={f.email} onChange={set("email")} /></label>
            <label className="block"><span className="text-xs font-medium text-slate-500">Téléphone</span>
              <input className="input mt-1" value={f.phone} onChange={set("phone")} /></label>
            <label className="block"><span className="text-xs font-medium text-slate-500">No Passeport / Carte d&apos;identité</span>
              <input className="input mt-1" value={f.id_number} onChange={set("id_number")} /></label>
            <label className="block"><span className="text-xs font-medium text-slate-500">Photo Passeport / CIN</span>
              <input type="file" accept="image/*,.pdf" className="input mt-1 !py-1.5"
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></label>
            <label className="block"><span className="text-xs font-medium text-slate-500">Nom d&apos;utilisateur *</span>
              <input className="input mt-1" value={f.username} onChange={set("username")} /></label>
            <label className="block"><span className="text-xs font-medium text-slate-500">Mot de passe * (6+)</span>
              <input type="password" className="input mt-1" value={f.password} onChange={set("password")} /></label>
            <label className="block"><span className="text-xs font-medium text-slate-500">Rôle</span>
              <select className="input mt-1" value={f.role} onChange={set("role")}>
                <option value="employe">Employé</option>
                <option value="admin">Administrateur</option>
              </select></label>
          </div>
          <div className="flex gap-3">
            <button className="btn" onClick={save} disabled={busy}>{busy ? "Ap kreye..." : "Enregistrer"}</button>
            <button className="btn btn-ghost" onClick={() => setShow(false)}>Annuler</button>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr>{["Utilisateur", "Nom", "Rôle", "Téléphone", "Pièce", ""].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-slate-400">Poko gen employé.</td></tr>
            ) : list.map((s, i) => (
              <tr key={s.id} className={i % 2 ? "bg-mist" : ""}>
                <td className="td font-bold text-navy">{s.username}</td>
                <td className="td">{s.prenom} {s.nom}</td>
                <td className="td"><span className={`badge ${s.role === "admin" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {s.role === "admin" ? "Administrateur" : "Employé"}</span></td>
                <td className="td">{s.phone}</td>
                <td className="td text-xs">{s.id_number}{s.id_photo_url && <> · <a className="text-navy underline" href={s.id_photo_url} target="_blank">foto</a></>}</td>
                <td className="td text-right">
                  <button className="text-slate-400 hover:text-red-600 text-xs" onClick={() => remove(s)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ================= API TOKENS (Extension Chrome — admin sèlman) =================
function ApiTokensSection({ onNotice }: { onNotice: (s: string) => void }) {
  const [tokens, setTokens] = useState<import("@/lib/db").ApiToken[]>([]);
  const [label, setLabel] = useState("Extension Chrome");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { getApiTokens } = await import("@/lib/db");
    setTokens(await getApiTokens());
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    setBusy(true);
    try {
      const { createApiToken } = await import("@/lib/db");
      const t = await createApiToken(label);
      setNewToken(t);
      await load();
    } catch (e) { onNotice("Erè: " + (e as Error).message); }
    finally { setBusy(false); }
  };

  const toggle = async (id: string, active: boolean) => {
    const { setApiTokenActive } = await import("@/lib/db");
    await setApiTokenActive(id, active); await load();
  };
  const remove = async (id: string) => {
    if (!confirm("Efase token sa a? Ekstansyon ki itilize l ap sispann mache.")) return;
    const { deleteApiToken } = await import("@/lib/db");
    await deleteApiToken(id); await load();
  };

  return (
    <section className="card p-6 space-y-3">
      <h2 className="text-sm font-bold text-navy uppercase tracking-wide">🔌 API — Extension Chrome</h2>
      <p className="text-xs text-slate-500">
        Kreye yon token pou konekte ekstansyon Chrome MCPACK la. Kopye token an yon sèl fwa
        epi kole l nan konfigirasyon ekstansyon an. Chak koli ki soti nan ekstansyon an
        antre ak <b>Tracking ID (Guía)</b> ak <b>Tracking Number</b> byen separe.
      </p>

      <div className="flex gap-2 items-end flex-wrap">
        <label className="block">
          <span className="text-xs text-slate-600">Non (pou rekonèt li)</span>
          <input className="input mt-1" value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <button className="btn" onClick={create} disabled={busy}>
          {busy ? "..." : "Générer un token"}
        </button>
      </div>

      {newToken && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <p className="text-xs font-bold text-emerald-800 mb-1">✅ Nouvo token (kopye l KOUNYE A — li p ap parèt ankò):</p>
          <code className="block bg-white border border-emerald-200 rounded px-2 py-1.5 text-xs break-all select-all">{newToken}</code>
          <button className="text-xs text-emerald-700 underline mt-1"
            onClick={() => { navigator.clipboard?.writeText(newToken); onNotice("Token kopye."); }}>
            Kopye token an
          </button>
        </div>
      )}

      {tokens.length > 0 && (
        <table className="w-full text-sm mt-2">
          <thead><tr className="text-left text-slate-500 text-xs border-b border-line">
            <th className="th">Non</th><th className="th">État</th><th className="th">Dernière utilisation</th><th className="th"></th>
          </tr></thead>
          <tbody>
            {tokens.map((t) => (
              <tr key={t.id} className="border-b border-line/60">
                <td className="td">{t.label}</td>
                <td className="td">
                  <button className={t.active ? "text-emerald-600" : "text-slate-400"}
                    onClick={() => toggle(t.id, !t.active)}>
                    {t.active ? "● Actif" : "○ Inactif"}
                  </button>
                </td>
                <td className="td text-slate-500 text-xs">{t.last_used_at ? new Date(t.last_used_at).toLocaleString() : "—"}</td>
                <td className="td text-right">
                  <button className="text-slate-400 hover:text-red-600 text-xs" onClick={() => remove(t.id)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
