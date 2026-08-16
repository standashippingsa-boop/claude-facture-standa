"use client";
import { useEffect, useState } from "react";
import RefreshButton from "@/components/RefreshButton";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Trash2, Plus, UserPlus, X } from "lucide-react";
import { DupGroup, deleteClient, findDuplicateGroups, getClients, getVilles, logAction, mergeClients, upsertClient } from "@/lib/db";
import { adminApi, useRole } from "@/lib/authx";
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
  // Apre aktivasyon: kredansyèl yo (pou montre + voye WhatsApp)
  const [creds, setCreds] = useState<{ client: Client; username: string; tempPassword: string } | null>(null);
  const { role } = useRole();
  const [dups, setDups] = useState<DupGroup[] | null>(null);   // modal Fusionner
  const [primaryPick, setPrimaryPick] = useState<Record<string, string>>({});
  const [merging, setMerging] = useState(false);

  const scanDups = async () => {
    const g = await findDuplicateGroups();
    const picks: Record<string, string> = {};
    g.forEach((gr) => {
      const def = gr.clients.find((c) => c.customer_code) ?? gr.clients[0];
      picks[gr.key] = def.id!;
    });
    setPrimaryPick(picks);
    setDups(g);
  };

  const doMerge = async (gr: DupGroup) => {
    const primary = gr.clients.find((c) => c.id === primaryPick[gr.key]);
    if (!primary) return;
    const others = gr.clients.filter((c) => c.id !== primary.id);
    if (!confirm(`Fusionner ${gr.clients.length} kont (${gr.reason}) sou "${[primary.fullname, primary.surname].filter(Boolean).join(" ")}" ` +
      `(${primary.customer_code || "san kòd"})? Tout koli/fakti ap transfere, lòt kont yo ap efase.`)) return;
    setMerging(true);
    try {
      for (const sec of others) await mergeClients(primary, sec);
      setNotice(`✅ Fusion fèt — ${others.length} kont doub efase, tout done yo sou ${primary.customer_code || primary.fullname}.`);
      setDups((prev) => (prev ?? []).filter((x) => x.key !== gr.key));
      load();
    } catch (e: any) { setNotice("Erè fusion: " + e.message); }
    finally { setMerging(false); }
  };

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
      const j = await adminApi("activate_client", { client_id: mcClient.id, mc_code: mcCode.trim() });
      if (!j.ok) { setNotice("Erè: " + (j.reason ?? "aktivasyon echwe")); return; }
      // Sistèm nan: aktive + username = MC-XXXXX + modpas tanporè jenere otomatikman
      setCreds({
        client: { ...mcClient, customer_code: j.username, account_status: "Actif" },
        username: j.username,
        tempPassword: j.temp_password
      });
      await logAction("Activation Client", `${mcClient.fullname} activé`, "", j.username);
      setMcClient(null); setMcCode("");
      load();
    } catch (e: any) {
      setNotice("Erè: " + (e.message ?? String(e)));
    }
  };

  /** 🔑 Rejenere yon modpas tanporè (si kliyan an bliye l anvan premye koneksyon) */
  const resetClientPassword = async (c: Client) => {
    if (!confirm(`Rejenere yon modpas tanporè pou ${c.fullname} (${c.customer_code})?`)) return;
    const j = await adminApi("reset_client_password", { client_id: c.id });
    if (!j.ok) { setNotice("Erè: " + (j.reason ?? "echwe")); return; }
    setCreds({ client: c, username: j.username, tempPassword: j.temp_password });
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
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="h-page">Clients</h1>
          <p className="text-sm text-mute mt-0.5">Gestion des clients — codes, villes & comptes</p>
        </div>
        <div className="flex gap-3">
          <input className="input w-72" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher: code, nom, WhatsApp..." />
          <button className="btn btn-ghost border border-line" onClick={scanDups} title="Detekte kliyan ki egziste 2 fwa">
          🔗 Fusionner les comptes
        </button>
        <RefreshButton onRefresh={load} />
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
        <table className="w-full text-xs">
          <thead><tr>
            {["Code", "Nom", "Statut", "Type", "Ville", "WhatsApp", "Lieu de récupération", "Email", "Créé le", ""].map((h) => (
              <th key={h} className="thc">{h}</th>))}
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-10 text-mute">Aucun client.</td></tr>
            ) : filtered.map((c, i) => (
              <tr key={c.id} className={i % 2 ? "bg-mist" : ""}>
                <td className="tdc font-bold text-navy">
                  {c.customer_code ? (
                    <Link className="hover:underline" href={`/clients/${encodeURIComponent(c.customer_code)}`}>
                      {c.customer_code}
                    </Link>
                  ) : <span className="text-slate-400 font-normal text-xs">— pa gen kòd —</span>}
                </td>
                <td className="tdc max-w-[130px] truncate" title={[c.fullname, c.surname].filter(Boolean).join(" ")}>
                  {[c.fullname, c.surname].filter(Boolean).join(" ")}</td>
                <td className="tdc">
                  <span className={`badge ${c.account_status === "Actif" || !c.account_status
                    ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {c.account_status ?? "Actif"}
                  </span>
                </td>
                <td className="tdc">
                  <span className={`badge ${c.account_type === "Business"
                    ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"}`}>
                    {c.account_type ?? "Personnel"}
                  </span>
                </td>
                <td className="tdc">
                  {c.ville ? (
                    <span className={`badge ${c.ville.active ? "bg-blue-50 text-navy" : "bg-slate-200 text-slate-500"}`}>
                      {c.ville.name}
                    </span>
                  ) : <span className="text-xs text-amber-600">Aucune ville</span>}
                </td>
                <td className="tdc">{c.whatsapp}</td>
                <td className="tdc">{c.pickup_location}</td>
                <td className="tdc">{c.email}</td>
                <td className="tdc">{dateFr(c.created_at)}</td>
                <td className="tdc text-right whitespace-nowrap">
                  {!c.customer_code ? (
                    <button className="btn !py-0.5 !px-2 !text-[11px] mr-1"
                      title="Wè enfòmasyon yo epi antre kòd MC a"
                      onClick={() => { setMcClient(c); setMcCode(""); }}>
                      <UserPlus size={12} /> MCPACK
                    </button>
                  ) : (
                    <>
                      {(c.whatsapp || c.phone) && (
                        <button className="mr-2 text-lg" title="📲 Voye adrès depo sou WhatsApp"
                          onClick={() => openDepotWhatsApp(c)}>📲</button>
                      )}
                      <button className="mr-2" title="🔑 Rejenere modpas tanporè kliyan an"
                        onClick={() => resetClientPassword(c)}>🔑</button>
                    </>
                  )}
                  <button className="text-navy hover:text-navy-light mr-3" onClick={() => openEdit(c)}><Pencil size={15} /></button>
                  {role === "admin" && (
                    <button className="text-slate-400 hover:text-red-600" onClick={() => remove(c)}><Trash2 size={15} /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {notice && <p className="card px-4 py-3 text-sm text-navy">{notice}</p>}

      {/* ===== Modal: Fusionner les comptes (V7.2) ===== */}
      {dups !== null && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setDups(null)}>
          <div className="card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-navy uppercase tracking-wide">🔗 Fusionner les comptes</h2>
              <button className="text-slate-400 hover:text-navy" onClick={() => setDups(null)}><X size={18} /></button>
            </div>
            {dups.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">✅ Pa gen okenn kliyan an doub — tout kont yo pwòp.</p>
            ) : dups.map((gr) => (
              <div key={gr.key} className="border border-line rounded-lg p-4 space-y-2">
                <p className="text-xs font-semibold text-amber-700">Menm {gr.reason} — chwazi kont pou KENBE a:</p>
                {gr.clients.map((c) => (
                  <label key={c.id} className="flex items-center gap-3 text-sm py-1 cursor-pointer">
                    <input type="radio" name={`g-${gr.key}`} checked={primaryPick[gr.key] === c.id}
                      onChange={() => setPrimaryPick((p) => ({ ...p, [gr.key]: c.id! }))} />
                    <span className="font-bold text-navy w-28">{c.customer_code || "— san kòd —"}</span>
                    <span className="flex-1 truncate">{[c.fullname, c.surname].filter(Boolean).join(" ")}</span>
                    <span className="text-xs text-slate-400 truncate max-w-[140px]">{c.email || c.whatsapp || c.phone}</span>
                    <span className={`badge ${c.account_status === "Actif" || !c.account_status
                      ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {c.account_status ?? "Actif"}</span>
                  </label>
                ))}
                <button className="btn !py-1.5 !text-xs" disabled={merging} onClick={() => doMerge(gr)}>
                  {merging ? "Ap fusione..." : "Fusionner ce groupe"}
                </button>
              </div>
            ))}
            <p className="text-[11px] text-slate-400">
              Koli, fakti ak retraits kont sekondè yo transfere sou kont ou kenbe a; answit kont doub yo efase.
              Anyen pa pèdi.
            </p>
          </div>
        </div>
      )}

      {/* ===== Modal: Kredansyèl kliyan (apre aktivasyon oswa reset) ===== */}
      {creds && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setCreds(null)}>
          <div className="card p-6 max-w-md w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-sm font-bold text-navy uppercase tracking-wide">
              ✅ Kont {[creds.client.fullname, creds.client.surname].filter(Boolean).join(" ")} aktive
            </h2>
            <div className="text-sm border border-line rounded-lg divide-y divide-line">
              <div className="flex justify-between gap-4 px-3 py-2">
                <span className="text-slate-500 text-xs">Nom d&apos;utilisateur</span>
                <span className="font-mono font-bold select-all">{creds.username}</span>
              </div>
              <div className="flex justify-between gap-4 px-3 py-2">
                <span className="text-slate-500 text-xs">Mot de passe temporaire</span>
                <span className="font-mono font-bold select-all">{creds.tempPassword}</span>
              </div>
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ⚠️ Modpas sa a parèt <b>yon sèl fwa</b>. Voye l bay kliyan an kounye a — nan premye
              koneksyon an, sistèm nan ap fòse l chwazi pwòp modpas pa li.
            </p>
            <div className="flex gap-3">
              {(creds.client.whatsapp || creds.client.phone) && (
                <button className="btn" onClick={() => openDepotWhatsApp(creds.client, creds.tempPassword)}>
                  📲 Voye adrès depo + kredansyèl yo
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => setCreds(null)}>Fèmen</button>
            </div>
          </div>
        </div>
      )}

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
