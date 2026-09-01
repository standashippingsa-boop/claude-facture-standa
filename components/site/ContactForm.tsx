"use client";

import { useState } from "react";
import { SITE } from "@/lib/site";
import { WhatsAppIcon } from "./BrandIcons";

/**
 * STANDA COMMERCIAL — FÒM MESAJ PAJ CONTACT LA
 * ═══════════════════════════════════════════════
 * Vizitè a ka voye mesaj li DE FASON:
 *   1) "Envoyer par email"    -> POST /api/contact (Resend, deja konfigire nan Vercel)
 *   2) "Envoyer sur WhatsApp" -> louvri wa.me ak mesaj la deja ekri, vizitè a peze Send li menm
 *
 * Konsa mesaj lan toujou rive menm si RESEND_API_KEY pa konfigire
 * (bouton WhatsApp la mache toujou san okenn sèvè).
 *
 * ⚠️ Chan "website" a se yon PYÈJ pou wobo spam (honeypot) — envizib pou
 *    moun, si yon bot ranpli l /api/contact senpleman inyore mesaj la.
 */

const SUBJECTS = [
  "Question générale",
  "Suivi de mon colis",
  "Facturation / paiement",
  "Ouvrir un compte",
  "Réclamation",
  "Autre"
];

const FLD =
  "w-full rounded-xl border border-line bg-mist px-3.5 text-[14.5px] text-ink placeholder:text-mute focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent focus:bg-white transition";

type Status = "idle" | "sending" | "sent" | "error" | "skipped";

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot

  const [status, setStatus] = useState<Status>("idle");
  const [validationMsg, setValidationMsg] = useState("");

  function validate(): boolean {
    if (!name.trim() || !message.trim()) {
      setValidationMsg("Veuillez indiquer votre nom et votre message.");
      return false;
    }
    if (!email.trim() && !phone.trim()) {
      setValidationMsg("Veuillez indiquer un email ou un numéro de téléphone.");
      return false;
    }
    setValidationMsg("");
    return true;
  }

  function buildWhatsAppText(): string {
    return (
      `Bonjour STANDA COMMERCIAL,\n\n` +
      `Nom : ${name.trim()}\n` +
      (email.trim() ? `Email : ${email.trim()}\n` : "") +
      (phone.trim() ? `Téléphone : ${phone.trim()}\n` : "") +
      `Sujet : ${subject}\n\n` +
      `${message.trim()}`
    );
  }

  async function sendByEmail() {
    if (status === "sending") return;
    if (!validate()) return;

    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, subject, message, website })
      });

      if (res.status === 429) {
        setStatus("error");
        setValidationMsg("Trop de messages envoyés. Réessayez dans quelques minutes, ou utilisez WhatsApp ci-dessous.");
        return;
      }

      const data = await res.json();

      if (data?.skipped) {
        setStatus("skipped");
        return;
      }
      if (data?.ok) {
        setStatus("sent");
        setName(""); setEmail(""); setPhone(""); setSubject(SUBJECTS[0]); setMessage("");
        return;
      }
      setStatus("error");
      setValidationMsg(data?.reason || "Impossible d'envoyer le message. Réessayez ou utilisez WhatsApp.");
    } catch {
      setStatus("error");
      setValidationMsg("Connexion impossible. Vérifiez votre internet ou utilisez WhatsApp.");
    }
  }

  function sendByWhatsApp() {
    if (!validate()) return;
    window.open(`https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(buildWhatsAppText())}`, "_blank");
  }

  return (
    <div className="bg-white rounded-2xl shadow-lift ring-1 ring-line p-5 sm:p-6">
      <h2 className="text-[19px] sm:text-[21px] font-black text-navy tracking-tight">
        Envoyez-nous un message
      </h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-mute">
        Réponse rapide par email ou WhatsApp, selon votre préférence.
      </p>

      <form className="mt-5 space-y-4" onSubmit={(e) => e.preventDefault()}>
        {/* Pyèj bot — envizib pou moun */}
        <input
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute -left-[9999px] w-px h-px opacity-0"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom complet">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom" className={`${FLD} h-12`} />
          </Field>
          <Field label="Téléphone">
            <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+509 ...." className={`${FLD} h-12`} />
          </Field>
        </div>

        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" className={`${FLD} h-12`} />
        </Field>

        <Field label="Sujet">
          <select value={subject} onChange={(e) => setSubject(e.target.value)} className={`${FLD} h-12`}>
            {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>

        <Field label="Message">
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Écrivez votre message ici..." rows={4} className={`${FLD} py-3 resize-none`} />
        </Field>

        {validationMsg && (
          <p className="text-[13px] font-semibold text-red-600 leading-relaxed">
            {validationMsg}
          </p>
        )}

        {status === "sent" && (
          <p className="text-[13.5px] font-semibold text-accent-dark bg-accent-light rounded-xl px-4 py-3">
            Message envoyé. Merci, nous vous répondrons rapidement.
          </p>
        )}

        {status === "skipped" && (
          <p className="text-[13.5px] font-semibold text-amber-800 bg-amber-50 rounded-xl px-4 py-3">
            L&apos;envoi par email n&apos;est pas disponible pour le moment. Utilisez WhatsApp ci-dessous — c&apos;est le moyen le plus rapide de nous joindre.
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <button type="button" onClick={sendByEmail} disabled={status === "sending"} className="flex-1 inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-accent hover:bg-accent-dark disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-[15px] transition">
            {status === "sending" ? (
              <>
                <span className="inline-block h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                Envoi...
              </>
            ) : "Envoyer par email"}
          </button>

          <button type="button" onClick={sendByWhatsApp} className="flex-1 inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-[#25D366] hover:bg-[#1fb857] text-white font-bold text-[15px] transition">
            <WhatsAppIcon size={18} className="shrink-0" />
            Envoyer sur WhatsApp
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12.5px] font-bold text-navy mb-1.5">{label}</span>
      {children}
    </label>
  );
}
