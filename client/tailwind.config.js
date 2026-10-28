/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#9b1c2c', dark: '#7a1522', light: '#fbeaec' },
        gold: { DEFAULT: '#c9a227', dark: '#a8861c', light: '#faf3d9' },
        ink: { DEFAULT: '#17171a', soft: '#232328', line: '#34343b' },
      },
      boxShadow: { soft: '0 4px 24px -8px rgba(23,23,26,.12)' },
      keyframes: { fade: { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } } },
      animation: { fade: 'fade .18s ease-out' },
    },
  },
  plugins: [],
};
