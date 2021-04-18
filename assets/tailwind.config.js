module.exports = {
  purge: [
      "../**/*.html.eex",
      "../**/*.html.leex",
      "../**/views/**/*.ex",
      "../**/live/**/*.ex",
      "./js/**/*.js"
  ],
  darkMode: false, // or 'media' or 'class'
  theme: {
      extend: {
          colors: {
              primary: '#00c6b2',
          },
          gridTemplateRows: {
              'layout': '100px minmax(100vh, 1fr) 100px',
          },
          spacing: {
              'text': '56rem'
          }
      },
  },
  variants: {
      extend: {},
  },
  plugins: [],
}
