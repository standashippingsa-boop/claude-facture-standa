"use client";
import { useEffect, useRef, useState } from "react";
import { Megaphone } from "lucide-react";
import { announcementImageUrl, announcementMedia, type Announcement, type AnnouncementMedia } from "@/lib/announcements";

type Slide = { key: string; announcement: Announcement; kind: "image" | "video" | "text"; url?: string };

const IMAGE_DELAY = 5000;

/**
 * DIAPORAMA DES ANNONCES — accueil de l'espace client.
 * Chaque photo / vidéo des annonces visibles est une diapositive. Les photos
 * restent 5 s ; une vidéo joue (sans le son) jusqu'au bout puis passe à la
 * suivante. Le client peut glisser du doigt ; toucher une diapositive ouvre
 * l'annonce complète.
 */
export default function AnnouncementCarousel({ announcements, onOpen }: { announcements: Announcement[]; onOpen: (item: Announcement) => void }) {
  const slides: Slide[] = announcements.flatMap<Slide>((item) => {
    const media = announcementMedia(item);
    if (!media.length) return [{ key: item.id, announcement: item, kind: "text" as const }];
    return media.map((entry, index) => ({ key: `${item.id}-${index}`, announcement: item, kind: entry.kind, url: announcementImageUrl(entry.path) }));
  });
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const videos = useRef<Record<string, HTMLVideoElement | null>>({});
  const touching = useRef(false);
  const count = slides.length;
  const current = slides[Math.min(index, Math.max(0, count - 1))];

  const goTo = (next: number) => {
    if (!count) return;
    const target = ((next % count) + count) % count;
    const el = track.current;
    if (el) el.scrollTo({ left: target * el.clientWidth, behavior: "smooth" });
    setIndex(target);
  };

  // Photo : avance après 5 s. Vidéo : lecture, l'avance se fait à la fin (onEnded).
  useEffect(() => {
    if (count < 2 || !current) return;
    Object.entries(videos.current).forEach(([key, video]) => {
      if (!video) return;
      if (key === current.key) { video.currentTime = 0; void video.play().catch(() => undefined); }
      else video.pause();
    });
    if (current.kind === "video") return;
    const timer = window.setTimeout(() => { if (!touching.current) goTo(index + 1); }, IMAGE_DELAY);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, count, current?.key]);

  // Glissement du doigt : la diapositive visible devient l'index courant.
  const onScroll = () => {
    const el = track.current;
    if (!el || !el.clientWidth) return;
    const visible = Math.round(el.scrollLeft / el.clientWidth);
    if (visible !== index && visible >= 0 && visible < count) setIndex(visible);
  };

  if (!count) return null;
  return (
    <section aria-label="Annonces" className="overflow-hidden rounded-3xl bg-navy shadow-[0_14px_30px_-18px_rgba(18,43,92,.7)]">
      <div ref={track} onScroll={onScroll}
        onTouchStart={() => { touching.current = true; }} onTouchEnd={() => { touching.current = false; }}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {slides.map((slide) => (
          <button key={slide.key} type="button" onClick={() => onOpen(slide.announcement)}
            className="relative aspect-[4/5] w-full shrink-0 snap-center overflow-hidden text-left sm:aspect-[16/10]" aria-label={slide.announcement.title}>
            {slide.kind === "image" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={slide.url} alt={slide.announcement.title} className="h-full w-full object-contain" loading="lazy" />
            )}
            {slide.kind === "video" && (
              <video ref={(el) => { videos.current[slide.key] = el; }} src={slide.url} muted playsInline preload="metadata"
                autoPlay={count === 1} loop={count === 1}
                onEnded={() => { if (slide.key === current?.key) goTo(index + 1); }}
                className="h-full w-full object-contain" />
            )}
            {slide.kind === "text" && (
              <div className="flex h-full w-full flex-col justify-center gap-3 p-6 text-white">
                <Megaphone size={28} />
                <p className="text-2xl font-extrabold leading-tight">{slide.announcement.title}</p>
                {slide.announcement.body && <p className="line-clamp-4 text-[15px] text-white/80">{slide.announcement.body}</p>}
              </div>
            )}
            {slide.kind !== "text" && (
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-10">
                <span className="block truncate text-[15px] font-extrabold text-white">{slide.announcement.title}</span>
              </span>
            )}
          </button>
        ))}
      </div>
      {count > 1 && (
        <div className="flex justify-center gap-1.5 py-2.5">
          {slides.map((slide, i) => (
            <button key={slide.key} type="button" aria-label={`Annonce ${i + 1}`} onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-white" : "w-1.5 bg-white/40"}`} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Photos / vidéos d'une annonce ouverte : diaporama à glisser, avec points. */
export function AnnouncementMediaSlider({ media, title }: { media: AnnouncementMedia[]; title: string }) {
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  if (!media.length) return null;
  const goTo = (target: number) => {
    const el = track.current;
    if (el) el.scrollTo({ left: target * el.clientWidth, behavior: "smooth" });
    setIndex(target);
  };
  const onScroll = () => {
    const el = track.current;
    if (!el || !el.clientWidth) return;
    const visible = Math.round(el.scrollLeft / el.clientWidth);
    if (visible !== index) setIndex(visible);
  };
  return (
    <div className="overflow-hidden rounded-t-[28px] bg-navy">
      <div ref={track} onScroll={onScroll} className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {media.map((entry) => (
          <div key={entry.path} className="w-full shrink-0 snap-center">
            {entry.kind === "video"
              ? <video src={announcementImageUrl(entry.path)} controls playsInline className="max-h-[60vh] w-full bg-black object-contain" />
              // eslint-disable-next-line @next/next/no-img-element
              : <img src={announcementImageUrl(entry.path)} alt={title} className="max-h-[60vh] w-full object-contain" />}
          </div>
        ))}
      </div>
      {media.length > 1 && (
        <div className="flex justify-center gap-1.5 py-2.5">
          {media.map((entry, i) => (
            <button key={entry.path} type="button" aria-label={`Photo ${i + 1}`} onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-white" : "w-1.5 bg-white/40"}`} />
          ))}
        </div>
      )}
    </div>
  );
}
