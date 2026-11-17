import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        coal: "rgb(var(--color-coal) / <alpha-value>)",
        graphite: "rgb(var(--color-graphite) / <alpha-value>)",
        panel: "rgb(var(--color-panel) / <alpha-value>)",
        line: "rgb(var(--color-line) / <alpha-value>)",
        menu: "rgb(var(--color-menu) / <alpha-value>)",
        overlay: "rgb(var(--color-overlay) / <alpha-value>)",
        divider: "rgb(var(--color-divider) / calc(var(--divider-base) + <alpha-value> * var(--divider-scale)))",
        accentGold: "rgb(var(--color-accent-gold) / <alpha-value>)",
        accentViolet: "rgb(var(--color-accent-violet) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)",
        warning: "rgb(var(--color-warning) / <alpha-value>)",
        violet: "#8b3ff2",
        violetDeep: "#54229f",
        gold: "#c99a22",
        goldSoft: "#e0bb58",
        bone: "rgb(var(--color-bone) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)"
      },
      boxShadow: {
        violet: "0 0 42px rgba(139, 63, 242, 0.28)",
        gold: "0 0 26px rgba(201, 154, 34, 0.18)"
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-oswald)", "Oswald", "Inter", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
