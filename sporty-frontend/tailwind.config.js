/** @type {import('tailwindcss').Config} */
import tailwindcssAnimate from 'tailwindcss-animate';

const config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',

        // Brand Palette - New Colors
        primary: {
          DEFAULT: '#247BA0', // Deep Teal/Blue
          foreground: '#ffffff',
          50: '#e6f3f8',
          100: '#cce7f0',
          200: '#99cfe1',
          300: '#66b7d2',
          400: '#339fc3',
          500: '#247BA0',
          600: '#1d6280',
          700: '#164a60',
          800: '#0e3140',
          900: '#071920',
        },
        secondary: {
          DEFAULT: '#CBD4C2', // Soft Sage
          foreground: '#50514F',
          hover: '#b8c3ad',
          50: '#f7f9f5',
          100: '#eff3ea',
          200: '#dfe7d5',
          300: '#CBD4C2',
          400: '#b0bc9e',
          500: '#95a47a',
          600: '#7a8b5e',
          700: '#5f6e48',
          800: '#445032',
          900: '#29321c',
        },
        accent: {
          DEFAULT: '#FFFCFF', // Soft White
          foreground: '#50514F',
          football: '#247BA0', // Using primary
          basketball: '#C3B299', // Warm Taupe
          cricket: '#CBD4C2', // Using secondary
          yellow: '#C3B299',
          red: '#50514F',
        },
        
        // Surface & Neutrals
        surface: {
          DEFAULT: '#FFFCFF',
          50: '#ffffff',
          100: '#FFFCFF',
          200: '#f5f0f5',
          300: '#e6e0e6',
          400: '#d4cdd4',
          500: '#bfb7bf',
          600: '#a69ea6',
          700: '#8a828a',
          800: '#6b636b',
          900: '#4a444a',
        },
        
        // Sports Identity
        pitch: {
          green: '#CBD4C2', // Soft sage green
          line: '#FFFCFF',
          court: '#247BA0',
          wicket: '#C3B299',
        },
        
        // Extra utility colors
        text: {
          primary: '#50514F',
          secondary: '#7a7a78',
          light: '#FFFCFF',
          dark: '#50514F',
        },
        border: {
          DEFAULT: '#CBD4C2',
          light: '#e2e8e0',
          dark: '#b0bca0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.75rem' }],
      },
      borderRadius: {
        'lg': '8px',
        'md': '6px',
        'sm': '4px',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(80 81 79 / 0.1), 0 1px 2px -1px rgb(80 81 79 / 0.1)',
        'card-hover': '0 4px 6px -1px rgb(80 81 79 / 0.1), 0 2px 4px -2px rgb(80 81 79 / 0.1)',
        'dropdown': '0 10px 15px -3px rgb(80 81 79 / 0.1), 0 4px 6px -4px rgb(80 81 79 / 0.1)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pulse-slow": {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "float": {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-slow": "pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fade-in 0.3s ease-out",
        "float": "float 4s ease-in-out infinite",
      },
      zIndex: {
        'header': '50',
        'dropdown': '60',
        'sticky': '70',
        'modal-overlay': '80',
        'modal': '90',
        'tooltip': '100',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

export default config