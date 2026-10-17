/** @type {import('tailwindcss').Config} */

// Design tokens for the "spatial analysis instrument" look. The existing utility classes keep their
// names; each colour family is re-pointed to a role so the whole UI follows the new palette:
//
//   slate    blue-grey surfaces and text   (950 = page #0B1017, 900 = panel #151E29)
//   sky      primary accent, selection     (400 = cyan #22D3EE)
//   emerald  observed / confirmed geometry (muted cyan)
//   amber    estimated geometry            (#FBBF24)
//   orange   low-confidence inference      (muted orange)
//   rose     errors, contradictions        (restrained red)
//   indigo / purple  relations and tracing (steel blue)
const slate = {
  50: '#F3F6F9',
  100: '#E6EDF5',
  200: '#CBD6E2',
  300: '#A9B8C9',
  400: '#8EA0B5',
  500: '#74869C',
  600: '#475A6F',
  700: '#32445A',
  800: '#243244',
  900: '#151E29',
  950: '#0B1017',
};

const cyan = {
  50: '#ECFEFF',
  100: '#CFFAFE',
  200: '#A5F3FC',
  300: '#67E8F9',
  400: '#22D3EE',
  500: '#14A8C2',
  600: '#0C7C93',
  700: '#0E6A80',
  800: '#155A6E',
  900: '#164B5C',
  950: '#083344',
};

const mutedCyan = {
  50: '#EFFAFB',
  100: '#D9F1F4',
  200: '#B5E3EA',
  300: '#8FD3DE',
  400: '#5BB8C9',
  500: '#3C9BAE',
  600: '#2C7D8F',
  700: '#25626F',
  800: '#1F4A55',
  900: '#173843',
  950: '#0F2730',
};

const mutedOrange = {
  50: '#FDF4EC',
  100: '#FAE6D4',
  200: '#F3CBA8',
  300: '#E9A777',
  400: '#DE8B4D',
  500: '#C8733A',
  600: '#A65C2E',
  700: '#854A28',
  800: '#653A24',
  900: '#4A2B1C',
  950: '#2E1A11',
};

const restrainedRed = {
  50: '#FBF1F1',
  100: '#F6DEDE',
  200: '#EDBDBD',
  300: '#E49C9C',
  400: '#D87878',
  500: '#C65A5A',
  600: '#A94646',
  700: '#863737',
  800: '#652C2C',
  900: '#4A2323',
  950: '#2E1717',
};

const steel = {
  50: '#F1F4F9',
  100: '#E2E8F2',
  200: '#C5D1E6',
  300: '#A3B5D4',
  400: '#8197BD',
  500: '#637CA6',
  600: '#4D6389',
  700: '#3D4F6E',
  800: '#2F3E57',
  900: '#232F43',
  950: '#161E2C',
};

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    // Tighter corners: cards read as instrument panels, not rounded app cards.
    borderRadius: {
      none: '0px',
      sm: '0.1875rem',
      DEFAULT: '0.25rem',
      md: '0.3125rem',
      lg: '0.375rem',
      xl: '0.5rem',
      '2xl': '0.625rem',
      '3xl': '0.75rem',
      full: '9999px',
    },
    extend: {
      colors: {
        slate,
        sky: cyan,
        emerald: mutedCyan,
        orange: mutedOrange,
        rose: restrainedRed,
        indigo: steel,
        purple: steel,
      },
      fontFamily: {
        sans: [
          'Inter',
          'Pretendard',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Apple SD Gothic Neo',
          'Noto Sans KR',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
};
