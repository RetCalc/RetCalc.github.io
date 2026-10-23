/* What the site keeps in this browser. Every key carries a version, so a
   change to what's stored under it gets a new key instead of misreading old
   data. Reads and writes never throw: private windows and blocked storage
   just mean nothing is remembered. Client components only. */

const PREFIX = "retcalc.";

export function readStored<T>(key: string, version: number): T | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}${key}.v${version}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeStored(key: string, version: number, value: unknown): void {
  try {
    const k = `${PREFIX}${key}.v${version}`;
    if (value == null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(value));
    if (isSynced(key)) {
      stampWrite(key, version);
      for (const l of listeners) l(key, version, value ?? null);
    }
  } catch {
    /* not remembered; the page still works */
  }
}

/* What lasts for one tab's visit (a reload keeps it; a closed tab or a new
   one doesn't): the tools' inputs, so a refresh doesn't empty them. Never
   synced to an account. */
export function readSession<T>(key: string, version: number): T | null {
  try {
    const raw = sessionStorage.getItem(`${PREFIX}${key}.v${version}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeSession(key: string, version: number, value: unknown): void {
  try {
    sessionStorage.setItem(`${PREFIX}${key}.v${version}`, JSON.stringify(value));
  } catch {
    /* not remembered; the page still works */
  }
}

/* ---------- account sync (lib/sync, ACCOUNTS_PLAN.md) ----------
   The items a signed-in person's account keeps a copy of. Everything else
   (theme, which tools took the household in, small per-device choices)
   stays on this device. Signed out, or with no account service set up,
   nothing below does anything visible: writes go to this browser alone. */

/** The keys synced to an account: the household, the Guide, Paycheck to
    Retirement, saved scenarios, the Dashboard. */
export function isSynced(key: string): boolean {
  return key === "household" || key === "guide" || key === "paycheck-plan" || key === "dashboard" || key.startsWith("scenarios-");
}

type WriteListener = (key: string, version: number, value: unknown) => void;
const listeners = new Set<WriteListener>();

/** Hears every write of a synced key (the sync engine pushes it to the
    account). Returns the way to stop listening. */
export function onSyncedWrite(l: WriteListener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/* When each synced item was last written here, so a merge can tell which
   side is newer: {"household.v1": 1760300000000}. */
const STAMPS = `${PREFIX}sync-stamps.v1`;

function stampWrite(key: string, version: number): void {
  const all = readStamps();
  all[`${key}.v${version}`] = Date.now();
  localStorage.setItem(STAMPS, JSON.stringify(all));
}

function readStamps(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STAMPS) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

/** A synced item as stored here: its value and when it was written (0 if
    it predates sync). */
export interface LocalItem { key: string; version: number; value: unknown; at: number }

/** Every synced item in this browser. */
export function localSyncedItems(): LocalItem[] {
  const out: LocalItem[] = [], stamps = readStamps();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const m = k?.startsWith(PREFIX) ? /^(.+)\.v(\d+)$/.exec(k.slice(PREFIX.length)) : null;
      if (!m || !isSynced(m[1])) continue;
      out.push({ key: m[1], version: Number(m[2]), value: JSON.parse(localStorage.getItem(k!)!), at: stamps[`${m[1]}.v${m[2]}`] ?? 0 });
    }
  } catch {
    /* storage blocked: nothing to sync */
  }
  return out;
}

/* What each synced item looked like the last time this browser and the
   account agreed on it (a fingerprint, lib/sync/merge.ts). It's how a merge
   tells "deleted here" from "never had it": whichever side moved away from
   this agreed version is the one that changed. */
const BASES = `${PREFIX}sync-base.v1`;

export function readBase(key: string): string | null {
  try {
    return (JSON.parse(localStorage.getItem(BASES) ?? "{}") as Record<string, string>)[key] ?? null;
  } catch {
    return null;
  }
}

export function writeBase(key: string, fingerprint: string): void {
  try {
    const all = JSON.parse(localStorage.getItem(BASES) ?? "{}") as Record<string, string>;
    all[key] = fingerprint;
    localStorage.setItem(BASES, JSON.stringify(all));
  } catch {
    /* not remembered: the next sync merges both ways instead */
  }
}

/** Writes an item that came from the account, without echoing it back. */
export function writeFromAccount(key: string, version: number, value: unknown, at: number): void {
  try {
    localStorage.setItem(`${PREFIX}${key}.v${version}`, JSON.stringify(value));
    const all = readStamps();
    all[`${key}.v${version}`] = at;
    localStorage.setItem(STAMPS, JSON.stringify(all));
  } catch {
    /* not remembered here; the account still has it */
  }
}
