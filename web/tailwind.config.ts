import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        implementer: "#7c3aed",
        interpreter: "#0ea5e9",
        tagger: "#f59e0b",
        archivist: "#10b981",
      },
    },
  },
  plugins: [],
};

export default config;
