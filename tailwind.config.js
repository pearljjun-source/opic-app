/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#E88B9A',
        'primary-light': '#FDE8EB',
        'primary-dark': '#D4707F',
        secondary: '#F5A623',
        warning: '#FBBF24',
        error: '#F87171',
        success: '#34D399',
      },
    },
  },
  plugins: [],
};
