/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Core palette — black majority, electric accents
        ifdark: "#05060f",        // Deep space black (was #0a0b1e)
        ifcard: "#0c0d1a",        // Card background (was #14152e)
        ifborder: "#1a1d3a",      // Borders (was #26284a)

        // Electric blues
        ifcyan: "#22d3ee",        // Electric cyan (primary accent)
        ifblue: "#3b82f6",        // Electric blue
        ifsky: "#38bdf8",         // Sky blue glow

        // Purples
        ifaccent: "#8b5cf6",      // Purple (primary brand)
        ifviolet: "#a78bfa",      // Light violet
        ifpurple: "#7c3aed",      // Deep purple

        // White accents
        iftext: "#f8fafc",        // Near-white text (was #e2e8f0)
        ifwhite: "#ffffff",       // Pure white accent
        ifmuted: "#64748b",       // Muted gray

        // Status colors
        ifgreen: "#4ade80",
        ifamber: "#fbbf24",
        ifred: "#f87171",
        ifpink: "#f472b6",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        'planet-glow': 'radial-gradient(circle at center, rgba(34, 211, 238, 0.15) 0%, rgba(139, 92, 246, 0.08) 40%, transparent 70%)',
        'solar-gradient': 'linear-gradient(135deg, #05060f 0%, #0c0d1a 50%, #1a0a2e 100%)',
        'electric-fade': 'linear-gradient(180deg, rgba(34, 211, 238, 0.05) 0%, transparent 100%)',
        'neon-border': 'linear-gradient(90deg, #22d3ee, #8b5cf6, #22d3ee)',
        'comet-trail': 'linear-gradient(90deg, transparent, #fb923c, #f97316, transparent)',
        'solar-flare': 'radial-gradient(circle, rgba(249, 115, 22, 0.2) 0%, transparent 60%)',
        'nebula-warm': 'radial-gradient(ellipse at bottom right, rgba(220, 38, 38, 0.08) 0%, transparent 50%)',
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(34, 211, 238, 0.3)',
        'glow-purple': '0 0 20px rgba(139, 92, 246, 0.3)',
        'glow-planet': '0 0 40px rgba(34, 211, 238, 0.15), 0 0 80px rgba(139, 92, 246, 0.08)',
        'inner-glow': 'inset 0 0 20px rgba(34, 211, 238, 0.05)',
        'glow-solar': '0 0 20px rgba(249, 115, 22, 0.25)',
        'glow-comet': '0 0 15px rgba(251, 146, 60, 0.2)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 4s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'spin-slow': 'spin 20s linear infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.05)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
    },
  },
  plugins: [],
};
