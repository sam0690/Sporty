/** @type {import('tailwindcss').Config} */
import tailwindcssAnimate from 'tailwindcss-animate';

const config = {
  content: [
    './pages//*.{js,ts,jsx,tsx,mdx}',
    './components//.{js,ts,jsx,tsx,mdx}',
    './app/**/.{js,ts,jsx,tsx,mdx}',
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

    // Brand Palette - Midnight Stadium
    primary: {
      DEFAULT: '#E2E8F0', // Midnight Navy
      foreground: '#ffffff',
      50: '#f1f4f9',
      100: '#e2e9f2',
      200: '#c5d3e5',
      300: '#98b3d1',
      400: '#668bb8',
      500: '#466c9c',
      600: '#35547f',
      700: '#2c4568',
      800: '#273c58',
      900: '#1a2b3c',
    },
    secondary: {
      DEFAULT: '#00cc88', // Emerald Green
      foreground: '#ffffff',
      hover: '#00b377',
    },
    accent: {
      football: '#3b82f6', // Football Blue
      basketball: '#f97316', // Basketball Orange
      cricket: '#8b5cf6', // Cricket Purple
      yellow: '#fbbf24', // Yellow Cards/Warning
      red: '#ef4444', // Red Cards/Alerts
    },
    
    // Surface & Neutrals
    surface: {
      DEFAULT: '#ffffff',
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
    },
    
    // Sports Identity
    pitch: {
      green: '#2d5a27',
      line: '#ffffff',
      court: '#f97316', // Basketball court overlay
      wicket: '#8b5cf6', // Cricket pitch area
    }
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
    'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    'dropdown': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
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
    }
  },
  animation: {
    "accordion-down": "accordion-down 0.2s ease-out",
    "accordion-up": "accordion-up 0.2s ease-out",
    "pulse-slow": "pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
  },
  zIndex: {
    'header': '50',
    'dropdown': '60',
    'sticky': '70',
    'modal-overlay': '80',
    'modal': '90',
    'tooltip': '100',
  }
},

  },
  plugins: [tailwindcssAnimate],
}

export default config