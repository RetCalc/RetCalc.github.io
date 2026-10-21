"use client";

/* The optional account (ACCOUNTS_PLAN.md): who's signed in, and the sign-in
   steps the dialog walks through. Signed in, the household, saved scenarios
   and Guide sync to the account (lib/sync/engine.ts); signed out, or with no
   account service set up (no env vars), the site works as it always has and
   this provider stays out of the way: `configured` is false and the header
   shows no Sign in button. */

import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ACCOUNTS_ON, accountClient, settle, signedInUser } from "@/lib/sync/account";
import { startSync, syncNow, type SyncResult } from "@/lib/sync/engine";
import { isSynced } from "@/lib/storage";

export interface Account {
  id: string;
  email: string;
  /** Shown as "Hi, Sam"; null when not given. Display only, never for access. */
  firstName: string | null;
  /** Whether we've asked for a first name yet (asked once, after the first sign-in). */
  askedName: boolean;
  /** A suggestion for the name step (Google's first name). */
  suggestedName: string | null;
}

/** Where the sign-in dialog is: closed, choosing a way in, waiting for the
    code, or asking for a first name after the first sign-in. */
export type SignInStep = { at: "closed" } | { at: "start" } | { at: "code"; email: string } | { at: "name" };

interface AccountState {
  /** Accounts are set up on this deployment. */
  configured: boolean;
  /** The session has been read (false only for a moment on load). */
  ready: boolean;
  account: Account | null;
  /** How the last sync went, for the account menu. */
  sync: "idle" | "ok" | "offline";
  step: SignInStep;
  setStep: (s: SignInStep) => void;
  sendCode: (email: string) => Promise<string | null>;
  verifyCode: (email: string, code: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  setFirstName: (name: string | null) => Promise<string | null>;
  /** Saves the latest changes to the account, signs out, and removes the
      synced items from this browser. Returns false if the final save
      failed and `force` wasn't set (nothing has changed yet). */
  signOut: (force?: boolean) => Promise<boolean>;
  client: SupabaseClient | null;
}

const AccountContext = createContext<AccountState | null>(null);

export function useAccount(): AccountState {
  const ctx = use(AccountContext);
  if (!ctx) throw new Error("useAccount needs an AccountProvider above it");
  return ctx;
}

function toAccount(u: User): Account {
  const m = (u.user_metadata ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const google = str(m.given_name) ?? str(m.full_name)?.split(/\s+/)[0] ?? str(m.name)?.split(/\s+/)[0] ?? null;
  return {
    id: u.id,
    email: u.email ?? "",
    firstName: str(m.first_name),
    askedName: m.first_name !== undefined || m.name_asked === true,
    suggestedName: google,
  };
}

/** Plain-language versions of Supabase's sign-in errors. */
function friendly(e: { message?: string; status?: number } | null): string | null {
  if (!e) return null;
  const m = e.message ?? "";
  if (/expired|invalid/i.test(m) && /otp|token|code/i.test(m)) return "That code didn't work. Check it, or send a new one.";
  if (/rate limit|too many|security purposes/i.test(m)) return "Too many tries. Wait a minute, then try again.";
  if (/email/i.test(m) && /invalid/i.test(m)) return "That doesn't look like an email address.";
  if (m === "timeout") return "The account service is taking too long to answer. Check your connection, then try again.";
  if (e.status === 0 || /fetch|network/i.test(m)) return "Couldn't reach the account service. Check your connection.";
  return "Something went wrong. Try again in a moment.";
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  // The client exists only in the browser, made after the page loads, so
  // the server's render and the browser's first render match.
  const [client, setClient] = useState<SupabaseClient | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the browser-only client, once mounted
    setClient(accountClient());
  }, []);
  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [sync, setSync] = useState<AccountState["sync"]>("idle");
  const [step, setStep] = useState<SignInStep>({ at: "closed" });
  const stopSync = useRef<(() => void) | null>(null);

  // The session, now and as it changes (sign in, sign out, token refresh,
  // and Google's return to the page).
  useEffect(() => {
    if (!ACCOUNTS_ON) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- nothing to read without an account service
      setReady(true);
      return;
    }
    if (!client) return;
    let live = true;
    const apply = (u: User | null) => {
      if (!live) return;
      setAccount(u ? toAccount(u) : null);
      setReady(true);
    };
    // Offline, or with the account service down, who's signed in can't be
    // checked: the session this browser holds still stands, so the account
    // menu stays and says sync is unavailable instead of signing you out.
    signedInUser(client).then(apply, async () => {
      setSync("offline");
      const { data: s } = await client.auth.getSession();
      apply(s.session?.user ?? null);
    });
    const { data } = client.auth.onAuthStateChange((_e, session) => apply(session?.user ?? null));
    return () => { live = false; data.subscription.unsubscribe(); };
  }, [client]);

  // Signed in: sync now, then keep syncing. Signed out: stop.
  const userId = account?.id;
  useEffect(() => {
    if (!client || !userId) return;
    stopSync.current = startSync(client, (r: SyncResult) => setSync(r.ok ? "ok" : "offline"));
    return () => { stopSync.current?.(); stopSync.current = null; };
  }, [client, userId]);

  // After the first sign-in (code or Google), ask once for a first name.
  const askedName = account?.askedName;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the name step follows the first sign-in
    if (userId && askedName === false) setStep((s) => (s.at === "name" ? s : { at: "name" }));
  }, [userId, askedName]);

  const sendCode = useCallback(async (email: string) => {
    if (!client) return "Accounts aren't available right now.";
    const { error } = await settle(client.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } }));
    if (error) return friendly(error);
    setStep({ at: "code", email: email.trim() });
    return null;
  }, [client]);

  const verifyCode = useCallback(async (email: string, code: string) => {
    if (!client) return "Accounts aren't available right now.";
    const { error } = await settle(client.auth.verifyOtp({ email, token: code.replace(/\D/g, ""), type: "email" }));
    if (error) return friendly(error);
    setStep({ at: "closed" });
    return null;
  }, [client]);

  const signInWithGoogle = useCallback(async () => {
    if (!client) return "Accounts aren't available right now.";
    const back = window.location.origin + window.location.pathname;
    const { error } = await settle(client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: back } }));
    return friendly(error);
  }, [client]);

  const setFirstName = useCallback(async (name: string | null) => {
    if (!client) return null;
    const first = name?.trim().split(/\s+/)[0]?.slice(0, 40) || null;
    const { data, error } = await settle(client.auth.updateUser({ data: { first_name: first, name_asked: true } }));
    if (error) return friendly(error);
    if (data?.user) setAccount(toAccount(data.user));
    setStep({ at: "closed" });
    return null;
  }, [client]);

  const signOut = useCallback(async (force = false) => {
    if (!client) return true;
    // Everything changed here goes to the account first, since this
    // browser's copy is about to be removed.
    const last = await syncNow(client);
    if (!last.ok && !force) return false;
    stopSync.current?.();
    stopSync.current = null;
    await client.auth.signOut({ scope: "local" });
    setAccount(null);
    setSync("idle");
    // Signed out, the household, saved scenarios and Guide live only in the
    // account: take them out of this browser, then start the page fresh.
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        const m = k?.startsWith("retcalc.") ? /^retcalc\.(.+)\.v\d+$/.exec(k) : null;
        if (k && (k === "retcalc.sync-stamps.v1" || k === "retcalc.sync-base.v1" || k === "retcalc.household-applied.v1" || (m && isSynced(m[1])))) localStorage.removeItem(k);
      }
    } catch { /* storage blocked: nothing was kept anyway */ }
    window.location.reload();
    return true;
  }, [client]);

  const value = useMemo<AccountState>(() => ({
    configured: ACCOUNTS_ON, ready, account, sync, step, setStep, sendCode, verifyCode, signInWithGoogle, setFirstName, signOut, client,
  }), [client, ready, account, sync, step, sendCode, verifyCode, signInWithGoogle, setFirstName, signOut]);

  return <AccountContext value={value}>{children}</AccountContext>;
}
