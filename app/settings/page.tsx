"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Pencil, MapPin } from "lucide-react";
import {
  deleteVille, getSettings, getUsdRate,
  getVilles, setSetting, setUsdRate, toggleVille, upsertVille
} from "@/lib/db";
import { Ville } from "@/lib/types";
import { usd } from "@/lib/utils";

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
  const [villes, setVilles] = useState<Ville[]>([]);
  const [editing, setEditing] = useState<Ville | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [footer, setFooter] = useState("");
  const [autoPricing, setAutoPricing] = useState(true);
  const [rate, setRate] = useState("0");
  const [notice, setNotice] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<Form>({ resolver: zodResolver(schema) });

  const load = async () => {
    setVilles(await getVilles());
    const [s, r] = await Promise.all([getSettings(), getUsdRate()]);
    setFooter(s.invoice_footer ?? "");
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
      setShowForm(false);
      setNotice(editing ? `Ville "${f.name}" modifiée.` : `Ville "${f.name}" ajoutée.`);
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

  const saveGeneral = async () => {
    await setSetting("invoice_footer", footer);
    await setSetting("auto_pricing", String(autoPricing));
    setNotice("Paramètres enregistrés.");
  };

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
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={autoPricing} onChange={(e) => setAutoPricing(e.target.checked)} />
          Tarification automatique lors de la synchronisation MCPACK (selon la ville du client)
        </label>
        <button className="btn" onClick={saveGeneral}>Enregistrer</button>
      </section>

      {notice && <p className="card px-4 py-3 text-sm text-navy">{notice}</p>}
    </div>
  );
}
