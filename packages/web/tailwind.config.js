/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /**
         * Paleta do convite (elegante e romântica).
         * Tons terrosos/dourados com base creme.
         */
        wedding: {
          50: '#fdfbf7',
          100: '#faf5ec',
          200: '#f3e8d7',
          300: '#e8d4b8',
          400: '#d9b98e',
          500: '#c99f6b',
          600: '#b3854f',
          700: '#8c6b4f',
          800: '#6b5240',
          900: '#4a3a2e',
        },
        /** Cor de destaque (dourado envelhecido). */
        gold: {
          300: '#e3c9a0',
          400: '#d4b483',
          500: '#c19a6b',
          600: '#a8804f',
        },
        /** Paleta do painel administrativo (profissional). */
        ink: {
          50: '#f6f7f9',
          100: '#eceef2',
          200: '#d5d9e2',
          300: '#b0b8c8',
          400: '#8491a8',
          500: '#65738d',
          600: '#505c74',
          700: '#424b5e',
          800: '#39404f',
          900: '#1e2532',
          950: '#141a24',
        },
        /** Cores semânticas de status. */
        success: {
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
      },
      fontFamily: {
        /** Tipografia do convite: serifada e refinada. */
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        /** Tipografia do painel: sans-serif limpa. */
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        script: ['"Great Vibes"', 'cursive'],
      },
      letterSpacing: {
        widest: '0.28em',
      },
      boxShadow: {
        soft: '0 4px 20px rgba(30, 37, 50, 0.06)',
        card: '0 8px 30px rgba(30, 37, 50, 0.08)',
        elevated: '0 16px 48px rgba(30, 37, 50, 0.12)',
        invite: '0 24px 64px rgba(74, 58, 46, 0.16)',
      },
      backgroundImage: {
        'wedding-gradient': 'linear-gradient(160deg, #fdfbf7 0%, #f3e8d7 100%)',
        'gold-line': 'linear-gradient(90deg, transparent, #d4b483, transparent)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(24px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'flash-success': {
          '0%': { backgroundColor: 'rgba(16, 185, 129, 0)' },
          '40%': { backgroundColor: 'rgba(16, 185, 129, 0.24)' },
          '100%': { backgroundColor: 'rgba(16, 185, 129, 0)' },
        },
        'flash-danger': {
          '0%': { backgroundColor: 'rgba(239, 68, 68, 0)' },
          '40%': { backgroundColor: 'rgba(239, 68, 68, 0.24)' },
          '100%': { backgroundColor: 'rgba(239, 68, 68, 0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease-out both',
        'fade-in-up': 'fade-in-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-in-right': 'slide-in-right 0.35s ease-out both',
        'flash-success': 'flash-success 0.9s ease-out',
        'flash-danger': 'flash-danger 0.9s ease-out',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};
