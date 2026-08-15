/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // <-- Add this line
  content: [
    './App.{js,jsx,ts,tsx}',
    './context/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './screens/**/*.{js,jsx,ts,tsx}',
    './navigation/**/*.{js,jsx,ts,tsx}',
    './services/**/*.{js,jsx,ts,tsx}',
    './utils/**/*.{js,jsx,ts,tsx}',
    './types/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#F8F6F3',
        'background-dark': '#0F0D14',
        surface: '#FFFFFF',
        'surface-dark': '#1A1624',
        primary: '#6C4E9A',
        'primary-dark': '#9B7FD4',
        'primary-light': '#8B6FC8',
        'primary-light-dark': '#B59CE6',
        'primary-surface': '#EDE6F6',
        'primary-surface-dark': '#2A2040',
        text: '#1A1620',
        'text-dark': '#F0ECF7',
        'text-secondary': '#5A5266',
        'text-secondary-dark': '#A098B0',
        'text-muted': '#8A829A',
        'text-muted-dark': '#706880',
        border: '#E5E0EA',
        'border-dark': '#2E2840',
        'note-text': '#FCF8F0',
        'note-text-dark': '#1C1828',
        'note-voice': '#EDF5F0',
        'note-voice-dark': '#142820',
        'note-video': '#F5EDF0',
        'note-video-dark': '#281820',
      },
      boxShadow: {
        card: '0 4px 20px rgba(108,78,154,0.08)',
        'card-strong': '0 8px 24px rgba(108,78,154,0.15)',
      },
      borderRadius: {
        xl: '14px',
        '2xl': '20px',
      },
    },
  },
  plugins: [],
};