"use client";
/*
 * STANDA COMMERCIAL — ANNONCES (ADMIN)
 * Publier un flyer + un message pour TOUS les clients : il apparaît dans
 * leur application et ils reçoivent une notification sur leur téléphone.
 */
import { useEffect, useState } from "react";
import { ImagePlus, Megaphone, Send, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BusyButton } from "@/components/Loader";
import { dateFr } from "@/lib/utils";
import { notify } from "@/lib/notify";
import { announcementImageUrl, type Announcement } from "@/lib/announcements";

const MAX_IMAGE = 4 * 1024 * 1024;

export default function AnnoncesPage() {
  const [list, setList] = useState<Announcement[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const token = async () => (await supabase.auth.getSession()).data.session?.access_token ?? "";
  const load = async () => {
    const response = await fetch("/api/announcements", { headers: { Authorization: `Bearer ${await token()}` }, cache: "no-store" });
    const json = await response.json().catch(() => ({}));
    if (json.ok) setList(json.announcements as Announcement[]);
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = (next: File | null) => {
    if (next && !["image/jpeg", "image/png", "image/webp"].includes(next.type)) { notify.error("Image JPG, PNG ou WEBP uniquement."); return; }
    if (next && next.size > MAX_IMAGE) { notify.error("Image trop lourde (4 Mo maximum)."); return; }
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : null);
  };

  const publish = async () => {
    if (busy) return;
    if (!title.trim()) { notify.error("Écrivez un titre."); return; }
    if (!confirm("Publier cette annonce pour TOUS les clients et leur envoyer une notification ?")) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("token", await token());
      form.set("title", title.trim());
      form.set("body", body.trim());
      if (file) form.set("image", file);
      const response = await fetch("/api/announcements", { method: "POST", body: form });
      const json = await response.json().catch(() => ({ ok: false, reason: "Réponse illisible." }));
      if (!response.ok || !json.ok) throw new Error(json.reason || "Publication impossible.");
      notify.success(`Annonce publiée. Notification envoyée à ${json.devices} téléphone(s) (${json.clients} client(s) avec notifications activées).`, { title: "Annonce envoyée" });
      setTitle(""); setBody(""); pick(null);
      await load();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Publication impossible.");
    } finally { setBusy(false); }
  };

  const deactivate = async (item: Announcement) => {
    if (!confirm(`Retirer l'annonce « ${item.title} » ? Les clients ne la verront plus.`)) return;
    const response = await fetch("/api/announcements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: await token(), action: "deactivate", id: item.id }) });
    const json = await response.json().catch(() => ({}));
    if (!json.ok) { notify.error(json.reason || "Impossible de retirer l'annonce."); return; }
    await load();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h-page flex items-center gap-2"><Megaphone size={22} /> Annonces</h1>
        <p className="mt-0.5 text-sm text-mute">Envoyez un flyer et un message à tous les clients. Ils le voient dans leur application et reçoivent une notification.</p>
      </div>

      <section className="card space-y-3 p-5">
        <label className="block text-xs font-bold uppercase tracking-wide text-mute">Titre
          <input className="input mt-1" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex. Challenge de Noël STANDA" disabled={busy} />
        </label>
        <label className="block text-xs font-bold uppercase tracking-wide text-mute">Message
          <textarea className="input mt-1 min-h-28" maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Du 5 novembre au 5 janvier…" disabled={busy} />
        </label>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-mute">Flyer (image)</p>
          {preview
            ? <div className="mt-1 flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Aperçu du flyer" className="max-h-64 rounded-lg border border-line" />
                <button type="button" className="btn btn-ghost" onClick={() => pick(null)} disabled={busy}>Retirer</button>
              </div>
            : <label className="mt-1 flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-sm font-semibold text-navy hover:border-navy/40">
                <ImagePlus size={22} /> Choisir une image (JPG, PNG, WEBP · 4 Mo max)
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
              </label>}
        </div>
        <BusyButton className="btn btn-brand" onClick={publish} busy={busy} disabled={!title.trim()} busyLabel="Publication…">
          <Send size={15} /> Publier et notifier tous les clients
        </BusyButton>
      </section>

      <section className="card overflow-hidden">
        <h2 className="h-sec border-b border-line p-4">Annonces publiées</h2>
        {list.length === 0 ? <p className="p-6 text-center text-sm text-mute">Aucune annonce pour le moment.</p> : (
          <div className="divide-y divide-line">
            {list.map((item) => (
              <article key={item.id} className="flex items-start gap-3 p-4">
                {item.image_path && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={announcementImageUrl(item.image_path)} alt="" className="h-20 w-16 shrink-0 rounded-md object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-navy">{item.title}</p>
                  {item.body && <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{item.body}</p>}
                  <p className="mt-1 text-xs text-mute">{dateFr(item.created_at)} · {item.created_by || "—"} · {item.active ? <span className="font-bold text-emerald-700">Visible</span> : "Retirée"}</p>
                </div>
                {item.active && <button type="button" onClick={() => void deactivate(item)} className="shrink-0 p-2 text-slate-400 hover:text-red-600" title="Retirer l'annonce"><Trash2 size={16} /></button>}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
