import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Mak STANDA
        navy: { DEFAULT: "#122B5C", dark: "#0C1F44", light: "#1E4A8F" },
        // Aksan (estil Flup — vèt lojistik)
        brand: { DEFAULT: "#16A34A", light: "#DCFCE7", dark: "#15803D" },
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
