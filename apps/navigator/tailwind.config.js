/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // "Aurora da galleria notturna": violetto vivido come accento
        // dominante — le tappe fucsia/ambra del gradiente (vedi
        // .gradient-aurora in main.css) sono l'energia in più sui momenti
        // chiave (play, copertine, avanzamento), non un secondo colore
        // sparso ovunque. Triplette RGB "R G B" perché Tailwind le
        // ricompone con rgb(var(--x) / <alpha-value>) — questo è ciò che
        // permette a bg-brand-500/40 ecc. di funzionare E a un museo di
        // sovrascrivere l'accento a runtime (useMuseumTheme) senza
        // ricompilare nulla.
        brand: {
          50: 'rgb(var(--color-brand-50) / <alpha-value>)',
          100: 'rgb(var(--color-brand-100) / <alpha-value>)',
          200: 'rgb(var(--color-brand-200) / <alpha-value>)',
          300: 'rgb(var(--color-brand-300) / <alpha-value>)',
          400: 'rgb(var(--color-brand-400) / <alpha-value>)',
          500: 'rgb(var(--color-brand-500) / <alpha-value>)',
          600: 'rgb(var(--color-brand-600) / <alpha-value>)',
          700: 'rgb(var(--color-brand-700) / <alpha-value>)',
          800: 'rgb(var(--color-brand-800) / <alpha-value>)',
          900: 'rgb(var(--color-brand-900) / <alpha-value>)',
          950: 'rgb(var(--color-brand-950) / <alpha-value>)',
        },
        // Seconda tappa del gradiente aurora, usata anche da sola per
        // piccoli accenti caldi (badge, evidenze) quando serve staccare
        // dal violetto dominante.
        ember: {
          400: '#fb923c',
          500: '#f59e0b',
          600: '#d97706',
        },
        // Scala neutra con la stessa impronta violetta del brand — non
        // grigio puro: è la differenza tra "grigio scelto" e "grigio di
        // default".
        surface: {
          50: '#f7f6fb',
          100: '#ece9f4',
          200: '#d3cce4',
          300: '#a99cc4',
          400: '#8478a3',
          500: '#655a82',
          600: '#493f66',
          700: '#332a4d',
          800: '#211a35',
          900: '#161027',
          950: '#0b0813',
        },
        success: {
          50: '#062820',
          100: 'rgb(16 217 163 / 0.14)',
          500: '#10d9a3',
          600: '#0cb787',
          700: '#0a9670',
        },
        warning: {
          50: '#2b1c08',
          100: 'rgb(245 165 36 / 0.14)',
          500: '#f5a524',
          600: '#d9860f',
          700: '#b5690a',
        },
        danger: {
          50: '#2b0d15',
          100: 'rgb(244 63 94 / 0.14)',
          500: '#f43f5e',
          600: '#d92c4b',
          700: '#b31f3b',
        },
      },
      fontFamily: {
        // Titoli con carattere, corpo del testo altamente leggibile per
        // l'ascolto-con-lettura-simultanea: due famiglie deliberatamente
        // diverse, non la stessa riusata a pesi diversi.
        display: ['"Unbounded"', 'system-ui', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
      },
      boxShadow: {
        glow: '0 8px 32px -8px rgb(var(--color-brand-500) / 0.45)',
        'glow-lg': '0 16px 48px -12px rgb(var(--color-brand-500) / 0.5)',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.3s ease-out',
        'pop-in': 'popIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        drift: 'drift 12s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.85)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        drift: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(-3%, 3%) scale(1.08)' },
        },
      },
    },
  },
  plugins: [],
};
