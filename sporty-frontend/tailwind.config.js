/** @type {import('tailwindcss').Config} */
import tailwindcssAnimate from "tailwindcss-animate";

const config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",

  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },

    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        // =========================
        // BRAND CORE (Fantasy Sports)
        // =========================
        primary: {
          DEFAULT: "#04724D",
          foreground: "#F4F4F9",
          hover: "#035c3d",
        },

        secondary: {
          DEFAULT: "#586F7C",
          foreground: "#F4F4F9",
          hover: "#3f515c",
        },

        accent: {
          DEFAULT: "#B8DBD9",
          foreground: "#000000",
          hover: "#8fbab7",
        },

        // =========================
        // BASE COLORS
        // =========================
        black: "#000000",
        white: "#F4F4F9",

        backgroundAlt: "#F4F4F9",

        surface: {
          DEFAULT: "#F4F4F9",
          card: "#ffffff",
          dark: "#0b0b0b",
        },

        // =========================
        // TEXT SYSTEM
        // =========================
        text: {
          primary: "#000000",
          secondary: "#586F7C",
          muted: "#586F7C",
          inverse: "#F4F4F9",
        },

        // =========================
        // BORDER SYSTEM
        // =========================
        border: {
          DEFAULT: "#586F7C",
          light: "#B8DBD9",
          dark: "#3a4a55",
        },

        // =========================
        // SPORTS STATES
        // =========================
        success: "#04724D",
        danger: "#e63946",
        warning: "#f4a261",
        info: "#3a86ff",

        // =========================
        // SPORT THEMES (Fantasy UI)
        // =========================
        sport: {
          football: "#04724D",
          cricket: "#586F7C",
          basketball: "#B8DBD9",
          tennis: "#000000",
        },
      },

      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Montserrat", "Inter", "sans-serif"],
      },

      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.75rem" }],
      },

      borderRadius: {
        lg: "12px",
        md: "8px",
        sm: "6px",
      },

      boxShadow: {
        card: "0 2px 10px rgba(0,0,0,0.08)",
        hover: "0 6px 18px rgba(0,0,0,0.12)",
        strong: "0 10px 30px rgba(0,0,0,0.18)",
        glow: "0 0 18px rgba(4, 114, 77, 0.35)",
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

        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },

        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },

        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },

      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        float: "float 4s ease-in-out infinite",
        pulseSoft: "pulseSoft 2.5s ease-in-out infinite",
      },

      zIndex: {
        header: "50",
        dropdown: "60",
        sticky: "70",
        "modal-overlay": "80",
        modal: "90",
        tooltip: "100",
      },

      screens: {
        xs: "400px",
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1400px",
      },
    },
  },

  plugins: [tailwindcssAnimate],
};

export default config;