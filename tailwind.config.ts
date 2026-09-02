import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // BRB house brand. Fixed accents; neutrals are CSS variables that flip
        // between light and dark themes (see globals.css).
        forest: {
          DEFAULT: "#052A22", // primary / nav (stays dark in both themes)
          soft: "#1A4D40",
        },
        fresh: "#8AC873", // accent / positive / CTA
        loss: "#C0392B", // negative price change
        sand: "rgb(var(--sand) / <alpha-value>)", // page background
        stone: "rgb(var(--stone) / <alpha-value>)", // dividers / borders
        ink: "rgb(var(--ink) / <alpha-value>)", // body text
        surface: "rgb(var(--surface) / <alpha-value>)", // card/popover surface
        // `white` keeps its default meaning (true white) so text-white stays
        // readable on brand-dark backgrounds in both themes.
      },
      fontFamily: {
        // Wired to next/font CSS variables in layout.tsx
        serif: ["var(--font-lora)", "Georgia", "serif"],
        sans: ["var(--font-poppins)", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        eyebrow: "0.18em",
      },
      boxShadow: {
        card: "0 1px 2px rgba(5, 42, 34, 0.04), 0 2px 6px rgba(5, 42, 34, 0.05), 0 8px 20px -8px rgba(5, 42, 34, 0.08)",
        "card-hover": "0 2px 8px rgba(5, 42, 34, 0.06), 0 14px 32px -10px rgba(5, 42, 34, 0.16)",
        cardOld: "0 1px 2px rgba(5, 42, 34, 0.06), 0 1px 3px rgba(5, 42, 34, 0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
