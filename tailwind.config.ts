import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Elegant muted gold — the brand accent
        gold: {
          50: "#FBF8F1",
          100: "#F6EFDE",
          200: "#EBDEBB",
          300: "#DDC993",
          400: "#CDB16C",
          500: "#B99A55",
          600: "#A0813F",
          700: "#826734",
          800: "#67522C",
          900: "#554427",
        },
        // Near-black neutrals tuned for a premium feel
        ink: {
          50: "#F7F7F6",
          100: "#EFEFED",
          200: "#DCDCD9",
          300: "#BBBBB6",
          400: "#92928C",
          500: "#75756F",
          600: "#5E5E58",
          700: "#4C4C48",
          800: "#33332F",
          900: "#1C1C1A",
          950: "#111110",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(17 17 16 / 0.04), 0 1px 3px 0 rgb(17 17 16 / 0.06)",
        "card-hover":
          "0 4px 6px -1px rgb(17 17 16 / 0.05), 0 10px 24px -6px rgb(17 17 16 / 0.10)",
        pop: "0 8px 16px -4px rgb(17 17 16 / 0.10), 0 24px 48px -12px rgb(17 17 16 / 0.18)",
        "gold-glow": "0 0 0 3px rgb(185 154 85 / 0.18)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(24px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out both",
        "fade-up": "fade-up 0.35s cubic-bezier(0.21, 1.02, 0.73, 1) both",
        "scale-in": "scale-in 0.2s cubic-bezier(0.21, 1.02, 0.73, 1) both",
        "slide-in-right":
          "slide-in-right 0.3s cubic-bezier(0.21, 1.02, 0.73, 1) both",
        shimmer: "shimmer 1.6s infinite",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.21, 1.02, 0.73, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
