/* Keeps a signed-in person's synced items (household, Guide, saved
   scenarios) the same in this browser and their account. This browser is
   always written first, so saving never waits on the network and keeps
   working offline or while the account service is down.

   - syncNow(): on sign-in and when the tab comes back into focus, merges
     every item both ways (merge.ts) and writes whichever side needs it.
   - startSync(): pushes each local write to the account shortly after it
     happens, and runs syncNow() on focus. Returns the way to stop.

   Nothing calls these yet: the sign-in UI does (ACCOUNTS_PLAN.md, step 3). */
import type { SupabaseClient } from "@supabase/supabase-js";
import { localSyncedItems, onSyncedWrite, readBase, readStored, writeBase, writeFromAccount } from "@/lib/storage";
import { pullAll, push, signedInUser } from "./account";
import { fingerprint, mergeItem, mergeScenarios, type Copy, type Scenario } from "./merge";

/** Sent on window when items arrive from the account; detail: their keys. */
export const SYNCED_EVENT = "retcalc:synced";

/** What a sync did, for a status line ("Synced", "Couldn't reach your account"). */
export interface SyncResult { ok: boolean; pulled: number; pushed: number; error?: string }

/** The newest storage version of each key, from a list holding several. */
function newest<T extends { key: string; version: number }>(items: T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const it of items) {
    const had = m.get(it.key);
    if (!had || it.version > had.version) m.set(it.key, it);
  }
  return m;
}

export async function syncNow(c: SupabaseClient): Promise<SyncResult> {
  try {
    // Offline, this throws: the sync reports it, rather than "nothing to do".
    if (!(await signedInUser(c))) return { ok: true, pulled: 0, pushed: 0 };
    const local = newest(localSyncedItems()), account = newest(await pullAll(c));
    let pulled = 0, pushed = 0;
    const changed: string[] = [];
    // Copies a merge set aside rather than lose, by the tool whose list they join.
    const kept: Record<string, Scenario[]> = {};
    for (const key of new Set([...local.keys(), ...account.keys()])) {
      const l = local.get(key), a = account.get(key);
      const m = mergeItem(key, l ? (l as Copy) : null, a ? (a as Copy) : null, readBase(key));
      if (!m) continue;
      if (m.toLocal) { writeFromAccount(key, m.version, m.value, Date.now()); pulled++; changed.push(key); }
      if (m.toAccount) { await push(c, key, m.version, m.value); pushed++; }
      if (m.keep) (kept[key] ??= []).push(m.keep);
      // Both sides now hold this: the version to measure the next changes from.
      writeBase(key, fingerprint(m.value));
    }
    // The Guide a merge didn't keep as the Guide is a saved plan now, in this
    // browser and the account (the same list the toolbar's Save writes).
    for (const [tool, extra] of Object.entries(kept)) {
      const key = `scenarios-${tool}`, version = 1, have = readStored<Scenario[]>(key, version) ?? [];
      const value = mergeScenarios(extra, have);
      writeFromAccount(key, version, value, Date.now());
      await push(c, key, version, value);
      writeBase(key, fingerprint(value));
      pushed++;
      if (!changed.includes(key)) changed.push(key);
    }
    // Whatever shows a changed item re-reads it (the household, the open
    // tool's saved scenarios, the Guide).
    if (changed.length) window.dispatchEvent(new CustomEvent(SYNCED_EVENT, { detail: changed }));
    return { ok: true, pulled, pushed };
  } catch (e) {
    return { ok: false, pulled: 0, pushed: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

export function startSync(c: SupabaseClient, onResult?: (r: SyncResult) => void): () => void {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const stopWrites = onSyncedWrite((key, version, value) => {
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => {
      timers.delete(key);
      push(c, key, version, value).then(
        (saved) => {
          // Only what reached the account is the agreed version: marking an
          // unsaved change as agreed would let the account's older copy
          // win the next merge.
          if (saved && value != null) writeBase(key, fingerprint(value));
          onResult?.({ ok: true, pulled: 0, pushed: saved ? 1 : 0 });
        },
        (e) => onResult?.({ ok: false, pulled: 0, pushed: 0, error: String(e) }),
      );
    }, 800));
  });
  const onFocus = () => { if (document.visibilityState === "visible") void syncNow(c).then(onResult); };
  document.addEventListener("visibilitychange", onFocus);
  void syncNow(c).then(onResult);
  return () => {
    stopWrites();
    document.removeEventListener("visibilitychange", onFocus);
    timers.forEach(clearTimeout);
  };
}
