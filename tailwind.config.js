/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src-react/**/*.{js,ts,jsx,tsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary:  'hsl(var(--bg-primary)  / <alpha-value>)',
          secondary:'hsl(var(--bg-secondary)/ <alpha-value>)',
          tertiary: 'hsl(var(--bg-tertiary) / <alpha-value>)',
          calendar: 'hsl(var(--bg-calendar) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'hsl(var(--surface)        / <alpha-value>)',
          hover:   'hsl(var(--surface-hover)  / <alpha-value>)',
          active:  'hsl(var(--surface-active) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'hsl(var(--border)        / <alpha-value>)',
          subtle:  'hsl(var(--border-subtle) / <alpha-value>)',
        },
        violet: {
          50:  'hsl(var(--accent-50)  / <alpha-value>)',
          100: 'hsl(var(--accent-100) / <alpha-value>)',
          200: 'hsl(var(--accent-200) / <alpha-value>)',
          300: 'hsl(var(--accent-300) / <alpha-value>)',
          400: 'hsl(var(--accent-400) / <alpha-value>)',
          500: 'hsl(var(--accent-500) / <alpha-value>)',
          600: 'hsl(var(--accent-600) / <alpha-value>)',
          700: 'hsl(var(--accent-700) / <alpha-value>)',
          800: 'hsl(var(--accent-800) / <alpha-value>)',
          900: 'hsl(var(--accent-900) / <alpha-value>)',
        },
        pink: {
          400: '#f472b6',
          500: '#ec4899'
        },
        text: {
          primary:   'hsl(var(--text-primary)   / <alpha-value>)',
          secondary: 'hsl(var(--text-secondary) / <alpha-value>)',
          muted:     'hsl(var(--text-muted)     / <alpha-value>)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        }
      }
    }
  },
  plugins: []
}
