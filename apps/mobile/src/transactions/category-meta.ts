import type { Category } from '@budgetapp/types';

/** Friendly label + emoji per category. Emoji keeps it gender-neutral and zero-dep. */
export const CATEGORY_META: Record<Category, { label: string; emoji: string }> = {
  grocery: { label: 'Groceries', emoji: '🛒' },
  dining: { label: 'Dining', emoji: '🍽️' },
  shopping: { label: 'Shopping', emoji: '🛍️' },
  transportation: { label: 'Transportation', emoji: '🚗' },
  investments: { label: 'Investments', emoji: '📈' },
  savings: { label: 'Savings', emoji: '🐷' },
  rent: { label: 'Rent', emoji: '🏠' },
  utilities: { label: 'Utilities', emoji: '💡' },
  subscriptions: { label: 'Subscriptions', emoji: '🔁' },
  other: { label: 'Other', emoji: '💳' },
};

export function categoryMeta(category: string) {
  return CATEGORY_META[category as Category] ?? { label: category, emoji: '💳' };
}
