export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"EB Garamond"', 'serif'],
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        hermes: '#D95319',
        parchment: '#F4F0EB',
        craie: '#FBF9F6',
        saddle: '#A67C52',
        espresso: '#2C221E',
      }
    },
  },
  plugins: [],
}