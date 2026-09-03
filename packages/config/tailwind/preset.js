const colors = require('../theme/colors.json');

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: colors.brand,
        primaryDark: colors.primary,
        primaryWhite: colors.white,
        background: colors.background,
        cardBorder: colors.border,
        divider: colors.divider,
        textHeading: colors.textHeading,
        textSecondary: colors.textSecondary,
        error: colors.error,
        warning: colors.warning,
        success: colors.success,
        accent: colors.accent,
        roles: colors.roles,
      },
      fontFamily: {
        headingTh: ['Mitr', 'sans-serif'],
        headingEn: ['Baloo 2', 'cursive', 'sans-serif'],
        body: ['Noto Sans Thai', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
