import { supabase } from './supabase';

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3333';

export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });

  if (!res.ok) throw new Error(`${opts.method ?? 'GET'} ${path} -> ${res.status}`);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
