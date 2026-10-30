"use client";

/* The monthly check-in email's switch: public.email_prefs, read and written
   straight from the browser (the table's row-level security lets each
   person reach only their own row). Not part of the synced Dashboard JSON,
   so an email's unsubscribe link and this switch never fight over it.
   supabase/CHECKIN_EMAIL.md.

   One copy per page, shared by Profile's switch, Next steps and the account
   page, read once per signed-in person. */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAccount } from "./AccountProvider";
import { settle } from "@/lib/sync/account";

/** loading: not read yet; none: never chosen (on, once the Dashboard is set
    up); on; off: switched off, here or from an email; error: the account
    couldn't be reached. */
export type Checkin = "loading" | "none" | "on" | "off" | "error";

type State = { uid: string | null; v: Checkin };
const SERVER: State = { uid: null, v: "loading" };
let state: State = SERVER;
const listeners = new Set<() => void>();
const put = (next: State) => { state = next; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

async function load(c: SupabaseClient, uid: string) {
  const r = await settle(Promise.resolve(c.from("email_prefs").select("checkin").eq("user_id", uid).maybeSingle()));
  if (state.uid !== uid) return; // signed out, or someone else signed in, meanwhile
  const row = r.data as { checkin: boolean } | null;
  put({ uid, v: r.error ? "error" : row == null ? "none" : row.checkin ? "on" : "off" });
}

export function useCheckin(): { state: Checkin; set: (on: boolean) => Promise<boolean> } {
  const { client, account } = useAccount();
  const uid = account?.id ?? null;
  const snap = useSyncExternalStore(subscribe, () => state, () => SERVER);
  useEffect(() => {
    if (!client || !uid || state.uid === uid) return;
    put({ uid, v: "loading" });
    void load(client, uid);
  }, [client, uid]);

  /** Switches it on or off; false (and back as it was) if it couldn't be saved. */
  const set = useCallback(async (on: boolean) => {
    if (!client || !uid) return false;
    const before = state.uid === uid ? state.v : "none";
    put({ uid, v: on ? "on" : "off" });
    const r = await settle(Promise.resolve(client.from("email_prefs").upsert({ user_id: uid, checkin: on }, { onConflict: "user_id" })));
    if (r.error) { if (state.uid === uid) put({ uid, v: before }); return false; }
    return true;
  }, [client, uid]);

  return { state: uid && snap.uid === uid ? snap.v : "loading", set };
}
