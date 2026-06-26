import { SafeAreaView } from 'react-native-safe-area-context';
import { Spinner, YStack } from 'tamagui';

import { useApiQuery } from '@/lib/use-api-query';
import { ConnectBankScreen } from '@/plaid/connect-bank-screen';
import { TransactionsScreen } from '@/transactions/transactions-screen';

type Account = { id: string };

/** Authed root: no connected accounts -> Connect; otherwise -> Transactions. */
export function Home() {
  const { data: accounts, loading, refetch } = useApiQuery<Account[]>('/accounts');

  if (loading && !accounts) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <YStack style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Spinner size="large" />
        </YStack>
      </SafeAreaView>
    );
  }

  if (!accounts || accounts.length === 0) {
    return <ConnectBankScreen onConnected={refetch} />;
  }

  return <TransactionsScreen />;
}
