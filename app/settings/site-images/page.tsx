"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Loader from "@/components/Loader";
import { ArrowLeft } from "@/components/icons";
import { useRole } from "@/lib/authx";
import { supabase } from "@/lib/supabase";
import { useNoticeToast } from "@/lib/notify";
import { SITE_IMAGE_BUCKET, SITE_IMAGE_SLOTS } from "@/lib/site-image-slots";

/** Images du site public : changer, ou revenir à l'image d'origine. */
export default function SiteImagesPage() {
  const { role, loading } = useRole();
  const [images, setImages] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useNoticeToast(notice, setNotice);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const api = useCallback(async (payload: Record<string, unknown>) => {
    const { data } = await supabase.auth.getSession();
    const res = await fetch("/api/site-images", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: data.session?.access_token ?? "", ...payload })
    });
    const j = await res.json().catch(() => ({ ok: false, reason: "Erreur réseau." }));
    if (!j.ok) throw new Error(j.reason ?? "Opération impossible.");
    return j;
  }, []);

  const load = useCallback(async () => {
    try { const j = await api({ action: "list" }); setImages(j.images ?? {}); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Chargement impossible."); }
  }, [api]);
  useEffect(() => { if (role === "admin") void load(); }, [role, load]);

  const upload = async (slot: string, file: File) => {
    setBusy(slot);
    try {
      const { path, token } = await api({ action: "upload_url", slot, type: file.type, size: file.size });
      const { error } = await supabase.storage.from(SITE_IMAGE_BUCKET).uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (error) throw new Error("Envoi de l'image impossible.");
      await api({ action: "set", slot, path });
      setNotice("Image remplacée. Elle apparaît sur le site d'ici une minute.");
      await load();
    } catch (e) { setNotice(e instanceof Error ? e.message : "Envoi impossible."); }
    finally { setBusy(null); }
  };

  const reset = async (slot: string) => {
    if (!confirm("Revenir à l'image d'origine ?")) return;
    setBusy(slot);
    try { await api({ action: "reset", slot }); await load(); setNotice("Image d'origine rétablie."); }
    catch (e) { setNotice(e instanceof Error ? e.message : "Opération impossible."); }
    finally { setBusy(null); }
  };

  if (loading) return <Loader inline />;
  if (role !== "admin") return <div className="card mx-auto max-w-md p-8 text-center text-sm">Accès réservé à l&apos;administrateur.</div>;

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="btn btn-ghost !px-2.5"><ArrowLeft size={16} /></Link>
        <h1 className="text-xl font-extrabold text-navy">Images du site</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {SITE_IMAGE_SLOTS.map((slot) => {
          const custom = images[slot.key];
          const src = custom || slot.fallback;
          return (
            <section key={slot.key} className="card overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={slot.label} className="h-40 w-full bg-slate-100 object-cover" />
              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-navy">{slot.label}</h2>
                  <span className={`badge ${custom ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{custom ? "Personnalisée" : "Origine"}</span>
                </div>
                <input ref={(el) => { inputs.current[slot.key] = el; }} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void upload(slot.key, file); }} />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn" disabled={busy !== null} onClick={() => inputs.current[slot.key]?.click()}>
                    {busy === slot.key ? "Envoi…" : "Changer l'image"}
                  </button>
                  {custom && <button type="button" className="btn btn-ghost border border-line" disabled={busy !== null} onClick={() => void reset(slot.key)}>Image d&apos;origine</button>}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
