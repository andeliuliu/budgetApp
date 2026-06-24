import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, H1, Paragraph, Separator, SizableText, XStack, YStack } from 'tamagui';

import { cents, formatMoney } from '@budgetapp/money';
import type { Category } from '@budgetapp/types';
import { brand } from '@/theme/colors';

type BudgetRow = { category: Category; label: string; spent: number; limit: number };

// Placeholder budgets (integer cents) until budgets are persisted in Phase 2.
const BUDGETS: BudgetRow[] = [
  { category: 'grocery', label: 'Groceries', spent: 24310, limit: 40000 },
  { category: 'dining', label: 'Dining', spent: 18650, limit: 20000 },
  { category: 'shopping', label: 'Shopping', spent: 9925, limit: 8000 },
  { category: 'subscriptions', label: 'Subscriptions', spent: 4799, limit: 6000 },
];

function statusColor(ratio: number): string {
  if (ratio >= 1) return brand.budgetOver;
  if (ratio >= 0.8) return brand.budgetNear;
  return brand.budgetUnder;
}

export default function BudgetsScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <YStack gap="$2">
          <Paragraph theme="alt2">June 2026</Paragraph>
          <H1>Budgets</H1>
        </YStack>

        <Separator />

        <YStack gap="$3">
          {BUDGETS.map((b) => {
            const ratio = b.spent / b.limit;
            const pct = Math.min(100, Math.round(ratio * 100));
            return (
              <Card
                key={b.category}
                background="$background"
                borderColor="$borderColor"
                style={{ borderWidth: 1, borderRadius: 12, padding: 14, gap: 8 }}>
                <XStack style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <SizableText size="$5">{b.label}</SizableText>
                  <SizableText size="$3" theme="alt2">
                    {formatMoney(cents(b.spent))} / {formatMoney(cents(b.limit))}
                  </SizableText>
                </XStack>
                <YStack
                  style={{
                    height: 8,
                    backgroundColor: brand.accentSoft,
                    borderRadius: 4,
                    overflow: 'hidden',
                  }}>
                  <YStack
                    style={{ height: 8, width: `${pct}%`, backgroundColor: statusColor(ratio) }}
                  />
                </YStack>
              </Card>
            );
          })}
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}
