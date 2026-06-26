import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

import { readSupabaseConfig } from './supabase-config';

export const supabaseConfig = readSupabaseConfig();

export const supabase: SupabaseClient | null =
  supabaseConfig.status === 'configured'
    ? createClient(supabaseConfig.url, supabaseConfig.anonKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;
