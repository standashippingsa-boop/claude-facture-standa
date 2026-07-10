"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Trash2, Plus, UserPlus, X } from "lucide-react";
import { assignMcCode, deleteClient, getClients, getVilles, upsertClient } from "@/lib/db";
import { Client, Ville } from "@/lib/types";
import { dateFr } from "@/lib/utils";
import { openDepotWhatsApp } from "@/lib/whatsapp";

const schema = z.object({
  customer_code: z.string().min(1, "Kòd obligatwa"),
  fullname: z.string().min(1, "Non obligatwa"),
  whatsapp: z.string().default(""),
  pickup_location: z.string().default(""),
  email: z.string().email("Email pa valid").or(z.literal("")).default(""),
  ville_id: z.string().min(1, "Chwazi vil kliyan an"),
  account_type: z.enum(["Personnel", "Business"], { errorMap: () => ({ message: "Chwazi tip kont lan" }) })
});
type Form = z.infer<typeof schema>;

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [villes, setVilles] = useState<Ville[]>([]);
  const [editing, setEditing] = useState<Client | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [mcClient, setMcClient] = useState<Client | null>(null);  // modal "Créer compte MCPACK"
  const [mcCode, setMcCode] = useState("");

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<Form>({ resolver: zodResolver(schema) });

  const load = () => Promise.all([getClients(), getVilles()])
    .then(([c, v]) => { setClients(c); setVilles(v); })
    .catch((e) => setNotice("Erè: " + e.message));
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); reset({ customer_code: "", fullname: "", whatsapp: "", pickup_location: "", email: "", ville_id: "", account_type: "Personnel" }); setShowForm(true); };
  const openEdit = (c: Client) => { setEditing(c); reset({ ...c, email: c.email ?? "", ville_id: c.ville_id ?? "", account_type: c.account_type ?? "Personnel" }); setShowForm(true); };

  const onSubmit = async (f: Form) => {
    try {
      await upsertClient({ ...f, id: editing?.id });
      setShowForm(false);
      setNotice(editing ? `Client ${f.customer_code} modifié.` : `Client ${f.customer_code} ajouté.`);
      load();
    } catch (e: any) {
      setNotice(e.message?.includes("duplicate") ? `Kòd "${f.customer_code}" egziste deja.` : "Erè: " + e.message);
    }
  };

  const saveMcCode = async () => {
    if (!mcClient || !mcCode.trim()) return;
    try {
      await assignMcCode(mcClient.id!, mcCode.trim());
      setNotice(`Code ${mcCode.trim()} anrejistre — kont ${mcClient.fullname} lan Actif kounye a. ` +
        `Sèvi ak bouton 📲 la pou voye adrès depo a.`);
      setMcClient(null); setMcCode("");
      load();
    } catch (e: any) {
      setNotice(e.message?.includes("duplicate") ? `Kòd "${mcCode}" egziste deja sou yon lòt kliyan.` : "Erè: " + e.message);
    }
  };

  const remove = async (c: Client) => {
    if (!confirm(`Efase client ${c.customer_code} — ${c.fullname}?`)) return;
    await deleteClient(c.id!); load();
  };

  const q = search.trim().toLowerCase();
  const filtered = q ? clients.filter((c) =>
    (c.customer_code ?? "").toLowerCase().includes(q) ||
    c.fullname.toLowerCase().includes(q) ||
    (c.surname ?? "").toLowerCase().includes(q) ||
    (c.email ?? "").toLowerCase().includes(q) ||
    (c.phone ?? "").toLowerCase().includes(q) ||
    c.whatsapp.toLowerCase().includes(q)) : clients;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-extrabold text-navy">Clients</h1>
        <div className="flex gap-3">
          <input className="input w-72" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher: code, nom, WhatsApp..." />
          <button className="btn" onClick={openNew}><Plus size={15} /> Nouveau client</button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="card p-5">
          <h2 className="text-sm font-bold text-navy uppercase tracking-wide mb-4">
            {editing ? `Modifier ${editing.customer_code}` : "Nouveau client"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {([["customer_code", "Code client *", "Ex: 36191"],
               ["fullname", "Nom complet *", "Ex: Jean Baptiste"],
               ["whatsapp", "WhatsApp", "Ex: +509 3712 3456"],
               ["pickup_location", "Lieu de récupération", "Ex: Biwo Delmas 33"],
               ["email", "Email (optionnel)", "ex@mail.com"]] as const).map(([k, label, ph]) => (
              <label key={k} className="block">
                <span className="text-xs font-medium text-slate-500">{label}</span>
                <input className="input mt-1" placeholder={ph} {...register(k)} />
                {errors[k] && <span className="text-xs text-red-600">{errors[k]!.message}</span>}
              </label>
            ))}
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Ville *</span>
              <select className="input mt-1" {...register("ville_id")}>
                <option value="">— Chwazi vil la —</option>
                {villes.filter((v) => v.active || v.id === editing?.ville_id).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}{!v.active ? " (inactif)" : ""}
                  </option>
                ))}
              </select>
              {errors.ville_id && <span className="text-xs text-red-600">{errors.ville_id.message}</span>}
              {villes.length === 0 && (
                <span className="text-xs text-amber-600">Poko gen vil — ajoute yo nan Paramètres &gt; Tarification.</span>
              )}
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Type de compte *</span>
              <select className="input mt-1" {...register("account_type")}>
                <option value="Personnel">Personnel</option>
                <option value="Business">Business</option>
              </select>
              {errors.account_type && <span className="text-xs text-red-600">{errors.account_type.message}</span>}
            </label>
          </div>
          <div className="mt-4 flex gap-3">
            <button type="submit" className="btn" disabled={isSubmitting}>
              {isSubmitting ? "Enregistrement..." : "Enregistrer"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Annuler</button>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr>
            {["Code", "Nom", "Statut", "Type", "Ville", "WhatsApp", "Lieu de récupération", "Email", "Créé le", ""].map((h) => (
              <th key={h} className="th">{h}</th>))}
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-10 text-slate-400">Aucun client.</td></tr>
            ) : filtered.map((c, i) => (
              <tr key={c.id} className={i % 2 ? "bg-mist" : ""}>
                <td className="td font-bold text-navy">
                  {c.customer_code ? (
                    <Link className="hover:underline" href={`/clients/${encodeURIComponent(c.customer_code)}`}>
                      {c.customer_code}
                    </Link>
                  ) : <span className="text-slate-400 font-normal text-xs">— pa gen kòd —</span>}
                </td>
                <td className="td">{[c.fullname, c.surname].filter(Boolean).join(" ")}</td>
                <td className="td">
                  <span className={`badge ${c.account_status === "Actif" || !c.account_status
                    ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {c.account_status ?? "Actif"}
                  </span>
                </td>
                <td className="td">
                  <span className={`badge ${c.account_type === "Business"
                    ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"}`}>
                    {c.account_type ?? "Personnel"}
                  </span>
                </td>
                <td className="td">
                  {c.ville ? (
                    <span className={`badge ${c.ville.active ? "bg-blue-50 text-navy" : "bg-slate-200 text-slate-500"}`}>
                      {c.ville.name}
                    </span>
                  ) : <span className="text-xs text-amber-600">Aucune ville</span>}
                </td>
                <td className="td">{c.whatsapp}</td>
                <td className="td">{c.pickup_location}</td>
                <td className="td">{c.email}</td>
                <td className="td">{dateFr(c.created_at)}</td>
                <td className="td text-right whitespace-nowrap">
                  {!c.customer_code ? (
                    <button className="btn !py-1 !px-2.5 !text-xs mr-2"
                      title="Wè enfòmasyon yo epi antre kòd MC a"
                      onClick={() => { setMcClient(c); setMcCode(""); }}>
                      <UserPlus size={13} /> Créer compte MCPACK
                    </button>
                  ) : (c.whatsapp || c.phone) ? (
                    <button className="mr-2 text-lg" title="📲 Voye adrès depo sou WhatsApp"
                      onClick={() => openDepotWhatsApp(c)}>📲</button>
                  ) : null}
                  <button className="text-navy hover:text-navy-light mr-3" onClick={() => openEdit(c)}><Pencil size={15} /></button>
                  <button className="text-slate-400 hover:text-red-600" onClick={() => remove(c)}><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {notice && <p className="card px-4 py-3 text-sm text-navy">{notice}</p>}

      {/* ===== Modal: Créer compte MCPACK ===== */}
      {mcClient && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setMcClient(null)}>
          <div className="card p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-navy uppercase tracking-wide">
                Créer compte MCPACK — {[mcClient.fullname, mcClient.surname].filter(Boolean).join(" ")}
              </h2>
              <button className="text-slate-400 hover:text-navy" onClick={() => setMcClient(null)}><X size={18} /></button>
            </div>

            <p className="text-xs text-slate-500">
              Kopye enfòmasyon sa yo sou MCPACK pou kreye kont lan, answit antre kòd MC MCPACK ba ou a anba.
            </p>

            <div className="text-sm border border-line rounded-lg divide-y divide-line">
              {([["Non", mcClient.fullname],
                 ["Siyati", mcClient.surname ?? ""],
                 ["Imèl", mcClient.email ?? ""],
                 ["Telefòn", mcClient.phone ?? ""],
                 ["WhatsApp", mcClient.whatsapp],
                 ["Peyi", mcClient.country ?? ""],
                 ["Vil", [mcClient.city, mcClient.city2].filter(Boolean).join(" / ")],
                 ["Adrès", mcClient.address ?? ""],
                 ["Idantifikasyon", `${mcClient.id_type ?? ""} ${mcClient.id_number ?? ""}`.trim()]] as const)
                .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-3 py-2">
                  <span className="text-slate-500 text-xs">{k}</span>
                  <span className="font-semibold text-right select-all">{v || "—"}</span>
                </div>
              ))}
            </div>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Code MC (bay pa MCPACK) *</span>
              <input className="input mt-1 font-mono" placeholder="Ex: MC-2547" value={mcCode}
                onChange={(e) => setMcCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveMcCode()} />
              <span className="text-[11px] text-slate-400">
                Lè w sove: kont lan vin <b>Actif</b> otomatikman epi bouton 📲 "Voye adrès depo" a ap parèt.
              </span>
            </label>

            <div className="flex gap-3">
              <button className="btn" onClick={saveMcCode} disabled={!mcCode.trim()}>Enregistrer le code</button>
              <button className="btn btn-ghost" onClick={() => setMcClient(null)}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
