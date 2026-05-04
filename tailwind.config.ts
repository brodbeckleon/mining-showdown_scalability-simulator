import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sora: ["var(--font-sora)", "system-ui", "sans-serif"],
        jb: ["var(--font-jb)", "ui-monospace", "monospace"],
      },
      animation: {
        "pulse-mine": "pulseMine 1.4s ease-in-out infinite",
      },
      keyframes: {
        pulseMine: {
          "0%, 100%": { opacity: "0.4", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.2)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
