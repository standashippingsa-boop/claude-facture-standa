/*
 * STANDA COMMERCIAL — DEKÒ PAJ KONEKSYON / ENSKRIPSYON
 * ════════════════════════════════════════════════════
 * Yon dekò anime ki fèt AK CSS + SVG sèlman — zewo foto, zewo bibliyotèk.
 *
 * POUKISA PA YON FOTO
 * ───────────────────
 * Yon bèl foto batiman oswa avyon peze 300–800 Ko. Kliyan STANDA yo sou
 * koneksyon mobil fèb: paj la ta rete blan pandan plizyè segond epi anpil
 * moun ta abandone. Dekò sa a peze ZEWO byte anplis, li parèt menm lè
 * koneksyon an kraze, epi li bay menm santiman an: mouvman, vwayaj, lanmè.
 *
 * Si ou VLE yon vre foto: mete l nan public/ (ex: public/bg-auth.jpg) epi
 * di m — se yon sèl liy pou ajoute l dèyè dekò sa a.
 *
 * KI SA KI BOUJE — FON AN SÈLMAN
 * ──────────────────────────────
 * De tach koulè ki dandine dousman ak de vag ki glise. Se tou.
 * Logo a, tèks la ak icòn yo RETE FIKS: yon logo k ap flote atire je a sou
 * dekorasyon an olye sou fòm nan, epi li fatigan lè yon moun ap tape.
 *
 * KOULÈ: endigo -> vyolèt -> sarsèl. Pa gen vèt (desizyon konfime).
 */
export default function AuthBackdrop() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Fon gradyan */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 700px at 15% -10%, #3B2E8F 0%, transparent 60%)," +
            "radial-gradient(900px 600px at 110% 20%, #0E7490 0%, transparent 55%)," +
            "linear-gradient(160deg, #0B1233 0%, #16204F 45%, #0C1A38 100%)"
        }}
      />

      {/* De gwo tach koulè k ap dandine dousman */}
      <div className="sd-drift absolute -top-28 -left-24 w-[26rem] h-[26rem] rounded-full blur-3xl opacity-40"
        style={{ background: "radial-gradient(circle, #6D5BF5 0%, transparent 70%)" }} />
      <div className="sd-drift absolute -bottom-32 -right-20 w-[30rem] h-[30rem] rounded-full blur-3xl opacity-35"
        style={{ background: "radial-gradient(circle, #0EA5E9 0%, transparent 70%)", animationDelay: "-8s" }} />

      {/* Vag lanmè — twa kouch ki glise */}
      <svg className="absolute bottom-0 left-0 w-[200%] h-56 opacity-[0.16] sd-drift"
        viewBox="0 0 1440 220" preserveAspectRatio="none" style={{ animationDuration: "30s" }}>
        <path fill="#7DD3FC" d="M0 120c180-52 360-52 540 0s360 52 540 0 360-52 360 0v100H0z" />
      </svg>
      <svg className="absolute bottom-0 left-0 w-[200%] h-44 opacity-[0.12] sd-drift"
        viewBox="0 0 1440 180" preserveAspectRatio="none" style={{ animationDuration: "40s", animationDelay: "-12s" }}>
        <path fill="#818CF8" d="M0 90c200 60 400 60 600 0s400-60 600 0 240 60 240 0v90H0z" />
      </svg>

      {/* Vwal fen anwo pou tèks la rete lizib */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/35" />
    </div>
  );
}
