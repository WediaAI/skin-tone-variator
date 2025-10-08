/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'body': ['Inter', 'sans-serif'],
        'special': ['Permanent Marker', 'cursive'],
      },
      colors: {
        'kiabi-slate': '#475569',
        'kiabi-blue': '#1e40af',
        'kiabi-slate-light': '#f1f5f9',
        'kiabi-blue-light': '#dbeafe',
      }
    },
  },
  plugins: [],
}
