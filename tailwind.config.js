/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        // Deep pitch-green accent
        pitch: {
          50: '#eef7f1',
          100: '#d4ecdc',
          200: '#a9d8ba',
          300: '#76bd91',
          400: '#449d6a',
          500: '#1f7d4d',
          600: '#0f6b40',
          700: '#0a5733',
          800: '#08442a',
          900: '#063322',
          950: '#031f15',
        },
        // Prize golds / silver / bronze
        gold: {
          light: '#fbe7a1',
          DEFAULT: '#d4af37',
          dark: '#a8841f',
        },
        silver: {
          light: '#e9edf1',
          DEFAULT: '#b9c2cc',
          dark: '#8a949e',
        },
        bronze: {
          light: '#f0d3b5',
          DEFAULT: '#cd7f32',
          dark: '#9c5e22',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.05), 0 1px 3px rgba(16, 24, 40, 0.08)',
        lift: '0 12px 32px -8px rgba(6, 51, 34, 0.18)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '60%': { opacity: '1', transform: 'scale(1.03)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
        'pop-in': 'pop-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
}
