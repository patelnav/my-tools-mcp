/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // Be specific about which TypeScript/JavaScript files to scan
    './src/panel/**/*.{js,ts,jsx,tsx}',
    './src/panel/components/**/*.{js,ts,jsx,tsx}',
    // Exclude test files and node_modules
    '!./src/**/*.test.{js,ts,jsx,tsx}',
    '!./src/**/__tests__/**',
    '!./src/**/node_modules/**'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        border: 'var(--app-border)',
        background: 'var(--app-background)',
        foreground: 'var(--app-foreground)',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate')
  ],
} 