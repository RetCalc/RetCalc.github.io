/* The account side of sync: Supabase, from the browser only (no proxy.ts;
   every page stays static and the database's row-level security decides
   what each person can reach). Configured by two public env vars; without
   them there is no account service and the site works exactly as before.
   ACCOUNTS_PLAN.md, supabase/migrations. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | null | undefined;

/** Whether accounts are set up on this build (the env vars were set). The
    same on the server and in the browser, so pages render alike in both. */
export const ACCOUNTS_ON = !!(URL_ && KEY);

/** The Supabase client, or null when accounts aren't set up (no env vars)
    or outside a browser. */
export function accountClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  // PKCE: Google sends back ?code=..., never tokens in the address's
  // #fragment, which the site's share links (#s=..., #g=...) use.
  client = typeof window !== "undefined" && URL_ && KEY
    ? createClient(URL_, KEY, { auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } })
    : null;
  return client;
}

/** A row of public.user_data as the browser sees it. */
export interface AccountItem { key: string; version: number; value: unknown; at: number }

/** Everything this person's account holds. */
export async function pullAll(c: SupabaseClient): Promise<AccountItem[]> {
  const { data, error } = await c.from("user_data").select("key, version, value, updated_at");
  if (error) throw error;
  return (data ?? []).map((r) => ({ key: r.key, version: r.version, value: r.value, at: Date.parse(r.updated_at) }));
}

/** Saves one item to the account (user_id comes from the session, via the
    column's default and the insert policy). */
export async function push(c: SupabaseClient, key: string, version: number, value: unknown): Promise<void> {
  if (value == null) {
    // Clearing one storage version (say, an old Guide format) removes only
    // that version's row, never a newer one under the same key.
    const { error } = await c.from("user_data").delete().eq("key", key).eq("version", version);
    if (error) throw error;
    return;
  }
  const { data: u } = await c.auth.getUser();
  if (!u.user) return;
  const { error } = await c.from("user_data").upsert({ user_id: u.user.id, key, version, value }, { onConflict: "user_id,key" });
  if (error) throw error;
}
