import { describe, expect, it } from 'vitest';

import { readSupabaseConfig } from './supabase-config';

describe('readSupabaseConfig', () => {
  it('returns the Supabase config when both public values are present', () => {
    expect(
      readSupabaseConfig({
        EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      }),
    ).toEqual({
      status: 'configured',
      url: 'https://project.supabase.co',
      anonKey: 'anon-key',
    });
  });

  it('reports both missing public values instead of throwing', () => {
    expect(readSupabaseConfig({})).toEqual({
      status: 'missing',
      missing: ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'],
    });
  });
});
