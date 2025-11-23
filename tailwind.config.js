/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "!./vision/**/*",
    "!./electron/**/*"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
