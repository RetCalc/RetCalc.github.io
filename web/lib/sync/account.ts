/* The account side of sync: Supabase, from the browser only (no proxy.ts;
   every page stays static and the database's row-level security decides
   what each person can reach). Configured by two public env vars; without
   them there is no account service and the site works exactly as before.
   ACCOUNTS_PLAN.md, supabase/migrations. */
import type { SupabaseClient, User } from "@supabase/supabase-js";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let loading: Promise<SupabaseClient | null> | undefined;

/** Whether accounts are set up on this build (the env vars were set). The
    same on the server and in the browser, so pages render alike in both. */
export const ACCOUNTS_ON = !!(URL_ && KEY);

/** The Supabase client, or null when accounts aren't set up (no env vars)
    or outside a browser. Supabase's code is fetched on first use, not with
    every page: most visits never sign in. */
export function loadAccountClient(): Promise<SupabaseClient | null> {
  if (typeof window === "undefined" || !URL_ || !KEY) return Promise.resolve(null);
  loading ??= import("@supabase/supabase-js").then(
    // PKCE: Google sends back ?code=..., never tokens in the address's
    // #fragment, which the site's share links (#s=..., #g=...) use.
    ({ createClient }) => createClient(URL_, KEY, { auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } }),
    () => { loading = undefined; return null; }, // offline: try again next time
  );
  return loading;
}

/** Supabase's saved session in this browser (sb-<project>-auth-token). */
export const isSessionKey = (k: string) => /^sb-.+-auth-token$/.test(k);

/** Whether this page might have someone signed in, so the client is needed
    now: a saved session, or Google sending someone back (?code=...). */
export function maySignIn(): boolean {
  const q = new URLSearchParams(window.location.search);
  if (q.has("code") || q.has("error_description")) return true;
  try {
    for (let i = 0; i < localStorage.length; i++) if (isSessionKey(localStorage.key(i) ?? "")) return true;
  } catch { /* storage blocked: no session could have been kept */ }
  return false;
}

/** Who's signed in, checked with the account service; null when nobody
    is. Throws when the service can't be reached (offline, or down), so a
    sync never mistakes "couldn't ask" for "signed out". */
export async function signedInUser(c: SupabaseClient): Promise<User | null> {
  const { data, error } = await c.auth.getUser();
  if (data.user) return data.user;
  // No session (the check supabase's isAuthSessionMissingError makes, by
  // name, so this file needs no more of supabase than createClient), or one
  // the service turned down (4xx): signed out. Anything else: couldn't ask.
  const missing = (error as { name?: string } | null)?.name === "AuthSessionMissingError";
  if (error && !missing && !(error.status && error.status >= 400 && error.status < 500)) throw error;
  return null;
}

/** An account-service call's answer, or an error in its place when the
    request fails outright or takes longer than `ms`: on a slow or dropped
    connection a sign-in step says so instead of waiting for ever. */
export async function settle<T extends { error: unknown }>(call: Promise<T>, ms = 20_000): Promise<T | { data: null; error: { message: string; status: number } }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<{ data: null; error: { message: string; status: number } }>((res) => {
    timer = setTimeout(() => res({ data: null, error: { message: "timeout", status: 0 } }), ms);
  });
  try {
    return await Promise.race([call, late]);
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : String(e), status: 0 } };
  } finally {
    clearTimeout(timer);
  }
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
    column's default and the insert policy). False when nobody is signed in,
    so nothing was saved; throws when the account can't be reached. */
export async function push(c: SupabaseClient, key: string, version: number, value: unknown): Promise<boolean> {
  if (value == null) {
    // Clearing one storage version (say, an old Guide format) removes only
    // that version's row, never a newer one under the same key.
    const { error } = await c.from("user_data").delete().eq("key", key).eq("version", version);
    if (error) throw error;
    return true;
  }
  const user = await signedInUser(c);
  if (!user) return false;
  const { error } = await c.from("user_data").upsert({ user_id: user.id, key, version, value }, { onConflict: "user_id,key" });
  if (error) throw error;
  return true;
}
