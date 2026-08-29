// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#003b71", // Ble fonse ki nan imaj yo
          light: "#0056a3",
          soft: "#f0f7ff",
        },
        accent: "#00aaff", // Ble klere pou bouton
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '3.5rem',
      }
    },
  },
  // ...
};
export default config;
