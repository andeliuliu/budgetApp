import { SafeAreaView } from 'react-native-safe-area-context';
import { H1, Paragraph, SizableText, YStack } from 'tamagui';

import { supabaseConfig } from '@/lib/supabase';
import { brand } from '@/theme/colors';

export function MissingSupabaseConfigScreen() {
  const missing = supabaseConfig.status === 'missing' ? supabaseConfig.missing.join(', ') : '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <YStack style={{ flex: 1, justifyContent: 'center', padding: 20, gap: 16 }}>
        <SizableText size="$3" color={brand.accent} fontWeight="700">
          budgetApp setup
        </SizableText>
        <H1>Supabase config missing</H1>
        <Paragraph theme="alt2">
          Expo did not receive the public Supabase environment variables needed for login.
        </Paragraph>
        <Paragraph>
          Add {missing} to the mobile Expo environment, then restart Expo with a cleared cache.
        </Paragraph>
      </YStack>
    </SafeAreaView>
  );
}
