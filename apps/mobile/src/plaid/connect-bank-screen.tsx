import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, H1, Paragraph, SizableText, Spinner, XStack, YStack } from 'tamagui';

import { useAuth } from '@/auth/auth-provider';
import { api } from '@/lib/api';
import { brand } from '@/theme/colors';

export function ConnectBankScreen({ onConnected }: { onConnected?: () => void }) {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function connect() {
    setBusy(true);
    setMessage(null);
    try {
      // 1. get a Hosted Link token from our API
      const link = await api<{ link_token: string; hosted_link_url?: string }>(
        '/plaid/link-token',
        { method: 'POST' },
      );
      if (!link.hosted_link_url) throw new Error('No hosted link URL returned');

      // 2. open Plaid's hosted bank picker + login in a browser
      await WebBrowser.openBrowserAsync(link.hosted_link_url);

      // 3. when it closes, have the API pull the public token(s) and exchange
      const { itemIds } = await api<{ itemIds: string[] }>('/plaid/link/complete', {
        method: 'POST',
        body: { linkToken: link.link_token },
      });

      setMessage(
        itemIds.length
          ? `Connected ${itemIds.length} bank login(s) — syncing transactions…`
          : 'No bank was connected. Tap to try again.',
      );
      if (itemIds.length) onConnected?.(); // flips Home -> Transactions
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <YStack style={{ flex: 1, justifyContent: 'center', padding: 20, gap: 20 }}>
        <YStack gap="$2">
          <SizableText size="$3" color={brand.accent} fontWeight="700">
            {user?.email}
          </SizableText>
          <H1>Connect your bank</H1>
          <Paragraph theme="alt2">
            Opens Plaid to securely link Chase, SoFi, and 12,000+ banks. budgetApp never
            sees your bank password.
          </Paragraph>
        </YStack>

        {message ? (
          <Paragraph color={brand.accent} accessibilityLiveRegion="polite">
            {message}
          </Paragraph>
        ) : null}

        <Button
          disabled={busy}
          style={{ backgroundColor: brand.accent }}
          color="#fff"
          onPress={connect}>
          <XStack gap="$2" style={{ alignItems: 'center' }}>
            {busy ? <Spinner color="#fff" /> : null}
            <SizableText color="#fff" fontWeight="700">
              Connect to bank
            </SizableText>
          </XStack>
        </Button>

        <Button chromeless onPress={signOut}>
          Sign out
        </Button>
      </YStack>
    </SafeAreaView>
  );
}
