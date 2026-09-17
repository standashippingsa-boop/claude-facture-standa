"use client";
import { useState } from "react";

/**
 * Logo ofisyèl STANDA COMMERCIAL.
 * Mete fichye a nan /public/logo.png — li parèt otomatikman nan sidebar,
 * dashboard, header ak PDF yo. Fichye a gen fon transparan pou l adapte sou
 * fon klè oswa fon fonse. Si li pa la, monogram "SC" a parèt (anyen pa kraze).
 */
export default function Logo({ size = 36, rounded = "rounded-lg", tone = "default" }: { size?: number; rounded?: string; tone?: "default" | "light" }) {
  const [missing, setMissing] = useState(false);
  if (missing) {
    return (
      <div className={`${rounded} grid place-items-center border border-current/20 bg-transparent text-current font-black`}
        style={{ width: size, height: size, fontSize: size * 0.38 }}>
        SC
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo.png" alt="STANDA COMMERCIAL" width={size} height={size}
      className={`${rounded} object-contain ${tone === "light" ? "brightness-0 invert" : ""}`}
      style={{ width: size, height: size }}
      onError={() => setMissing(true)} />
  );
}
