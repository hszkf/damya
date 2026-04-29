import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Material Design 3 surface tokens (CSS variables)
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          container: "rgb(var(--surface-container) / <alpha-value>)",
          "container-high": "rgb(var(--surface-container-high) / <alpha-value>)",
          "container-highest": "rgb(var(--surface-container-highest) / <alpha-value>)",
        },
        "on-surface": {
          DEFAULT: "rgb(var(--on-surface) / <alpha-value>)",
          variant: "rgb(var(--on-surface-variant) / <alpha-value>)",
        },
        outline: {
          DEFAULT: "rgb(var(--outline) / <alpha-value>)",
          variant: "rgb(var(--outline-variant) / <alpha-value>)",
        },
        // Redshift theme
        redshift: {
          DEFAULT: "#ff9900",
          container: "#3d2800",
          "on-primary": "#1a1000",
          tint: "rgba(255, 153, 0, 0.08)",
          glow: "rgba(255, 153, 0, 0.15)",
        },
        // SQL Server theme
        sqlserver: {
          DEFAULT: "#0078d4",
          container: "#003057",
          "on-primary": "#001d36",
          tint: "rgba(0, 120, 212, 0.08)",
          glow: "rgba(0, 120, 212, 0.15)",
        },
        // Merge theme (Redshift + SQL Server gradient)
        merge: {
          DEFAULT: "#ff9900",
          container: "#0078d4",
          "on-primary": "#ffffff",
          tint: "rgba(255, 153, 0, 0.08)",
          glow: "rgba(0, 120, 212, 0.15)",
        },
        // Syntax highlighting (CSS variables)
        syntax: {
          keyword: "rgb(var(--syntax-keyword) / <alpha-value>)",
          function: "rgb(var(--syntax-function) / <alpha-value>)",
          string: "rgb(var(--syntax-string) / <alpha-value>)",
          number: "rgb(var(--syntax-number) / <alpha-value>)",
          comment: "rgb(var(--syntax-comment) / <alpha-value>)",
          operator: "rgb(var(--syntax-operator) / <alpha-value>)",
          table: "rgb(var(--syntax-table) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
        display: ["var(--font-syne)", "system-ui", "sans-serif"],
        serif: ["var(--font-playfair)", "Georgia", "serif"],
        terminal: ["var(--font-space-mono)", "var(--font-jetbrains)", "monospace"],
      },
      boxShadow: {
        "elevation-1": "0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.4)",
        "elevation-2": "0 3px 6px rgba(0,0,0,0.3), 0 3px 6px rgba(0,0,0,0.4)",
        "elevation-3": "0 10px 20px rgba(0,0,0,0.3), 0 6px 6px rgba(0,0,0,0.4)",
      },
      animation: {
        "pulse-slow": "pulse 2s ease-in-out infinite",
        "spin-slow": "spin 1s linear infinite",
        "slide-up": "slideUp 0.3s ease-out",
        "fade-in": "fadeIn 0.6s ease-out forwards",
        "fade-in-up": "fadeInUp 0.8s ease-out forwards",
        "fade-in-down": "fadeInDown 0.8s ease-out forwards",
        "scale-in": "scaleIn 0.5s ease-out forwards",
        "float": "float 6s ease-in-out infinite",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
        "typewriter": "typewriter 3s steps(40) forwards",
        "blink": "blink 1s step-end infinite",
        "scanline": "scanline 8s linear infinite",
        "grain": "grain 0.5s steps(1) infinite",
        "shimmer": "shimmer 2s linear infinite",
        "orbit": "orbit 20s linear infinite",
        "counter-orbit": "counterOrbit 15s linear infinite",
        "morph": "morph 8s ease-in-out infinite",
        "slide-in-left": "slideInLeft 0.6s ease-out forwards",
        "slide-in-right": "slideInRight 0.6s ease-out forwards",
        "bounce-subtle": "bounceSubtle 2s ease-in-out infinite",
        "reveal": "reveal 1s ease-out forwards",
      },
      keyframes: {
        slideUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        fadeInUp: {
          from: { opacity: "0", transform: "translateY(40px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeInDown: {
          from: { opacity: "0", transform: "translateY(-40px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.9)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-20px)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(255, 180, 50, 0.3)" },
          "50%": { boxShadow: "0 0 40px rgba(255, 180, 50, 0.6)" },
        },
        typewriter: {
          from: { width: "0" },
          to: { width: "100%" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        grain: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "10%": { transform: "translate(-1%, -1%)" },
          "20%": { transform: "translate(1%, 1%)" },
          "30%": { transform: "translate(-1%, 1%)" },
          "40%": { transform: "translate(1%, -1%)" },
          "50%": { transform: "translate(-1%, 0%)" },
          "60%": { transform: "translate(1%, 0%)" },
          "70%": { transform: "translate(0%, 1%)" },
          "80%": { transform: "translate(0%, -1%)" },
          "90%": { transform: "translate(1%, 1%)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        orbit: {
          "0%": { transform: "rotate(0deg) translateX(150px) rotate(0deg)" },
          "100%": { transform: "rotate(360deg) translateX(150px) rotate(-360deg)" },
        },
        counterOrbit: {
          "0%": { transform: "rotate(0deg) translateX(100px) rotate(0deg)" },
          "100%": { transform: "rotate(-360deg) translateX(100px) rotate(360deg)" },
        },
        morph: {
          "0%, 100%": { borderRadius: "60% 40% 30% 70%/60% 30% 70% 40%" },
          "50%": { borderRadius: "30% 60% 70% 40%/50% 60% 30% 60%" },
        },
        slideInLeft: {
          from: { opacity: "0", transform: "translateX(-60px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        slideInRight: {
          from: { opacity: "0", transform: "translateX(60px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        bounceSubtle: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        reveal: {
          from: { clipPath: "inset(0 100% 0 0)" },
          to: { clipPath: "inset(0 0 0 0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
