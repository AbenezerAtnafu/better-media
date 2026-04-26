/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./content/**/*.{md,mdx}",
    "./mdx-components.{ts,tsx}",
    "./node_modules/fumadocs-ui/dist/**/*.js",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "brand-accent": "#3b82f6",
        "brand-surface": "#09090b",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        headline: ["Space Grotesk", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "slow-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.2" },
        },
        glow: {
          "0%, 100%": {
            opacity: "1",
            filter: "brightness(1) drop-shadow(0 0 5px rgba(59, 130, 246, 0.6))",
          },
          "50%": {
            opacity: "1",
            filter: "brightness(2) drop-shadow(0 0 15px rgba(59, 130, 246, 1))",
          },
        },
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "slide-up": "slideUp 0.6s ease-out forwards",
        float: "float 6s ease-in-out infinite",
        glow: "glow 2s ease-in-out infinite",
        "slow-pulse": "slow-pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slow-ping": "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite",
      },
    },
  },
};
