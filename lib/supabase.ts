import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export class SetupError extends Error {}

let client: SupabaseClient | null = null;

function init(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new SetupError("SUPABASE_ENV_MISSING");
  }
  client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export function isConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * サーバー専用クライアント。テーブルは全て RLS 有効・公開ポリシー無しなので、
 * DB へのアクセスは必ずこのクライアント（= サーバー側）を経由する。
 * 環境変数が未設定でも import 時には落とさず、実際に使った時に SetupError を投げる。
 */
export const db = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(init(), prop, receiver);
  },
});
