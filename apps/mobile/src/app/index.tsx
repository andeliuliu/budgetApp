import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, H1, Paragraph, Separator, SizableText, XStack, YStack } from 'tamagui';

import { cents, formatMoney } from '@budgetapp/money';
import { CATEGORIES, type Category } from '@budgetapp/types';
import { brand } from '@/theme/colors';

// Human labels for the shared Category enum.
const CATEGORY_LABELS: Record<Category, string> = {
  grocery: 'Groceries',
  dining: 'Dining',
  shopping: 'Shopping',
  transportation: 'Transportation',
  investments: 'Investments',
  savings: 'Savings',
  rent: 'Rent',
  utilities: 'Utilities',
  subscriptions: 'Subscriptions',
  other: 'Other',
};

// Placeholder spend (integer cents) until Plaid sync lands in Phase 1.
const MOCK_SPEND: Partial<Record<Category, number>> = {
  grocery: 24310,
  dining: 18650,
  shopping: 9925,
  utilities: 14200,
  subscriptions: 4799,
  rent: 185000,
};

export default function SpendingScreen() {
  const rows = CATEGORIES.filter((c) => MOCK_SPEND[c] != null);
  const total = rows.reduce((sum, c) => sum + (MOCK_SPEND[c] ?? 0), 0);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <YStack gap="$2">
          <Paragraph theme="alt2">June 2026</Paragraph>
          <H1 color={brand.accent}>{formatMoney(cents(total))}</H1>
          <Paragraph theme="alt2">spent this month</Paragraph>
        </YStack>

        <Separator />

        <YStack gap="$2.5">
          {rows.map((c) => (
            <Card
              key={c}
              background="$background"
              borderColor="$borderColor"
              style={{ borderWidth: 1, borderRadius: 12, padding: 14 }}>
              <XStack style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <SizableText size="$5">{CATEGORY_LABELS[c]}</SizableText>
                <SizableText size="$5" fontWeight="700">
                  {formatMoney(cents(MOCK_SPEND[c] ?? 0))}
                </SizableText>
              </XStack>
            </Card>
          ))}
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}
