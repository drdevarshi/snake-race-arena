import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        arena: {
          black: "#05060a",
          charcoal: "#0d1018",
          panel: "#121626",
          border: "#1f2742",
        },
        neon: {
          green: "#39ff14",
          lime: "#a6ff00",
          blue: "#1e90ff",
          cyan: "#00f0ff",
          purple: "#9d4dff",
          magenta: "#ff2bd6",
          gold: "#ffc832",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "glow-green": "0 0 12px rgba(57,255,20,.55), 0 0 32px rgba(57,255,20,.25)",
        "glow-cyan": "0 0 12px rgba(0,240,255,.55), 0 0 32px rgba(0,240,255,.25)",
        "glow-purple": "0 0 12px rgba(157,77,255,.6), 0 0 32px rgba(157,77,255,.25)",
        "glow-magenta": "0 0 12px rgba(255,43,214,.55), 0 0 32px rgba(255,43,214,.25)",
        "glow-gold": "0 0 12px rgba(255,200,50,.6), 0 0 32px rgba(255,200,50,.25)",
      },
      keyframes: {
        "grid-scroll": {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "0 64px" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "grid-scroll": "grid-scroll 3s linear infinite",
        shimmer: "shimmer 4s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
