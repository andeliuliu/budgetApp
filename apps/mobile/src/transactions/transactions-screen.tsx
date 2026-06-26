import { cents, formatMoney } from '@budgetapp/money';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, H1, Paragraph, Separator, SizableText, XStack, YStack } from 'tamagui';

import { useAuth } from '@/auth/auth-provider';
import { api } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import { brand } from '@/theme/colors';
import { categoryMeta } from './category-meta';

type Txn = {
  id: string;
  name: string;
  merchantName: string | null;
  amountCents: number;
  date: string;
  category: string;
  pending: boolean;
};

type Group = { category: string; label: string; emoji: string; total: number; items: Txn[] };

function groupByCategory(txns: Txn[]): Group[] {
  const map = new Map<string, Txn[]>();
  for (const t of txns) {
    const arr = map.get(t.category);
    if (arr) arr.push(t);
    else map.set(t.category, [t]);
  }
  return [...map.entries()]
    .map(([category, items]) => ({
      category,
      ...categoryMeta(category),
      total: items.reduce((s, t) => s + t.amountCents, 0),
      items,
    }))
    .sort((a, b) => {
      // "other" (transfers/loans/uncategorized) always sits last.
      if (a.category === 'other') return 1;
      if (b.category === 'other') return -1;
      return b.total - a.total;
    });
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function TransactionsScreen() {
  const { signOut } = useAuth();
  const { data, loading, refetch } = useApiQuery<Txn[]>('/transactions');
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setSyncing(true);
    try {
      await api('/plaid/sync', { method: 'POST' });
      await api('/plaid/recategorize', { method: 'POST' });
      await refetch();
    } catch {
      await refetch();
    } finally {
      setSyncing(false);
    }
  }, [refetch]);

  const txns = data ?? [];
  const groups = groupByCategory(txns);
  // Spend total excludes the "other" bin (transfers/loans aren't spending).
  const spent = txns
    .filter((t) => t.category !== 'other')
    .reduce((s, t) => s + t.amountCents, 0);
  const grid = chunk(groups, 3);
  const selectedGroup = groups.find((g) => g.category === selected) ?? null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <YStack style={{ flex: 1 }}>
        <XStack style={{ padding: 16, justifyContent: 'space-between', alignItems: 'center' }}>
          <SizableText size="$6" fontWeight="700">
            Spending
          </SizableText>
          <Button chromeless size="$2" onPress={signOut}>
            Sign out
          </Button>
        </XStack>
        <Separator />

        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 20, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={syncing} onRefresh={refresh} />}>
          {txns.length === 0 ? (
            !loading && (
              <YStack style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
                <Paragraph theme="alt2" style={{ textAlign: 'center' }}>
                  No transactions yet. A new bank connection takes a few minutes to import —
                  pull down to refresh.
                </Paragraph>
              </YStack>
            )
          ) : (
            <>
              <YStack style={{ gap: 4 }}>
                <Paragraph theme="alt2">This month</Paragraph>
                <H1 color={brand.accent}>{formatMoney(cents(spent))}</H1>
                <Paragraph theme="alt2">spent</Paragraph>
              </YStack>

              <YStack style={{ gap: 10 }}>
                {grid.map((row, ri) => (
                  <XStack key={ri} style={{ gap: 10 }}>
                    {row.map((g) => {
                      const active = g.category === selected;
                      return (
                        <Pressable
                          key={g.category}
                          style={{ flex: 1 }}
                          onPress={() => setSelected(active ? null : g.category)}>
                          <YStack
                            style={{
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 4,
                              minHeight: 100,
                              padding: 12,
                              borderRadius: 14,
                              borderWidth: active ? 2 : 1,
                              borderColor: active ? brand.accent : '#E6E6E6',
                              backgroundColor: active ? brand.accentSoft : '#fff',
                            }}>
                            <SizableText size="$8">{g.emoji}</SizableText>
                            <SizableText size="$2" numberOfLines={1}>
                              {g.label}
                            </SizableText>
                            <SizableText size="$3" fontWeight="700">
                              {formatMoney(cents(g.total))}
                            </SizableText>
                          </YStack>
                        </Pressable>
                      );
                    })}
                    {row.length < 3 &&
                      Array.from({ length: 3 - row.length }).map((_, i) => (
                        <YStack key={`pad-${i}`} style={{ flex: 1 }} />
                      ))}
                  </XStack>
                ))}
              </YStack>

              {selectedGroup ? (
                <YStack style={{ gap: 12 }}>
                  <Separator />
                  <XStack style={{ alignItems: 'center', gap: 8 }}>
                    <SizableText size="$6">{selectedGroup.emoji}</SizableText>
                    <SizableText size="$5" fontWeight="700">
                      {selectedGroup.label}
                    </SizableText>
                    <SizableText size="$3" theme="alt2">
                      · {selectedGroup.items.length}
                    </SizableText>
                  </XStack>
                  {selectedGroup.items.map((t) => (
                    <XStack key={t.id} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <YStack style={{ flexShrink: 1, paddingRight: 12 }}>
                        <SizableText size="$4" numberOfLines={1}>
                          {t.merchantName ?? t.name}
                        </SizableText>
                        <SizableText size="$1" theme="alt2">
                          {String(t.date).slice(0, 10)}
                          {t.pending ? ' · pending' : ''}
                        </SizableText>
                      </YStack>
                      <SizableText size="$4">{formatMoney(cents(t.amountCents))}</SizableText>
                    </XStack>
                  ))}
                </YStack>
              ) : (
                <Paragraph theme="alt2" style={{ textAlign: 'center' }}>
                  Tap a category to see its transactions.
                </Paragraph>
              )}
            </>
          )}
        </ScrollView>
      </YStack>
    </SafeAreaView>
  );
}
