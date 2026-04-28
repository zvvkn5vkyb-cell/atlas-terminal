import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        terminalBg: '#0b0b0d',
        terminalSidebar: '#08090a',
        terminalPanel: '#111214',
        terminalElevated: '#16181b',
        terminalBorder: '#2a2d31',
        terminalStrongBorder: '#3a3d42',
        terminalText: '#e6e6e6',
        terminalSubtext: '#a8adb4',
        terminalMuted: '#7f858d',
        terminalAmber: '#f0a020',
        terminalOrange: '#ff9f1a',
        terminalYellow: '#ffd24d',
        terminalGreen: '#00c853',
        terminalRed: '#ff4d57',
        terminalBlue: '#4da3ff',
        terminalCyan: '#39c0ed',
        terminalPurple: '#9b6bff',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Consolas', 'Monaco', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
    },
  },
  plugins: [],
}

export default config
