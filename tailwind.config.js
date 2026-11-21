// Scale from CSS channel variables in app/globals.css (keeps `/opacity` modifiers working)
const scale = (name) =>
  Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((n) => [n, `rgb(var(--${name}-${n}) / <alpha-value>)`])
  );

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // The old class names stay; the colours behind them are the "quiet night" tokens
      colors: {
        slate: scale('ink'),
        purple: scale('accent'),
        violet: scale('accent'),
        fuchsia: scale('accent'),
        indigo: scale('accent'),
      },
      // `animate-fadeIn`: cards, pills and dialogs ease in. Opacity only, so it never fights the transforms
      // some of them use for positioning (e.g. the centred toast)
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        // CharacterStage: the new character picture rises and settles while fading in
        stageMood: {
          from: { opacity: '0', transform: 'translateY(16px) scale(1.03)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 200ms ease-out',
        stageMood: 'stageMood 550ms cubic-bezier(0.2, 0.7, 0.2, 1) both',
        stageScene: 'fadeIn 800ms ease-in-out both',
      },
    },
  },
  plugins: [],
};