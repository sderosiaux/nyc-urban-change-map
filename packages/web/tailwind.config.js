/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Intensity colors
        intensity: {
          low: '#94a3b8',      // slate-400
          medium: '#fbbf24',   // amber-400
          high: '#f97316',     // orange-500
          extreme: '#dc2626',  // red-600
        },
        // Certainty indicators
        certainty: {
          discussion: 'rgba(148, 163, 184, 0.4)',  // slate-400 40%
          probable: 'rgba(251, 191, 36, 0.7)',     // amber-400 70%
          certain: 'rgba(34, 197, 94, 1)',         // green-500 100%
        },
      },
      animation: {
        'slide-in': 'slideIn 0.2s ease-out',
        'slide-out': 'slideOut 0.2s ease-in',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideOut: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [],
};
