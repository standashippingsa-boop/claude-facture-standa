import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Mak STANDA
        navy: { DEFAULT: "#122B5C", dark: "#0C1F44", light: "#1E4A8F" },
        // ⚠️ "brand" (vèt) rete la EKSPRE — li itilize toupatou nan dashboard
        // admin ak zouti entèn yo (bouton, badge estati, elatriye). PA efase l,
        // PA chanje valè l — sa ta chanje koulè nan TOUT sistèm nan, pa sèlman
        // sit piblik la.
        brand: { DEFAULT: "#232a4e", light: "#DCFCE7", dark: "#232a4e" },
        // Aksan mak SIT PIBLIK la (orange — echantiyon pran nan flyer ofisyèl
        // la). Itilize SÈLMAN nan app/accueil, app/contact, app/agences ak
        // components/site/*. Pa gen okenn lòt fichye ki itilize "accent".
        accent: { DEFAULT: "#E4650A", light: "#FBE8DA", dark: "#B65108" },
        // Neutre pwòp
        ink: "#0F172A",
        mute: "#64748B",
        mist: "#F5F7FB",
        line: "#E7ECF3"
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,.04), 0 1px 3px rgba(15,23,42,.06)",
        soft: "0 4px 16px rgba(15,23,42,.06)",
        lift: "0 8px 30px rgba(15,23,42,.10)"
      },
      borderRadius: { xl2: "1rem" }
    }
  },
  plugins: []
};
export default config;
