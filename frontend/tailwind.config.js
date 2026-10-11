import defaultColors from 'tailwindcss/colors';
import animate from 'tailwindcss-animate';

/**
 * Restricted palette: neutrals (zinc) + one brand green (from the logo) + red/amber
 * for status only. Decorative hues used across older views are folded into these
 * so the whole app stays on the same three colours.
 */
const brand = {
  50: '#f1f8f2',
  100: '#ddefe1',
  200: '#bcdfc4',
  300: '#8fc69d',
  400: '#5fa772',
  500: '#3f8b54',
  600: '#2f7a3d',
  700: '#276233',
  800: '#224f2c',
  900: '#1d4126',
  950: '#0e2414',
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand,
        // Folded hues
        blue: brand,
        indigo: brand,
        violet: brand,
        purple: brand,
        sky: brand,
        cyan: brand,
        teal: brand,
        emerald: brand,
        green: brand,
        lime: brand,
        fuchsia: brand,
        pink: brand,
        orange: defaultColors.amber,
        yellow: defaultColors.amber,
        rose: defaultColors.red,
        success: brand[600],
        warning: defaultColors.amber[600],
        danger: defaultColors.red[600],
        // shadcn/ui tokens (values in src/index.css)
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
      },
      fontFamily: {
        sans: ['Geist', 'Noto Sans Devanagari', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Instrument Serif', 'Noto Sans Devanagari', 'ui-serif', 'Georgia', 'serif'],
        mono: ['Geist Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [animate],
};
