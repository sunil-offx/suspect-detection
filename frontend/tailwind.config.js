/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        noir: {
          950: '#090b0e',
          900: '#0f1217',
          850: '#141820',
          800: '#1a202c',
          700: '#283142',
        },
        parchment: {
          50: '#fdfbf7',
          100: '#f8f4ea',
          200: '#f1e7d2',
          300: '#e5d7be',
          400: '#d5c2a1',
          500: '#bf9b6b',
          card: '#f7f2e7',
          cardAlt: '#ede4cf',
          border: '#d6c7ab',
        },
        crimson: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        ink: {
          950: '#110e0b',
          900: '#1c1916',
          800: '#2b2622',
          700: '#443c35',
          600: '#5e5349',
          500: '#7f7265',
          400: '#a39686',
        }
      },
      fontFamily: {
        serif: ['"Crimson Pro"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'dossier': '0 12px 35px -8px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(180, 160, 130, 0.35)',
        'dossier-sm': '0 4px 15px -3px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(180, 160, 130, 0.3)',
        'crimson': '0 8px 24px -4px rgba(153, 27, 27, 0.45)',
      }
    },
  },
  plugins: [],
}
