/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        theme: {
          bg: 'var(--color-bg)',
          surface: 'var(--color-surface)',
          'surface-alt': 'var(--color-surface-alt)',
          border: 'var(--color-border)',
          text: 'var(--color-text)',
          muted: 'var(--color-muted)',
          primary: 'var(--color-primary)',
          'primary-hover': 'var(--color-primary-hover)',
          'primary-text': 'var(--color-primary-text)',
          accent: 'var(--color-accent)',
          neutral: 'var(--color-neutral)',
          'neutral-bg': 'var(--color-neutral-bg)',
        },
        semantic: {
          success: 'var(--color-success)',
          'success-bg': 'var(--color-success-bg)',
          error: 'var(--color-error)',
          'error-bg': 'var(--color-error-bg)',
          duplicate: 'var(--color-duplicate)',
          'duplicate-bg': 'var(--color-duplicate-bg)',
          inflight: 'var(--color-inflight)',
          'inflight-bg': 'var(--color-inflight-bg)',
          neutral: 'var(--color-neutral)',
          'neutral-bg': 'var(--color-neutral-bg)',
          info: 'var(--color-info)',
          'info-bg': 'var(--color-info-bg)',
        },
        entity: {
          1: 'var(--entity-1)',
          2: 'var(--entity-2)',
          3: 'var(--entity-3)',
          4: 'var(--entity-4)',
          5: 'var(--entity-5)',
          6: 'var(--entity-6)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'amber-subtle': '0 4px 20px -2px rgba(245, 158, 11, 0.15)',
        'amber-glow': '0 0 15px 2px rgba(245, 158, 11, 0.35)',
      }
    },
  },
  plugins: [],
}
