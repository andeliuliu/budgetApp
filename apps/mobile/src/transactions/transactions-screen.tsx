import { cents, formatMoney } from '@budgetapp/money';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, H1, Paragraph, Separator, SizableText, XStack, YStack } from 'tamagui';

import { useAuth } from '@/auth/auth-provider';
import { api } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';

type Txn = {
  id: string;
  name: string;
  merchantName: string | null;
  amountCents: number;
  date: string;
  category: string;
  pending: boolean;
};

export function TransactionsScreen() {
  const { signOut } = useAuth();
  const { data, loading, refetch } = useApiQuery<Txn[]>('/transactions');
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    setSyncing(true);
    try {
      await api('/plaid/sync', { method: 'POST' }); // pull fresh data from Plaid
      await refetch();
    } catch {
      await refetch();
    } finally {
      setSyncing(false);
    }
  }, [refetch]);

  const txns = data ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <YStack style={{ flex: 1 }}>
        <XStack style={{ padding: 16, justifyContent: 'space-between', alignItems: 'center' }}>
          <H1>Transactions</H1>
          <Button chromeless size="$2" onPress={signOut}>
            Sign out
          </Button>
        </XStack>
        <Separator />
        <FlatList
          data={txns}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={syncing} onRefresh={refresh} />}
          ListEmptyComponent={
            loading ? null : (
              <YStack
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
                <Paragraph theme="alt2" style={{ textAlign: 'center' }}>
                  No transactions yet. A new bank connection takes a few minutes to import —
                  pull down to refresh.
                </Paragraph>
              </YStack>
            )
          }
          renderItem={({ item }) => (
            <XStack style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <YStack style={{ flexShrink: 1, paddingRight: 12 }}>
                <SizableText size="$5" numberOfLines={1}>
                  {item.merchantName ?? item.name}
                </SizableText>
                <SizableText size="$2" theme="alt2">
                  {String(item.date).slice(0, 10)}
                  {item.pending ? ' · pending' : ''} · {item.category}
                </SizableText>
              </YStack>
              <SizableText size="$5" fontWeight="700">
                {formatMoney(cents(item.amountCents))}
              </SizableText>
            </XStack>
          )}
        />
      </YStack>
    </SafeAreaView>
  );
}
