/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        pb: {
          blue: '#4353FF',
          dark: '#1A1F36',
          gray: '#F7F8FA',
        },
      },
    },
  },
  plugins: [],
};
