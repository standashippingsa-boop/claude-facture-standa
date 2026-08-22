"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import Loader from "@/components/Loader";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Pencil, MapPin, ArrowLeft } from "lucide-react";
import { useRole } from "@/lib/authx";
import { Agence, blankAgence, deleteAgence, getAllAgences, toggleAgence, upsertAgence } from "@/lib/agences";

/**
 * STANDA COMMERCIAL — PAJ ADMIN "AJANS / PWEN RETRAIT"
 * ══════════════════════════════════════════════════════
 * Admin sèlman (menm gad ak /settings — /settings/* deja ADMIN_ONLY nan
 * lib/access.ts + Sidebar la). Isit administratè a ka ajoute/modifye/
 * aktive-dezaktive/efase yon ajans SAN touche kòd la — chanjman parèt
 * sou paj piblik /agences tousuit (revalidate 60s).
 */
const schema = z.object({
  nom: z.string().min(1, "Non ajans lan obligatwa"),
  adresse: z.string().min(1, "Adrès obligatwa"),
  telephone: z.string().min(1, "Telefòn obligatwa"),
  whatsapp: z.string().default(""),
  horaire_1: z.string().default(""),
  horaire_2: z.string().default(""),
  note: z.string().default(""),
  ordre: z.coerce.number().default(0),
  active: z.boolean().default(true)
});
type Form = z.infer<typeof schema>;

export default function AgencesSettingsPage() {
  const { role, loading: roleLoading } = useRole();
  const [agences, setAgences] = useState<Agence[]>([]);
  const [editing, setEditing] = useState<Agence | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<Form>({ resolver: zodResolver(schema) });

  const load = async () => {
    setLoading(true);
    try { setAgences(await getAllAgences()); }
    catch (e: any) { setNotice("Erè: " + e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    reset(blankAgence());
    setShowForm(true);
  };
  const openEdit = (a: Agence) => { setEditing(a); reset(a); setShowForm(true); };

  const onSubmit = async (f: Form) => {
    try {
      await upsertAgence({ ...f, id: editing?.id });
      setShowForm(false);
      setNotice(`✅ Agence "${f.nom}" ${editing ? "modifiée" : "ajoutée"} avec succès.`);
      load();
    } catch (e: any) {
      setNotice(e.message?.includes("duplicate") || e.message?.includes("unique")
        ? `Une agence "${f.nom}" existe déjà.` : "Erè: " + e.message);
    }
  };

  const remove = async (a: Agence) => {
    if (!confirm(`Efase ajans "${a.nom}"?\nLi ap disparèt de paj piblik /agences lan.`)) return;
    try { await deleteAgence(a.id!); setNotice(`Ajans "${a.nom}" efase.`); load(); }
    catch (e: any) { setNotice("Erè: " + e.message); }
  };

  const toggle = async (a: Agence) => {
    try { await toggleAgence(a.id!, !a.active); load(); }
    catch (e: any) { setNotice("Erè: " + e.message); }
  };

  if (roleLoading) return <Loader inline />;
  if (role !== "admin") {
    return (
      <div className="card p-10 max-w-md mx-auto text-center space-y-3">
        <p className="text-4xl">🚫</p>
        <h1 className="text-lg font-extrabold text-navy">Accès refusé.</h1>
        <p className="text-sm text-slate-500">Sèlman Administrateur ki gen aksè nan Ajans / Pwen retrait.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link href="/settings" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-navy transition">
          <ArrowLeft size={14} /> Retour aux Paramètres
        </Link>
        <h1 className="mt-2 text-xl font-extrabold text-navy">Ajans / Pwen retrait</h1>
        <p className="mt-1 text-xs text-slate-500">
          Lis sa a parèt sou paj piblik <b>/agences</b> (sèlman ajans ki &quot;Actif&quot;).
          Chanjman ou fè isit yo parèt sou sit la nan yon minit.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-navy uppercase tracking-wide flex items-center gap-2">
            <MapPin size={15} /> Lis ajans yo
          </h2>
          <button className="btn" onClick={openNew}><Plus size={15} /> Ajouter une agence</button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit(onSubmit)} className="card p-5">
            <h3 className="text-sm font-bold text-navy mb-4">
              {editing ? `Modifier ${editing.nom}` : "Nouvelle agence"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Nom / Ville *</span>
                <input className="input mt-1" placeholder="Ex: Ouanaminthe" {...register("nom")} />
                {errors.nom && <span className="text-xs text-red-600">{errors.nom.message}</span>}
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Ordre d&apos;affichage</span>
                <input className="input mt-1" type="number" placeholder="1" {...register("ordre")} />
              </label>
              <label className="block md:col-span-2">
                <span className="text-xs font-medium text-slate-500">Adresse *</span>
                <input className="input mt-1" placeholder="Ex: Rue la Liberté, Maranatha Entreprise" {...register("adresse")} />
                {errors.adresse && <span className="text-xs text-red-600">{errors.adresse.message}</span>}
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Téléphone *</span>
                <input className="input mt-1" placeholder="+509 4673 8117" {...register("telephone")} />
                {errors.telephone && <span className="text-xs text-red-600">{errors.telephone.message}</span>}
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">WhatsApp (chif sèlman, san +)</span>
                <input className="input mt-1" placeholder="50946738117" {...register("whatsapp")} />
                <span className="text-[11px] text-mute">Kite vid si ajans lan pa gen WhatsApp separe.</span>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Horaires — ligne 1</span>
                <input className="input mt-1" placeholder="Lundi – Samedi : 08h00 – 17h00" {...register("horaire_1")} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Horaires — ligne 2</span>
                <input className="input mt-1" placeholder="Dimanche : Fermé" {...register("horaire_2")} />
              </label>
              <label className="block md:col-span-2">
                <span className="text-xs font-medium text-slate-500">Note spéciale (optionnel)</span>
                <input className="input mt-1" placeholder="Ex: Service de livraison seulement (Mardi et Samedi)" {...register("note")} />
              </label>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("active")} /> Agence active (visible sur /agences)
            </label>
            <div className="mt-4 flex gap-3">
              <button type="submit" className="btn" disabled={isSubmitting}>Enregistrer</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Annuler</button>
            </div>
          </form>
        )}

        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr>{["#", "Nom", "Adresse", "Téléphone", "Horaires", "Statut", ""]
              .map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">Chargement…</td></tr>
              ) : agences.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">
                  Aucune agence. Ajoutez la première.
                </td></tr>
              ) : agences.map((a, i) => (
                <tr key={a.id} className={i % 2 ? "bg-mist" : ""}>
                  <td className="td text-slate-400">{a.ordre}</td>
                  <td className="td font-semibold text-navy">{a.nom}</td>
                  <td className="td max-w-[220px] truncate" title={a.adresse}>{a.adresse}</td>
                  <td className="td whitespace-nowrap">{a.telephone}</td>
                  <td className="td text-xs text-slate-500">
                    {a.horaire_1}{a.horaire_2 ? <><br />{a.horaire_2}</> : null}
                  </td>
                  <td className="td">
                    <button onClick={() => toggle(a)}
                      className={`badge cursor-pointer ${a.active
                        ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}
                      title="Klike pou chanje estati a">
                      {a.active ? "Actif" : "Inactif"}
                    </button>
                  </td>
                  <td className="td text-right whitespace-nowrap">
                    <button className="text-navy mr-3" onClick={() => openEdit(a)}><Pencil size={15} /></button>
                    <button className="text-slate-400 hover:text-red-600" onClick={() => remove(a)}><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {notice && <p className="card px-4 py-3 text-sm text-navy">{notice}</p>}
    </div>
  );
}
