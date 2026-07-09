import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#122B5C", dark: "#0C1F44", light: "#1E4A8F" },
        mist: "#F3F5F9",
        line: "#E1E6EF"
      },
      boxShadow: { card: "0 1px 3px rgba(18,43,92,.06)" }
    }
  },
  plugins: []
};
export default config;
