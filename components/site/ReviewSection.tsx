"use client";

import { FormEvent, useEffect, useState } from "react";
import { MessageSquareText, Send, Star, UserRound } from "lucide-react";

type Review = {
  id: string;
  author_name: string;
  rating: number;
  message: string;
  created_at: string;
};

type ReviewResponse = { reviews?: Review[]; error?: string };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-HT", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

function Stars({ rating, interactive = false, onChange }: { rating: number; interactive?: boolean; onChange?: (value: number) => void }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${rating} étoile${rating > 1 ? "s" : ""} sur 5`}>
      {Array.from({ length: 5 }, (_, index) => {
        const value = index + 1;
        const icon = <Star size={interactive ? 25 : 16} className={value <= rating ? "fill-amber-400 text-amber-400" : "text-slate-300"} />;
        return interactive ? (
          <button key={value} type="button" onClick={() => onChange?.(value)} aria-label={`${value} étoile${value > 1 ? "s" : ""}`} className="rounded-md p-0.5 transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">{icon}</button>
        ) : <span key={value} aria-hidden="true">{icon}</span>;
      })}
    </div>
  );
}

export default function ReviewSection() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // Honeypot : ce champ doit rester vide.
  const [status, setStatus] = useState<"loading" | "ready" | "sending" | "error">("loading");
  const [notice, setNotice] = useState("");
  const [noticeKind, setNoticeKind] = useState<"success" | "error">("error");

  async function loadReviews() {
    try {
      const response = await fetch("/api/reviews", { cache: "no-store" });
      const data = await response.json() as ReviewResponse;
      if (!response.ok) throw new Error(data.error || "Impossible de charger les commentaires.");
      setReviews(data.reviews ?? []);
      setStatus("ready");
    } catch {
      setNoticeKind("error");
      setNotice("Les commentaires sont temporairement indisponibles.");
      setStatus("error");
    }
  }

  useEffect(() => { void loadReviews(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.replace(/\s+/g, " ").trim();
    const trimmedMessage = message.trim();
    if (trimmedName.length < 2) {
      setNoticeKind("error"); setNotice("Indiquez votre prénom ou un pseudonyme."); return;
    }
    if (!rating) {
      setNoticeKind("error"); setNotice("Choisissez une note entre 1 et 5 étoiles."); return;
    }
    if (trimmedMessage.length < 8) {
      setNoticeKind("error"); setNotice("Votre commentaire doit contenir au moins 8 caractères."); return;
    }

    setStatus("sending");
    setNotice("");
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, rating, message: trimmedMessage, website })
      });
      const data = await response.json() as ReviewResponse;
      if (!response.ok) throw new Error(data.error || "Impossible de publier votre commentaire.");
      setName(""); setRating(0); setMessage(""); setWebsite("");
      setNoticeKind("success");
      setNotice("Merci, votre commentaire est maintenant visible sur le site.");
      await loadReviews();
    } catch (error) {
      setStatus("ready");
      setNoticeKind("error");
      setNotice(error instanceof Error ? error.message : "Impossible de publier votre commentaire.");
    }
  }

  return (
    <section className="parcel-wash mx-auto max-w-7xl rounded-[2rem] px-5 py-16 sm:px-8 sm:py-24 lg:px-10 xl:px-6">
      <div className="grid gap-8 lg:grid-cols-[.86fr_1.14fr] lg:items-start">
        <div className="rounded-[1.65rem] bg-navy p-6 text-white shadow-[0_24px_60px_-38px_rgba(15,23,42,.7)] sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[.19em] text-accent">Votre avis compte</p>
          <h2 className="mt-3 text-balance text-[30px] font-black leading-[1.05] tracking-[-.04em] sm:text-[40px]">Partagez votre expérience avec STANDA.</h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/70">Vos commentaires nous aident à mieux accompagner chaque client.</p>
          <div className="mt-7 rounded-2xl border border-white/10 bg-white/[.07] p-4 text-[13px] leading-relaxed text-white/75">
            <span className="font-bold text-white">Aucun compte nécessaire.</span> Utilisez simplement votre prénom ou un pseudonyme ; votre adresse e-mail n&apos;est pas demandée.
          </div>
        </div>

        <div className="rounded-[1.65rem] border border-line bg-white p-5 shadow-[0_24px_60px_-38px_rgba(15,23,42,.5)] sm:p-7">
          <form onSubmit={submit} className="space-y-4">
            <div className="flex items-center gap-2 text-navy"><MessageSquareText size={21} className="text-accent" /><h3 className="text-[20px] font-black tracking-[-.02em]">Laissez votre commentaire</h3></div>
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-bold text-navy">Votre prénom ou pseudonyme</span>
              <div className="relative"><UserRound size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mute" /><input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required className="w-full rounded-xl border border-line bg-mist py-3 pl-10 pr-3.5 text-[14.5px] text-ink placeholder:text-mute transition focus:border-accent focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Ex. Marie" /></div>
            </label>
            <fieldset>
              <legend className="mb-1.5 block text-[12.5px] font-bold text-navy">Votre note</legend>
              <Stars rating={rating} interactive onChange={setRating} />
            </fieldset>
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-bold text-navy">Votre commentaire</span>
              <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={600} rows={5} required placeholder="Décrivez votre expérience avec STANDA..." className="w-full resize-none rounded-xl border border-line bg-mist px-3.5 py-3 text-[14.5px] text-ink placeholder:text-mute transition focus:border-accent focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent" />
            </label>
            <input value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute h-px w-px overflow-hidden opacity-0" />
            <div className="flex items-center justify-between gap-3 text-[12px] text-mute"><span>Votre avis sera affiché publiquement.</span><span>{message.length}/600</span></div>
            <button type="submit" disabled={status === "sending"} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 text-[14px] font-bold text-white transition hover:bg-accent-dark disabled:cursor-not-allowed disabled:bg-slate-300"><Send size={16} />{status === "sending" ? "Publication..." : "Publier mon commentaire"}</button>
          </form>
          {notice && <p aria-live="polite" className={`mt-4 rounded-xl px-4 py-3 text-[13px] font-semibold leading-relaxed ${noticeKind === "success" ? "bg-accent-light text-accent-dark" : "bg-red-50 text-red-700"}`}>{notice}</p>}
        </div>
      </div>

      <div className="mt-8 rounded-[1.65rem] border border-line bg-white p-5 shadow-[0_18px_44px_-36px_rgba(15,23,42,.45)] sm:p-7">
        <div className="flex items-center gap-2"><Star size={18} className="fill-accent text-accent" /><h3 className="text-[21px] font-black tracking-[-.025em] text-navy">Commentaires des clients</h3></div>
        {status === "loading" ? <p className="mt-5 text-[14px] text-mute">Chargement des commentaires...</p> : reviews.length ? <div className="mt-6 grid gap-3 md:grid-cols-2">{reviews.map((review) => <article key={review.id} className="rounded-2xl bg-mist p-5"><div className="flex items-start justify-between gap-4"><div><p className="font-bold text-navy">{review.author_name}</p><div className="mt-1"><Stars rating={review.rating} /></div></div><time dateTime={review.created_at} className="shrink-0 text-[11px] font-medium text-mute">{formatDate(review.created_at)}</time></div><p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-mute">{review.message}</p></article>)}</div> : <p className="mt-5 text-[14px] leading-relaxed text-mute">Soyez le premier à partager votre expérience avec STANDA.</p>}
      </div>
    </section>
  );
}
