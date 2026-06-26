import { SafeAreaView } from 'react-native-safe-area-context';
import { Spinner, YStack } from 'tamagui';

import { ConnectBankScreen } from '@/plaid/connect-bank-screen';
import { AuthScreen } from './auth-screen';
import { useAuth } from './auth-provider';
import { MissingSupabaseConfigScreen } from './missing-supabase-config-screen';

export function AuthGate() {
  const { configReady, loading, session } = useAuth();

  if (!configReady) {
    return <MissingSupabaseConfigScreen />;
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <YStack style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Spinner size="large" />
        </YStack>
      </SafeAreaView>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return <ConnectBankScreen />;
}
