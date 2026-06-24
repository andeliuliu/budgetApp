/**
 * Gender-neutral brand palette: a calm neutral base (provided by Tamagui's
 * default themes) plus a single teal accent and semantic budget colors.
 * No gendered (pink/blue) coding.
 */
export const brand = {
  accent: '#0E7C7B', // teal — non-gendered accent
  accentSoft: '#D7EBEA',
  budgetUnder: '#2E9E6B', // green: under budget
  budgetNear: '#D9A21B', // amber: approaching limit
  budgetOver: '#D1495B', // red: over budget
} as const;
