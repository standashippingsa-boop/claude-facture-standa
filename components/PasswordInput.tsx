"use client";
/*
 * STANDA COMMERCIAL — Chan modpas ak TI JE 👁️
 * ═══════════════════════════════════════════
 * Kliyan yo tape modpas tanporè ki soti sou WhatsApp. San wè sa yo tape,
 * yo fè erè epi yo panse kont lan bloke. Ti je a regle sa.
 *
 * ENPÒTAN POU ANREJISTREMAN MODPAS SOU TELEFÒN:
 *   Navigatè a (Chrome/Safari) pwopoze anrejistre modpas la SÈLMAN si chan an
 *   gen `name` ak `autoComplete` kòrèk EPI li anndan yon vrè <form>. De bagay
 *   sa yo obligatwa — se poutèt sa yo pa opsyonèl isit la.
 */
import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

export default function PasswordInput({
  value, onChange, onEnter, label = "Mot de passe",
  autoComplete = "current-password", name = "password",
  placeholder = "", dark = false, autoFocus = false
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  label?: string;
  /** "current-password" pou konekte · "new-password" pou kreye/chanje */
  autoComplete?: "current-password" | "new-password";
  name?: string;
  placeholder?: string;
  /** true sou paj koneksyon fon fonse yo */
  dark?: boolean;
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);

  if (dark) return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-300">{label}</span>
      <div className="mt-1 flex items-center gap-2 rounded-xl bg-[#122A52] border border-white/10 px-3 focus-within:border-blue-400">
        <Lock size={16} className="text-[#9DB4DC] shrink-0" />
        <input
          type={show ? "text" : "password"}
          name={name} autoComplete={autoComplete} autoFocus={autoFocus}
          placeholder={placeholder}
          className="w-full bg-transparent py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none"
          value={value} onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && onEnter) onEnter(); }} />
        <button type="button" onClick={() => setShow((v) => !v)}
          aria-label={show ? "Cacher le mot de passe" : "Afficher le mot de passe"}
          className="text-[#9DB4DC] hover:text-white shrink-0 p-1">
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </label>
  );

  return (
    <label className="block">
      <span className="text-xs font-semibold text-mute">{label}</span>
      <div className="mt-1 relative">
        <input
          type={show ? "text" : "password"}
          name={name} autoComplete={autoComplete} autoFocus={autoFocus}
          placeholder={placeholder} className="input !pr-10"
          value={value} onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && onEnter) onEnter(); }} />
        <button type="button" onClick={() => setShow((v) => !v)}
          aria-label={show ? "Cacher le mot de passe" : "Afficher le mot de passe"}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-navy p-1">
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </label>
  );
}
