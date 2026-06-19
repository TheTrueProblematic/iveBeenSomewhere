/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Condensed vintage-poster display type
        display: ['Oswald', 'Impact', 'sans-serif'],
        bubbly: ['Oswald', 'Impact', 'sans-serif'],
        // Typewriter / liner-note voice for labels, numbers, captions
        typewriter: ['"Special Elite"', 'Courier New', 'monospace'],
        // Warm slab-serif body, like a worn paperback
        serif: ['Bitter', 'Georgia', 'serif'],
        sans: ['Bitter', 'Georgia', 'serif'],
      },
      colors: {
        ink: '#211c18',     // the man in black
        coal: '#322b25',
        ash: '#4a3f36',
        paper: {
          DEFAULT: '#f1e7d2', // aged page
          light: '#f7f0e1',
          dark: '#e6d8bd',
        },
        oxblood: '#7e2b2b',
        brick: '#a23b2c',
        rust: '#c0552f',
        brass: '#c79a3a',   // gold record
        gold: '#e0bd6a',
        denim: '#3f5a63',   // faded work-shirt blue
      },
      boxShadow: {
        glow: '0 0 22px -4px rgba(199, 154, 58, 0.5)',
        'glow-strong': '0 0 30px -2px rgba(224, 189, 106, 0.7)',
        card: '0 16px 38px -18px rgba(33, 28, 24, 0.55)',
        'card-hover': '0 24px 50px -20px rgba(126, 43, 43, 0.5)',
      },
      backgroundImage: {
        'cash-gradient': 'linear-gradient(135deg, #7e2b2b 0%, #a23b2c 48%, #c79a3a 100%)',
        'rail-gradient': 'linear-gradient(135deg, #211c18 0%, #4a3f36 55%, #7e2b2b 100%)',
        'brass-gradient': 'linear-gradient(135deg, #a9712f 0%, #c79a3a 50%, #e0bd6a 100%)',
        'paper-gradient': 'linear-gradient(180deg, #f7f0e1 0%, #f1e7d2 50%, #e9dcc2 100%)',
      },
      keyframes: {
        gradient: {
          '0%, 100%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-16px)' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translate(0px, 0px) scale(1)' },
          '50%': { transform: 'translate(24px, -34px) scale(1.08)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        pop: {
          '0%': { transform: 'scale(0.85)', opacity: '0' },
          '60%': { transform: 'scale(1.06)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-5deg)' },
          '50%': { transform: 'rotate(5deg)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.12)' },
        },
        risein: {
          '0%': { transform: 'translateY(14px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        // Slower, gentler entrance for the "Forgot Password?" reveal — a calm fade.
        fadeInUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        gradient: 'gradient 8s ease infinite',
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'floatSlow 18s ease-in-out infinite',
        shimmer: 'shimmer 2.5s infinite',
        pop: 'pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
        wiggle: 'wiggle 0.9s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        risein: 'risein 0.5s ease-out both',
        'fade-in-up': 'fadeInUp 0.8s ease-out both',
      },
    },
  },
  plugins: [],
}
