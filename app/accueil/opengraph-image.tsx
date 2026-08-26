import { ImageResponse } from "next/og";

/*
 * STANDA COMMERCIAL — Imaj apèsi lyen (Open Graph)
 * ════════════════════════════════════════════════
 * Se imaj sa a ki parèt lè yon moun pataje lyen an sou WhatsApp, Facebook
 * oswa Messenger. San li, aplikasyon mesajri yo pran nenpòt bagay yo jwenn
 * — souvan yon ti logo koupe oswa anyen ditou.
 *
 * Nou jenere l nan kòd (pa yon fichye imaj) pou de rezon:
 *   • zewo fichye pou telechaje/mete sou GitHub
 *   • si mak la chanje, yon sèl kote pou modifye
 *
 * 1200×630 se dimansyon estanda WhatsApp/Facebook mande.
 */
export const runtime = "edge";
export const alt = "STANDA COMMERCIAL — Expédition de colis USA vers Haïti";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "center", padding: "0 90px",
          background: "linear-gradient(135deg, #0C1F44 0%, #122B5C 55%, #1E4A8F 100%)",
          fontFamily: "sans-serif"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 34 }}>
          <div style={{ width: 14, height: 58, background: "#16A34A", borderRadius: 7, display: "flex" }} />
          <div
            style={{
              fontSize: 26, letterSpacing: 8, color: "#9DB4DC",
              fontWeight: 700, display: "flex"
            }}
          >
            STANDA COMMERCIAL
          </div>
        </div>

        <div
          style={{
            fontSize: 78, fontWeight: 800, color: "#FFFFFF",
            lineHeight: 1.06, letterSpacing: -2, display: "flex", flexDirection: "column"
          }}
        >
          <span>Vos achats en ligne,</span>
          <span>
            des <span style={{ color: "#4ADE80" }}>USA</span> jusqu&apos;en{" "}
            <span style={{ color: "#4ADE80" }}>Haïti</span>
          </span>
        </div>

        <div style={{ fontSize: 32, color: "#B6C7E4", marginTop: 34, display: "flex" }}>
          Adresse gratuite à Miami · Suivi en temps réel · Livraison en agence
        </div>

        <div
          style={{
            marginTop: 46, display: "flex", alignItems: "center", gap: 16,
            fontSize: 26, color: "#7E96C4"
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: 4, background: "#16A34A", display: "flex" }} />
          standacommercialsa.com
        </div>
      </div>
    ),
    size
  );
}
