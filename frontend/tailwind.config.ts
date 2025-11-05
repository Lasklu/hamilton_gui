import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fff5f7',   // very light tint
          100: '#ffe4e6',
          200: '#fcbcc5',
          300: '#f6899c',
          400: '#ec4f63',
          500: '#b20138',   // base (178,1,56)
          600: '#970134',
          700: '#7b022e',
          800: '#600226',
          900: '#4a021e',
        },
        accent: {
          500: '#df6201',   // (223,98,1)
          600: '#b85000',
          700: '#933f00',
        },
        highlight: {
          400: '#f7ab00',   // (247,171,0)
          500: '#d99500',
          600: '#b37c00',
        },
      },
    },
  },
  plugins: [],
}

export default config
