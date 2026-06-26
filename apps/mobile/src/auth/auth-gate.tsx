import { SafeAreaView } from 'react-native-safe-area-context';
import { Spinner, YStack } from 'tamagui';

import { Home } from '@/home';
import { AuthScreen } from './auth-screen';
import { useAuth } from './auth-provider';

export function AuthGate() {
  const { loading, session } = useAuth();

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

  return <Home />;
}
