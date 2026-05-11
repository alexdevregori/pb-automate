/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        pb: {
          dark:       '#0A1F44',
          cream:      '#FAF7F2',
          'cream-md': '#F5F1EA',
          'cream-dk': '#EFEAE0',
          warm:       '#F1EEE8',
          muted:      '#5A6783',
          subtle:     '#8694B0',
          green:      '#1D9E75',
          'green-bg': '#E8F5EE',
          'green-text': '#0F6E56',
          amber:      '#EF9F27',
          'amber-text': '#B3863C',
          err:        '#C44545',
          'err-text': '#993C1D',
          'err-bg':   '#FCE9DF',
          blue:       '#4353FF',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        mono:    ['JetBrains Mono', 'ui-monospace', 'monospace'],
        sans:    ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
