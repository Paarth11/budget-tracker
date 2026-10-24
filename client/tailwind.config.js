/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#16211C',
        paper: '#F5F7F4',
        leaf: '#1E8449',
        mint: '#DCEFE3',
        gold: '#9A6700',
        brick: '#B83A2E',
        line: '#D5DDD7',
      },
      fontFamily: { sans: ['"Schibsted Grotesk"', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
