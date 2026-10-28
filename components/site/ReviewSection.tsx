"use client";

import { FormEvent, useEffect, useState } from "react";
import { MessageSquareText, Send, Star, UserRound } from "lucide-react";
import { Spinner } from "@/components/Loader";

import { notify } from "@/lib/notify";
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
  // Chaque message du formulaire devient une notification (succès ou erreur).
  useEffect(() => {
    if (!notice) return;
    if (noticeKind === "success") notify.success(notice, { title: "Merci pour votre avis" });
    else notify.error(notice, { title: "Avis non envoyé" });
    setNotice("");
  }, [notice, noticeKind]);

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
      setStatus("ready");
      setNoticeKind("success");
      setNotice("Merci ! Votre commentaire sera publié après vérification par notre équipe.");
    } catch (error) {
      setStatus("ready");
      setNoticeKind("error");
      setNotice(error instanceof Error ? error.message : "Impossible de publier votre commentaire.");
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10 xl:px-6">
      <div className="grid gap-8 lg:grid-cols-[.86fr_1.14fr] lg:items-start">
        <div className="rounded-3xl bg-[#f4f5f7] p-6 text-ink sm:p-8">
          <p className="text-[12px] font-medium tracking-[0.14em] text-ink/55">VOTRE AVIS COMPTE</p>
          <h2 className="mt-4 text-[30px] font-semibold leading-tight tracking-[-0.02em] sm:text-[38px]">Partagez votre expérience <span className="text-ink/45">avec STANDA</span></h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink/65">Vos commentaires nous aident à mieux accompagner chaque client.</p>
          <div className="mt-7 rounded-2xl bg-white p-4 text-[13px] leading-relaxed text-ink/65">
            <span className="font-semibold text-ink">Aucun compte nécessaire.</span> Utilisez simplement votre prénom ou un pseudonyme ; votre adresse électronique n&apos;est pas demandée.
          </div>
        </div>

        <div className="rounded-3xl border border-line bg-white p-5 sm:p-7">
          <form onSubmit={submit} className="space-y-4">
            <div className="flex items-center gap-2 text-ink"><MessageSquareText size={21} /><h3 className="text-[20px] font-semibold tracking-tight">Laissez votre commentaire</h3></div>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-ink/70">Votre prénom ou pseudonyme</span>
              <div className="relative"><UserRound size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mute" /><input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required className="w-full rounded-2xl border border-transparent bg-[#f4f5f7] py-3 pl-10 pr-3.5 text-[14.5px] text-ink placeholder:text-mute transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-ink/80" placeholder="Ex. Marie" /></div>
            </label>
            <fieldset>
              <legend className="mb-1.5 block text-[13px] font-medium text-ink/70">Votre note</legend>
              <Stars rating={rating} interactive onChange={setRating} />
            </fieldset>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-ink/70">Votre commentaire</span>
              <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={600} rows={5} required placeholder="Décrivez votre expérience avec STANDA…" className="w-full resize-none rounded-2xl border border-transparent bg-[#f4f5f7] px-3.5 py-3 text-[14.5px] text-ink placeholder:text-mute transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-ink/80" />
            </label>
            <input value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute h-px w-px overflow-hidden opacity-0" />
            <div className="flex items-center justify-between gap-3 text-[12px] text-mute"><span>Votre avis sera affiché publiquement.</span><span>{message.length}/600</span></div>
            <button type="submit" disabled={status === "sending"} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-[14px] font-semibold text-white transition hover:bg-navy disabled:cursor-not-allowed disabled:bg-slate-300">{status === "sending" ? <Spinner size={16} /> : <Send size={16} />}{status === "sending" ? "Publication..." : "Publier mon commentaire"}</button>
          </form>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-line bg-white p-5 sm:p-7">
        <div className="flex items-center gap-2"><Star size={18} className="fill-amber-400 text-amber-400" /><h3 className="text-[21px] font-semibold tracking-tight text-ink">Commentaires des clients</h3></div>
        {status === "loading" ? <p className="mt-5 text-[14px] text-mute">Chargement des commentaires…</p> : reviews.length ? <div className="mt-6 grid gap-3 md:grid-cols-2">{reviews.map((review) => <article key={review.id} className="rounded-2xl bg-[#f4f5f7] p-5"><div className="flex items-start justify-between gap-4"><div><p className="font-semibold text-ink">{review.author_name}</p><div className="mt-1"><Stars rating={review.rating} /></div></div><time dateTime={review.created_at} className="shrink-0 text-[11px] font-medium text-mute">{formatDate(review.created_at)}</time></div><p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-mute">{review.message}</p></article>)}</div> : <p className="mt-5 text-[14px] leading-relaxed text-mute">Soyez le premier à partager votre expérience avec STANDA.</p>}
      </div>
    </section>
  );
}
