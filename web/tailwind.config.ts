import type { Config } from "tailwindcss";

// Colors are driven by CSS variables (space-separated RGB channels) defined in
// globals.css, so `/opacity` modifiers keep working and a single `.dark` class
// on <html> flips the whole palette between light and dark.
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        panel: "rgb(var(--panel) / <alpha-value>)",
        edge: "rgb(var(--edge) / <alpha-value>)",
        fg: "rgb(var(--fg) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        hover: "rgb(var(--hover) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};

export default config;
