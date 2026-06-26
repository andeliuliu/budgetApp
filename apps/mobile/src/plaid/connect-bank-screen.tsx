import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, H1, Paragraph, SizableText, YStack } from 'tamagui';

import { useAuth } from '@/auth/auth-provider';
import { brand } from '@/theme/colors';

export function ConnectBankScreen() {
  const { user, signOut } = useAuth();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <YStack style={{ flex: 1, justifyContent: 'center', padding: 20, gap: 20 }}>
        <YStack gap="$2">
          <SizableText size="$3" color={brand.accent} fontWeight="700">
            {user?.email}
          </SizableText>
          <H1>Connect your bank</H1>
          <Paragraph theme="alt2">
            Your account is ready. The next step is connecting Plaid so budgetApp can sync your
            accounts and transactions.
          </Paragraph>
        </YStack>

        <Button disabled style={{ backgroundColor: brand.accentSoft }}>
          <SizableText fontWeight="700">Plaid Link coming next</SizableText>
        </Button>

        <Button chromeless onPress={signOut}>
          Sign out
        </Button>
      </YStack>
    </SafeAreaView>
  );
}
