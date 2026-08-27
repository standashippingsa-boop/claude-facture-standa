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
 * Paj koneksyon an PA oblije swiv koulè biznis la (desizyon konfime), donk
 * nou sèvi ak yon gradyan endigo -> vyolèt -> sarsèl ki bay yon santiman
 * modèn, ak yon ti touch vèt mak la nan detay yo.
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
        style={{ background: "radial-gradient(circle, #10B981 0%, transparent 70%)", animationDelay: "-8s" }} />

      {/* Vag lanmè — twa kouch ki glise */}
      <svg className="absolute bottom-0 left-0 w-[200%] h-56 opacity-[0.16] sd-drift"
        viewBox="0 0 1440 220" preserveAspectRatio="none" style={{ animationDuration: "30s" }}>
        <path fill="#7DD3FC" d="M0 120c180-52 360-52 540 0s360 52 540 0 360-52 360 0v100H0z" />
      </svg>
      <svg className="absolute bottom-0 left-0 w-[200%] h-44 opacity-[0.12] sd-drift"
        viewBox="0 0 1440 180" preserveAspectRatio="none" style={{ animationDuration: "40s", animationDelay: "-12s" }}>
        <path fill="#34D399" d="M0 90c200 60 400 60 600 0s400-60 600 0 240 60 240 0v90H0z" />
      </svg>

      {/* Avyon k ap flote — rapèl vwayaj Miami -> Ayiti */}
      <svg className="sd-float absolute top-[14%] right-[10%] w-16 h-16 opacity-25 text-white"
        viewBox="0 0 24 24" fill="currentColor">
        <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
      </svg>

      {/* Ti bwat koli k ap monte desann */}
      <svg className="sd-float absolute top-[62%] left-[8%] w-10 h-10 opacity-20 text-emerald-300"
        viewBox="0 0 24 24" fill="currentColor" style={{ animationDelay: "-3s" }}>
        <path d="M21 8l-9-5-9 5v8l9 5 9-5V8zm-9 2.3L5.5 6.7 12 3.1l6.5 3.6L12 10.3z" />
      </svg>
      <svg className="sd-float absolute top-[30%] left-[16%] w-7 h-7 opacity-15 text-sky-200"
        viewBox="0 0 24 24" fill="currentColor" style={{ animationDelay: "-5s" }}>
        <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
      </svg>

      {/* Vwal fen anwo pou tèks la rete lizib */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/35" />
    </div>
  );
}
