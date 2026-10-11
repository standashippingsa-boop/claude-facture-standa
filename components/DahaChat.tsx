"use client";
/*
 * STANDA COMMERCIAL — DAHA (asistan AI /espace-client)
 * ════════════════════════════════════════════════════════
 * Widget flotant san eta pataje ak paj la : li chèche pwòp jeton sesyon
 * kliyan an lè l voye yon mesaj, epi wout sèvè a (`/api/daha-chat`)
 * fè otorizasyon an ankò (customer_code soti nan jeton an, pa nan
 * nenpòt bagay widget sa a ta voye). Istorik konvèsasyon an rete
 * SÈLMAN nan memwa navigatè a (pa gen anrejistreman nan Supabase).
 */
import { useId, useRef, useState } from "react";
import { Send, Sparkles, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Spinner } from "@/components/Loader";

type ChatMsg = { role: "user" | "assistant"; content: string };
const MAX_CHARS = 500;

export default function DahaChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const panelId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  const send = async () => {
    const question = input.trim().slice(0, MAX_CHARS);
    if (!question || busy) return;
    const history = messages.slice(-6);
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setBusy(true);
    scrollToEnd();
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? "";
      const res = await fetch("/api/daha-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, message: question, history }),
      });
      const result = await res.json().catch(() => ({}));
      const answer = res.ok && result.ok
        ? String(result.answer ?? "")
        : String(result.reason ?? "Désolé, une erreur est survenue. Réessayez.");
      setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Connexion impossible. Vérifiez votre internet et réessayez." }]);
    } finally {
      setBusy(false);
      scrollToEnd();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Fermer l'assistant Daha" : "Ouvrir l'assistant Daha"}
        className="fixed bottom-24 right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-navy text-white shadow-lift transition-transform hover:scale-105 active:scale-95"
      >
        {open ? <X size={22} /> : <Sparkles size={22} />}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-modal="false"
          aria-label="Assistant Daha"
          className="fixed bottom-[9.5rem] right-4 z-40 flex w-[min(92vw,22rem)] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-lift"
          style={{ maxHeight: "min(70vh, 32rem)" }}
        >
          <div className="flex items-center gap-2 bg-navy px-4 py-3 text-white">
            <Sparkles size={16} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-tight">Daha</p>
              <p className="text-[11px] leading-tight text-white/70">Assistant STANDA COMMERCIAL</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="rounded-lg p-1 hover:bg-white/10">
              <X size={16} />
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-2.5 overflow-y-auto bg-mist p-3">
            {messages.length === 0 && (
              <div className="rounded-xl bg-white px-3 py-2.5 text-sm text-ink shadow-sm">
                Bonjou ! Mwen se Daha. Mwen ka ede w konnen kote koli w yo ye, konbyen w dwe peye, oswa kijan sèvis la mache. Ki jan m ka ede w ?
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm shadow-sm ${
                    m.role === "user" ? "bg-navy text-white" : "bg-white text-ink"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs text-mute shadow-sm">
                  <Spinner size={13} /> Daha écrit…
                </div>
              </div>
            )}
          </div>

          <div className="flex items-end gap-2 border-t border-line bg-white p-2.5">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
              placeholder="Écrivez votre question…"
              rows={1}
              className="input flex-1 resize-none py-2 text-sm"
              disabled={busy}
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy || !input.trim()}
              aria-label="Envoyer"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-navy text-white disabled:opacity-40"
            >
              {busy ? <Spinner size={15} /> : <Send size={15} />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
