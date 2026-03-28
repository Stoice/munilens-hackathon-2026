import type { Config } from 'tailwindcss';

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // MuniLens Custom Palette
        primary: {
          navy: '#1a2e5a',      // Deep navy
          blue: '#1a6fa8',       // Ocean blue
          teal: '#00b4a6',       // Teal accent
          green: '#4caf50',      // Leaf green
        },
        neutral: {
          light: '#f0f0f0',      // Light grey background
          beige: '#d9c9a8',      // Warm beige
          grey: '#9e9e9e',       // Concrete grey
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
