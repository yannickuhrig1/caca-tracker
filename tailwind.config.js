/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './admin.html',
    './js/**/*.js',
  ],
  // Classes construites hors de portée du scanner statique (cf. styles.css
  // pour slide-in-* / ui-toast-* qui ne sont PAS des utilitaires Tailwind).
  safelist: [],
  theme: {
    extend: {},
  },
  plugins: [],
};
