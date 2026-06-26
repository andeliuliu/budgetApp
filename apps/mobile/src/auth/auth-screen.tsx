import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, H1, Input, Paragraph, SizableText, Spinner, XStack, YStack } from 'tamagui';

import { supabase } from '@/lib/supabase';
import { brand } from '@/theme/colors';

type AuthMode = 'sign-in' | 'sign-up';

export function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pendingMode, setPendingMode] = useState<AuthMode | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(mode: AuthMode) {
    setPendingMode(mode);
    setMessage(null);

    const credentials = {
      email: email.trim(),
      password,
    };

    const { data, error } =
      mode === 'sign-up'
        ? await supabase.auth.signUp(credentials)
        : await supabase.auth.signInWithPassword(credentials);

    setPendingMode(null);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (mode === 'sign-up' && !data.session) {
      setMessage('Check your email to confirm your account, then sign in.');
    }
  }

  const disabled = pendingMode != null || email.trim().length === 0 || password.length < 6;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <YStack style={{ flex: 1, justifyContent: 'center', padding: 20, gap: 20 }}>
          <YStack gap="$2">
            <SizableText size="$3" color={brand.accent} fontWeight="700">
              budgetApp
            </SizableText>
            <H1>Create your account</H1>
            <Paragraph theme="alt2">
              Sign up or sign in to connect your bank and start syncing transactions.
            </Paragraph>
          </YStack>

          <YStack gap="$3">
            <Input
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
            />
            <Input
              autoCapitalize="none"
              autoComplete="password"
              placeholder="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </YStack>

          {message ? (
            <Paragraph color={brand.budgetOver} accessibilityLiveRegion="polite">
              {message}
            </Paragraph>
          ) : null}

          <YStack gap="$2">
            <Button
              disabled={disabled}
              style={{ backgroundColor: brand.accent }}
              color="#fff"
              onPress={() => submit('sign-up')}>
              <XStack gap="$2" style={{ alignItems: 'center' }}>
                {pendingMode === 'sign-up' ? <Spinner color="#fff" /> : null}
                <SizableText color="#fff" fontWeight="700">
                  Create account
                </SizableText>
              </XStack>
            </Button>
            <Button disabled={disabled} onPress={() => submit('sign-in')}>
              <XStack gap="$2" style={{ alignItems: 'center' }}>
                {pendingMode === 'sign-in' ? <Spinner /> : null}
                <SizableText fontWeight="700">Sign in</SizableText>
              </XStack>
            </Button>
          </YStack>
        </YStack>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
