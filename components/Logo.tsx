"use client";
import { useState } from "react";

/**
 * Logo ofisyèl STANDA COMMERCIAL.
 * Mete fichye a nan /public/logo.png — li parèt otomatikman nan sidebar,
 * dashboard, header ak PDF yo. Si li pa la, monogram "SC" a parèt (anyen pa kraze).
 */
export default function Logo({ size = 36, rounded = "rounded-lg" }: { size?: number; rounded?: string }) {
  const [missing, setMissing] = useState(false);
  if (missing) {
    return (
      <div className={`${rounded} bg-white text-navy grid place-items-center font-black`}
        style={{ width: size, height: size, fontSize: size * 0.38 }}>
        SC
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo.png" alt="STANDA COMMERCIAL" width={size} height={size}
      className={`${rounded} bg-white object-contain p-0.5`}
      style={{ width: size, height: size }}
      onError={() => setMissing(true)} />
  );
}
