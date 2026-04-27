import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#fff8e7",
        "cream-2": "#fbecc6",
        ink: "#1d1a17",
        "ink-2": "#3a3530",
        "ink-3": "#6e6557",
        "ink-4": "#a59a86",
        implementer: "#5a3ec8",
        interpreter: "#1a8fb5",
        tagger: "#ff7a1a",
        archivist: "#2f9e5e",
        kernel: "#1d1a17",
        hot: "#ff4d6d",
        lemon: "#ffd84d",
        sky: "#b8e3ff",
        mint: "#c8efd4",
        peach: "#ffd8c2",
        lilac: "#e0d3ff",
      },
      fontFamily: {
        serif: ["Fraunces", "Times New Roman", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      keyframes: {
        wiggle: {
          "0%, 100%": { transform: "rotate(-2deg)" },
          "50%": { transform: "rotate(2deg)" },
        },
        bounce2: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        blink2: {
          "50%": { opacity: "0" },
        },
      },
      animation: {
        wiggle: "wiggle 3s ease-in-out infinite",
        bounce2: "bounce2 1.6s ease-in-out infinite",
        blink2: "blink2 1s steps(2) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
