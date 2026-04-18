import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-geist-sans)",
          "Arial",
          "Apple Color Emoji",
          "Segoe UI Emoji",
          "Segoe UI Symbol",
        ],
        mono: [
          "var(--font-geist-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Roboto Mono",
          "Menlo",
          "Monaco",
          "Liberation Mono",
          "DejaVu Sans Mono",
          "Courier New",
        ],
      },
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        // hsl() wrapper with <alpha-value> placeholder so Tailwind's opacity
        // modifier (e.g. `ring-ring/50`) substitutes the alpha channel
        // correctly. --ring is stored as an HSL triplet in globals.css.
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        ship: "var(--ship)",
        preview: "var(--preview)",
        develop: "var(--develop)",
        link: "var(--link)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      ringWidth: {
        // shadcn v3 components ship with `ring-3`; Tailwind v3.4 doesn't
        // include it in the default scale, so we extend it here. Without
        // this, every focus-visible:ring-3 class compiles to zero width
        // and the focus ring is invisible.
        "3": "3px",
      },
      letterSpacing: {
        tighter: "-0.04em",
        tight: "-0.025em",
        display: "-0.05em",
      },
      boxShadow: {
        hairline: "var(--shadow-hairline)",
        "hairline-light": "var(--shadow-hairline-light)",
        card: "var(--shadow-card)",
        "card-elevated": "var(--shadow-card-elevated)",
      },
    },
  },
  plugins: [],
};
export default config;
