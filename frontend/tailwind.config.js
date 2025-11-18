/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Neumorphism colors
        light: {
          bg: '#e0e5ec',
          shadow1: '#bebebe',
          shadow2: '#ffffff',
        },
        dark: {
          bg: '#2a2d32',
          shadow1: '#191b1d',
          shadow2: '#3b3f45',
        },
        // Brand colors
        primary: {
          50: '#f0f7ff',
          100: '#e0efff',
          500: '#2575fc',
          600: '#1e68e6',
          700: '#1a5cd1',
        },
        secondary: {
          500: '#6a11cb',
          600: '#5a0fb8',
          700: '#4a0d9a',
        },
      },
      boxShadow: {
        // Neumorphism shadows
        'neu-light': '5px 5px 10px #bebebe, -5px -5px 10px #ffffff',
        'neu-light-lg': '15px 15px 30px #bebebe, -15px -15px 30px #ffffff',
        'neu-light-inset': 'inset 5px 5px 10px #bebebe, inset -5px -5px 10px #ffffff',
        'neu-light-inset-lg': 'inset 10px 10px 20px #bebebe, inset -10px -10px 20px #ffffff',
        'neu-dark': '5px 5px 10px #191b1d, -5px -5px 10px #3b3f45',
        'neu-dark-lg': '15px 15px 30px #191b1d, -15px -15px 30px #3b3f45',
        'neu-dark-inset': 'inset 5px 5px 10px #191b1d, inset -5px -5px 10px #3b3f45',
        'neu-dark-inset-lg': 'inset 10px 10px 20px #191b1d, inset -10px -10px 20px #3b3f45',
        // Button shadows
        'btn-light': '5px 5px 15px rgba(106, 17, 203, 0.3)',
        'btn-light-hover': '2px 2px 8px rgba(106, 17, 203, 0.4)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #6a11cb, #2575fc)',
        'gradient-text': 'linear-gradient(135deg, #6a11cb, #2575fc)',
      },
      fontFamily: {
        'sans': ['Segoe UI', 'sans-serif'],
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'fadeInUp': 'fadeInUp 0.6s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        fadeInUp: {
          '0%': {
            opacity: '0',
            transform: 'translateY(30px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
      },
      borderRadius: {
        'neu': '20px',
        'neu-sm': '15px',
        'neu-lg': '25px',
      },
    },
  },
  plugins: [],
}