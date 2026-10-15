// Shared neutral scale keeps existing slate utilities in the grey theme.
const neutral = {
  50: '#F7F7F7',
  100: '#F0F0F0',
  200: '#E3E3E3',
  300: '#BEBEBE',
  400: '#7D7D7D',
  500: '#666666',
  600: '#555555',
  700: '#444444',
  800: '#333333',
  900: '#262626',
  950: '#1A1A1A',
};

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#FFD700',
          primary: '#FFD700',
          secondary: '#FFDA44',
          accent: '#F4D03F',
          gold: '#FFD700',
          amber: '#FFDA44',
          muted: '#7D7D7D',
          silver: '#BEBEBE',
          ink: '#333333',
          50: '#FFFBE6',
          100: '#FFF5BF',
          200: '#FFED99',
          300: '#FFDA44',
          400: '#FFD700',
          500: '#FFD700',
          600: '#F4D03F',
          700: '#555555',
          800: '#333333',
          900: '#262626',
        },
        slate: neutral,
        gray: neutral,
        neutral,
        surface: {
          bg: '#F7F7F7',
          card: '#FFFFFF',
          subtle: '#F0F0F0',
          border: '#E3E3E3',
          borderSubtle: '#BEBEBE',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Outfit', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
