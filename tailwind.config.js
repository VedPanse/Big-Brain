export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#2f6bff',
        mist: '#f5f6f8',
      },
      fontFamily: {
        display: ['"Avenir Next"', '"SF Pro Display"', '"Helvetica Neue"', 'sans-serif'],
        body: ['"Avenir Next"', '"SF Pro Text"', '"Helvetica Neue"', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 20px 50px rgba(15, 23, 42, 0.08)',
        float: '0 16px 30px rgba(15, 23, 42, 0.12)',
      },
      backdropBlur: {
        glass: '30px',
      },
    },
  },
  plugins: [],
}
