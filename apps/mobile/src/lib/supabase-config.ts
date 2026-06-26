export type SupabaseConfig =
  | {
      status: 'configured';
      url: string;
      anonKey: string;
    }
  | {
      status: 'missing';
      missing: ('EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_ANON_KEY')[];
    };

type PublicEnv = {
  [key: string]: string | undefined;
};

export function readSupabaseConfig(env: PublicEnv = process.env): SupabaseConfig {
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const missing: ('EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_ANON_KEY')[] = [];

  if (!url) missing.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!anonKey) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');

  return url && anonKey
    ? {
        status: 'configured',
        url,
        anonKey,
      }
    : { status: 'missing', missing };
}
