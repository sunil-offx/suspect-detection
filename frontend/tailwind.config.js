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
          300: '#ede0cb',
          400: '#e0d1b6',
          500: '#c5b08e',
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
          950: '#0a0806',
          900: '#15120f',
          800: '#26201b',
          700: '#383029',
          600: '#483f36',
          500: '#564b41',
          400: '#6c5f53',
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
