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
        ink: "#050509",
        coal: "#0b0a10",
        graphite: "#14121d",
        panel: "#191524",
        line: "#2d2241",
        violet: "#8b3ff2",
        violetDeep: "#54229f",
        gold: "#c99a22",
        goldSoft: "#e0bb58",
        bone: "#f4f1ea",
        muted: "#a9a2b8"
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
