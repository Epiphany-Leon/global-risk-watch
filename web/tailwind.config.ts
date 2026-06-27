import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0E1117",
        panel: "#1A1D24",
        edge: "#2A2E37",
      },
    },
  },
  plugins: [],
};

export default config;
