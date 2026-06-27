/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#FDFBF7', // Main body cream background
        darkSurface: '#FFFFFF', // Crisp white secondary card surfaces
        darkCard: '#FFFFFF', // Crisp white tertiary card surfaces
        electricBlue: '#00A3E0', // Premium, rich blue
        neonPurple: '#7C3AED', // Premium, warm violet
        neonPink: '#DB2777', // Premium rose pink
        white: '#1E1B18', // Redefining white to map to dark charcoal for in-place text and border support
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
        mono: ['Share Tech Mono', 'Space Mono', 'monospace'],
      },
      boxShadow: {
        'glow-blue': '0 0 15px rgba(0, 163, 224, 0.15)',
        'glow-purple': '0 0 15px rgba(124, 58, 237, 0.15)',
        'glow-pink': '0 0 15px rgba(219, 39, 119, 0.15)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'float-slow': 'float-slow 20s ease-in-out infinite alternate',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'float-slow': {
          '0%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(6%, 10%) scale(1.1)' },
          '100%': { transform: 'translate(-4%, -6%) scale(0.95)' },
        }
      }
    },
  },
  plugins: [],
}
