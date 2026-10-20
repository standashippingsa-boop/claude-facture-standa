"use client";
/*
 * STANDA COMMERCIAL — ANNONCES (ADMIN)
 * Publier photos et vidéos + un message pour un PUBLIC choisi (tous les
 * clients, certaines villes, certains types de compte ou des clients précis).
 * Les médias défilent en diaporama sur l'accueil de l'espace client, et les
 * clients du public reçoivent une notification.
 */
import { useEffect, useState } from "react";
import { ImagePlus, Megaphone, Send, Trash2, Video, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BusyButton } from "@/components/Loader";
import { getVilles } from "@/lib/db";
import { dateFr } from "@/lib/utils";
import { notify } from "@/lib/notify";
import { announcementImageUrl, announcementMedia, type Announcement, type AudienceType } from "@/lib/announcements";
import type { Ville } from "@/lib/types";

const MAX_FILE = 50 * 1024 * 1024;
const MAX_FILES = 10;
const TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/webm"];
const ACCOUNT_TYPES = ["Personnel", "Business", "VIP"] as const;
type Picked = { file: File; url: string; kind: "image" | "video" };

export default function AnnoncesPage() {
  const [list, setList] = useState<Announcement[]>([]);
  const [villes, setVilles] = useState<Ville[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [picked, setPicked] = useState<Picked[]>([]);
  const [audience, setAudience] = useState<AudienceType>("all");
  const [villeIds, setVilleIds] = useState<string[]>([]);
  const [accountTypes, setAccountTypes] = useState<string[]>([]);
  const [clientCodes, setClientCodes] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  const token = async () => (await supabase.auth.getSession()).data.session?.access_token ?? "";
  const api = async (payload: Record<string, unknown>) => {
    const response = await fetch("/api/announcements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: await token(), ...payload }) });
    const json = await response.json().catch(() => ({ ok: false, reason: "Réponse illisible." }));
    if (!response.ok || !json.ok) throw new Error(json.reason || "Opération impossible.");
    return json;
  };
  const load = async () => {
    const response = await fetch("/api/announcements", { headers: { Authorization: `Bearer ${await token()}` }, cache: "no-store" });
    const json = await response.json().catch(() => ({}));
    if (json.ok) setList(json.announcements as Announcement[]);
  };
  useEffect(() => { void load(); getVilles().then((rows) => setVilles(rows.filter((ville) => ville.active))).catch(() => undefined); }, []);
  useEffect(() => () => picked.forEach((item) => URL.revokeObjectURL(item.url)), [picked]);

  const addFiles = (files: FileList | null) => {
    const next = [...picked];
    for (const file of Array.from(files ?? [])) {
      if (!TYPES.includes(file.type)) { notify.error(`${file.name} : format non accepté (JPG, PNG, WEBP, MP4, MOV, WEBM).`); continue; }
      if (file.size > MAX_FILE) { notify.error(`${file.name} : plus de 50 Mo.`); continue; }
      if (next.length >= MAX_FILES) { notify.error(`${MAX_FILES} fichiers maximum.`); break; }
      next.push({ file, url: URL.createObjectURL(file), kind: file.type.startsWith("video/") ? "video" : "image" });
    }
    setPicked(next);
  };
  const removeFile = (index: number) => setPicked((current) => current.filter((_, i) => i !== index));
  const toggle = (list: string[], value: string, set: (next: string[]) => void) => set(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  const audienceValues = audience === "villes" ? villeIds : audience === "account_types" ? accountTypes
    : audience === "clients" ? clientCodes.split(/[\s,;]+/).map((code) => code.trim()).filter(Boolean) : [];
  const audienceText = audience === "all" ? "TOUS les clients"
    : audience === "villes" ? `les clients de ${villes.filter((ville) => villeIds.includes(ville.id ?? "")).map((ville) => ville.name).join(", ")}`
    : audience === "account_types" ? `les comptes ${accountTypes.join(", ")}`
    : `${audienceValues.length} client(s) précis`;

  const publish = async () => {
    if (busy) return;
    if (!title.trim()) { notify.error("Écrivez un titre."); return; }
    if (audience !== "all" && !audienceValues.length) { notify.error("Choisissez le public de l'annonce."); return; }
    if (!confirm(`Publier cette annonce pour ${audienceText} et leur envoyer une notification ?`)) return;
    setBusy(true);
    try {
      let media: { path: string; kind: string }[] = [];
      if (picked.length) {
        setProgress("Préparation de l'envoi…");
        const { uploads } = await api({ action: "upload_urls", files: picked.map((item) => ({ type: item.file.type, size: item.file.size })) });
        for (let i = 0; i < picked.length; i++) {
          setProgress(`Envoi du fichier ${i + 1}/${picked.length}…`);
          const upload = uploads[i] as { path: string; token: string; kind: string };
          const { error } = await supabase.storage.from("announcements").uploadToSignedUrl(upload.path, upload.token, picked[i].file, { contentType: picked[i].file.type });
          if (error) throw new Error(`Envoi de ${picked[i].file.name} impossible.`);
          media.push({ path: upload.path, kind: upload.kind });
        }
      }
      setProgress("Publication…");
      const json = await api({ action: "publish", title: title.trim(), body: body.trim(), media, audience_type: audience, audience_values: audienceValues });
      notify.success(`Annonce publiée pour ${audienceText}. Notification envoyée à ${json.devices} téléphone(s).`, { title: "Annonce envoyée" });
      setTitle(""); setBody(""); setPicked([]); setAudience("all"); setVilleIds([]); setAccountTypes([]); setClientCodes("");
      media = [];
      await load();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Publication impossible.");
    } finally { setBusy(false); setProgress(""); }
  };

  const deactivate = async (item: Announcement) => {
    if (!confirm(`Retirer l'annonce « ${item.title} » ? Les clients ne la verront plus.`)) return;
    try { await api({ action: "deactivate", id: item.id }); await load(); }
    catch (error) { notify.error(error instanceof Error ? error.message : "Impossible de retirer l'annonce."); }
  };

  const describeAudience = (item: Announcement) => {
    const values = item.audience_values ?? [];
    if (!item.audience_type || item.audience_type === "all") return "Tous les clients";
    if (item.audience_type === "villes") return "Villes : " + values.map((id) => villes.find((ville) => ville.id === id)?.name ?? "?").join(", ");
    if (item.audience_type === "account_types") return "Comptes : " + values.join(", ");
    return `${values.length} client(s) : ${values.slice(0, 4).join(", ")}${values.length > 4 ? "…" : ""}`;
  };

  const chip = (active: boolean) => `min-h-9 rounded-lg border-2 px-3 text-xs font-bold ${active ? "border-navy bg-navy text-white" : "border-line bg-white text-slate-700"}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h-page flex items-center gap-2"><Megaphone size={22} /> Annonces</h1>
        <p className="mt-0.5 text-sm text-mute">Photos et vidéos en diaporama sur l&apos;accueil des clients choisis, avec une notification.</p>
      </div>

      <section className="card space-y-4 p-5">
        <label className="block text-xs font-bold uppercase tracking-wide text-mute">Titre
          <input className="input mt-1" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex. Challenge de Noël STANDA" disabled={busy} />
        </label>
        <label className="block text-xs font-bold uppercase tracking-wide text-mute">Message
          <textarea className="input mt-1 min-h-24" maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Du 5 novembre au 5 janvier…" disabled={busy} />
        </label>

        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-mute">Photos et vidéos · {picked.length}/{MAX_FILES}</p>
          <div className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {picked.map((item, index) => (
              <div key={item.url} className="relative aspect-square overflow-hidden rounded-lg border border-line bg-mist">
                {item.kind === "video"
                  ? <video src={item.url} muted playsInline className="h-full w-full object-cover" />
                  // eslint-disable-next-line @next/next/no-img-element
                  : <img src={item.url} alt="" className="h-full w-full object-cover" />}
                {item.kind === "video" && <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white"><Video size={11} className="inline" /> Vidéo</span>}
                <button type="button" onClick={() => removeFile(index)} disabled={busy} aria-label="Retirer" className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"><X size={13} /></button>
              </div>
            ))}
            {picked.length < MAX_FILES && (
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line text-center text-[11px] font-semibold text-navy hover:border-navy/40">
                <ImagePlus size={20} /> Ajouter
                <input type="file" multiple accept={TYPES.join(",")} className="hidden" disabled={busy} onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }} />
              </label>
            )}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">JPG, PNG, WEBP, MP4, MOV, WEBM · 50 Mo maximum par fichier. Les vidéos défilent sans le son.</p>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-mute">Qui verra l&apos;annonce ?</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {([["all", "Tous les clients"], ["villes", "Par ville"], ["account_types", "Par type de compte"], ["clients", "Clients précis"]] as const).map(([value, label]) => (
              <button key={value} type="button" disabled={busy} onClick={() => setAudience(value)} className={chip(audience === value)}>{label}</button>
            ))}
          </div>
          {audience === "villes" && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {villes.map((ville) => <button key={ville.id} type="button" disabled={busy} onClick={() => toggle(villeIds, ville.id ?? "", setVilleIds)} className={chip(villeIds.includes(ville.id ?? ""))}>{ville.name}</button>)}
            </div>
          )}
          {audience === "account_types" && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ACCOUNT_TYPES.map((type) => <button key={type} type="button" disabled={busy} onClick={() => toggle(accountTypes, type, setAccountTypes)} className={chip(accountTypes.includes(type))}>{type}</button>)}
            </div>
          )}
          {audience === "clients" && (
            <label className="mt-2 block text-[11px] text-slate-500">Codes clients, séparés par des espaces, virgules ou retours à la ligne
              <textarea className="input mt-1 min-h-20 font-mono" value={clientCodes} onChange={(e) => setClientCodes(e.target.value)} placeholder="MC-12345, MC-67890" disabled={busy} />
            </label>
          )}
          <p className="mt-2 text-xs font-semibold text-navy">Public : {audienceText}</p>
        </div>

        <BusyButton className="btn btn-brand" onClick={publish} busy={busy} disabled={!title.trim()} busyLabel={progress || "Publication…"}>
          <Send size={15} /> Publier et notifier
        </BusyButton>
      </section>

      <section className="card overflow-hidden">
        <h2 className="h-sec border-b border-line p-4">Annonces publiées</h2>
        {list.length === 0 ? <p className="p-6 text-center text-sm text-mute">Aucune annonce pour le moment.</p> : (
          <div className="divide-y divide-line">
            {list.map((item) => {
              const media = announcementMedia(item);
              const first = media[0];
              return (
                <article key={item.id} className="flex items-start gap-3 p-4">
                  {first && (first.kind === "video"
                    ? <video src={announcementImageUrl(first.path)} muted playsInline className="h-20 w-16 shrink-0 rounded-md object-cover" />
                    // eslint-disable-next-line @next/next/no-img-element
                    : <img src={announcementImageUrl(first.path)} alt="" className="h-20 w-16 shrink-0 rounded-md object-cover" />)}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-navy">{item.title}</p>
                    {item.body && <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{item.body}</p>}
                    <p className="mt-1 text-xs text-mute">{dateFr(item.created_at)} · {media.length} média(s) · {describeAudience(item)} · {item.active ? <span className="font-bold text-emerald-700">Visible</span> : "Retirée"}</p>
                  </div>
                  {item.active && <button type="button" onClick={() => void deactivate(item)} className="shrink-0 p-2 text-slate-400 hover:text-red-600" title="Retirer l'annonce"><Trash2 size={16} /></button>}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
