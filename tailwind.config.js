/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#FFF5E6',
          100: '#FFE8CC',
          200: '#FFD1A3',
          300: '#FFB366',
          400: '#FF9933',
          500: '#F7931A',
          600: '#E07E00',
          700: '#B86200',
          800: '#8F4C00',
          900: '#6B3800',
        },
        // Provided palette
        brand: '#FBB037',
        accent: '#FE6847',
        porcelain: '#F1E4E8',
        cocoa: '#581908',
        cocoaDark: '#2E0E02',
        background: '#F1E4E8',
        // Design prompt additions
        secondary: '#1E1E1E',
        highlight: '#FFD580',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
