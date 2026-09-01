"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, MessageSquareText, Star } from "lucide-react";
import Loader from "@/components/Loader";
import RefreshButton from "@/components/RefreshButton";
import { supabase } from "@/lib/supabase";

type AdminReview = {
  id: string;
  author_name: string;
  rating: number;
  message: string;
  is_visible: boolean;
  moderated_at: string | null;
  created_at: string;
};

type ApiResponse = { reviews?: AdminReview[]; review?: AdminReview; error?: string };

function date(value: string) {
  return new Intl.DateTimeFormat("fr-HT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function Rating({ value }: { value: number }) {
  return <span className="flex gap-0.5" aria-label={`${value} étoiles sur 5`}>{Array.from({ length: 5 }, (_, index) => <Star key={index} size={15} className={index < value ? "fill-amber-400 text-amber-400" : "text-slate-300"} />)}</span>;
}

export default function ReviewsAdminPage() {
  const [reviews, setReviews] = useState<AdminReview[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function request(body: Record<string, unknown>) {
    const { data } = await supabase.auth.getSession();
    const response = await fetch("/api/admin/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, token: data.session?.access_token ?? "" })
    });
    const json = await response.json() as ApiResponse;
    if (!response.ok) throw new Error(json.error || "Action impossible.");
    return json;
  }

  async function load() {
    setNotice(null);
    try {
      const data = await request({ action: "list" });
      setReviews(data.reviews ?? []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Impossible de charger les commentaires.");
      setReviews([]);
    }
  }

  useEffect(() => { void load(); }, []);

  async function changeVisibility(review: AdminReview) {
    setBusyId(review.id); setNotice(null);
    try {
      const data = await request({ action: "visibility", id: review.id, visible: !review.is_visible });
      if (data.review) setReviews((current) => current?.map((item) => item.id === review.id ? data.review! : item) ?? null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Modification impossible.");
    } finally { setBusyId(null); }
  }

  const visible = reviews?.filter((review) => review.is_visible).length ?? 0;
  const masked = reviews ? reviews.length - visible : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="h-page flex items-center gap-2"><MessageSquareText size={22} /> Commentaires</h1>
          <p className="mt-0.5 text-sm text-mute">Modérez les avis publiés sur le site public.</p>
        </div>
        <RefreshButton onRefresh={load} />
      </div>

      {notice && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{notice}</p>}

      {reviews === null ? <Loader inline /> : <>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="card p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-mute">Total</p><p className="mt-1 text-2xl font-black text-navy">{reviews.length}</p></div>
          <div className="card p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-mute">Visibles</p><p className="mt-1 text-2xl font-black text-emerald-600">{visible}</p></div>
          <div className="card p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-mute">Masqués</p><p className="mt-1 text-2xl font-black text-slate-500">{masked}</p></div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-line bg-white">
          {reviews.length === 0 ? <p className="p-10 text-center text-sm text-mute">Aucun commentaire pour le moment.</p> : <div className="divide-y divide-line">{reviews.map((review) => (
            <article key={review.id} className={`p-5 ${review.is_visible ? "" : "bg-slate-50 opacity-75"}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><p className="font-bold text-navy">{review.author_name}</p><div className="mt-1"><Rating value={review.rating} /></div></div>
                <div className="flex flex-wrap items-center justify-end gap-3"><time className="text-xs text-mute">{date(review.created_at)}</time><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${review.is_visible ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{review.is_visible ? "Visible" : "Masqué"}</span></div>
              </div>
              <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-mute">{review.message}</p>
              <button onClick={() => void changeVisibility(review)} disabled={busyId === review.id} className={`mt-4 inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold transition disabled:opacity-50 ${review.is_visible ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-navy text-white hover:bg-navy-dark"}`}>{review.is_visible ? <><EyeOff size={15} />{busyId === review.id ? "Modification..." : "Masquer"}</> : <><Eye size={15} />{busyId === review.id ? "Modification..." : "Rendre visible"}</>}</button>
            </article>
          ))}</div>}
        </section>
      </>}
    </div>
  );
}
