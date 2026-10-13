/* How a synced item from this browser and the account's copy combine, on
   signing in and when the account has something newer (ACCOUNTS_PLAN.md,
   "How syncing works"). Pure functions, tested in tests/merge.test.ts.
   A merge never throws anything away: when both sides changed a saved
   scenario of the same name, both are kept. */

/** One side's copy: the stored value, its storage version, and when it was
    written (ms; 0 when unknown). */
export interface Copy { version: number; value: unknown; at: number }

export interface Merged {
  version: number;
  value: unknown;
  /** This browser needs the merged value. */
  toLocal: boolean;
  /** The account needs the merged value. */
  toAccount: boolean;
}

interface Scenario { name: string; data: unknown }

/** The same value, whatever order its fields are in. The database (jsonb)
    stores objects with its own key order, so text comparison would call an
    unchanged scenario "different" after a round trip. */
function canon(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(Object.keys(o).sort().map((k) => [k, canon(o[k])]));
  }
  return v;
}
export const same = (a: unknown, b: unknown) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

/** A short fingerprint of a value, whatever its key order: what this
    browser remembers about the last version both sides agreed on. */
export function fingerprint(v: unknown): string {
  const s = JSON.stringify(canon(v)) ?? "";
  let h1 = 0x811c9dc5, h2 = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = (Math.imul(h2, 31) + c) >>> 0;
  }
  return s.length.toString(36) + "." + h1.toString(36) + "." + h2.toString(36);
}

/** A name with any number of " (from this device)" / " (from this device 2)"
    suffixes, back to the name it was copied from. */
const SUFFIX = / \(from this device(?: \d+)?\)$/;
function baseName(name: string): string {
  let n = name;
  while (SUFFIX.test(n)) n = n.replace(SUFFIX, "");
  return n;
}

/** Drops copies made by a merge that turned out identical to the scenario
    they were copied from (same base name, same inputs). Cleans up after an
    earlier version that copied unchanged scenarios on every sync. */
export function dropTwinCopies(list: Scenario[]): Scenario[] {
  const out: Scenario[] = [];
  for (const s of list) {
    const base = baseName(s.name);
    if (base !== s.name && list.some((o) => o !== s && baseName(o.name) === base && o.name.length < s.name.length && same(o.data, s.data))) continue;
    out.push(s);
  }
  return out;
}

/** The household carries its own save time (savedAt), the truest "newer". */
function savedAt(v: unknown, fallback: number): number {
  const t = (v as { savedAt?: unknown } | null)?.savedAt;
  return typeof t === "number" && isFinite(t) ? t : fallback;
}

/** Saved scenarios: every name from both sides. Same name, same inputs: one.
    Same name, different inputs: the account's keeps the name and this
    browser's is kept beside it as "<name> (from this device)". */
export function mergeScenarios(local: Scenario[], account: Scenario[]): Scenario[] {
  const out = dropTwinCopies(account).map((s) => ({ ...s }));
  const names = new Set(out.map((s) => s.name));
  for (const s of dropTwinCopies(local)) {
    const twin = out.find((a) => a.name === s.name);
    if (twin && same(twin.data, s.data)) continue;
    // Already in the account under its own name (an earlier merge's copy).
    if (!twin && out.some((a) => baseName(a.name) === baseName(s.name) && same(a.data, s.data))) continue;
    if (!twin) {
      out.push({ ...s });
      names.add(s.name);
      continue;
    }
    let name = `${s.name} (from this device)`, n = 2;
    while (names.has(name)) name = `${s.name} (from this device ${n++})`;
    out.push({ name, data: s.data });
    names.add(name);
  }
  return out;
}

/** One side wins outright. A saved-scenario list also sheds copies an
    earlier version made, which may mean both sides need the cleaned list. */
function take(key: string, win: Copy, from: "local" | "account"): Merged {
  if (key.startsWith("scenarios-") && Array.isArray(win.value)) {
    const value = dropTwinCopies(win.value as Scenario[]);
    if (value.length !== (win.value as Scenario[]).length) return { version: win.version, value, toLocal: true, toAccount: true };
  }
  return { version: win.version, value: win.value, toLocal: from === "account", toAccount: from === "local" };
}

/** Combines this browser's copy of `key` with the account's. `base` is the
    fingerprint of the version both last agreed on (null on a first sign-in,
    or for an item this browser never synced). If only one side moved away
    from it, that side wins outright, so a deletion or an edit made on one
    device carries over to the others. Only when both changed, or there's no
    base, do the rules below combine the two. */
export function mergeItem(key: string, local: Copy | null, account: Copy | null, base: string | null = null): Merged | null {
  if (local && account && local.version === account.version && base) {
    const l = fingerprint(local.value), a = fingerprint(account.value);
    if (l === a) return take(key, account, "account").toAccount ? take(key, account, "account") : { version: local.version, value: local.value, toLocal: false, toAccount: false };
    if (l === base) return take(key, account, "account");
    if (a === base) return take(key, local, "local");
  }
  if (!local && !account) return null;
  if (!account) return { version: local!.version, value: local!.value, toLocal: false, toAccount: true };
  if (!local) return { version: account.version, value: account.value, toLocal: true, toAccount: false };
  if (local.version === account.version && same(local.value, account.value) && !key.startsWith("scenarios-"))
    return { version: local.version, value: local.value, toLocal: false, toAccount: false };
  // A newer storage format can't be merged with an older one: the newer wins.
  if (local.version !== account.version) {
    const win = local.version > account.version ? local : account;
    return { version: win.version, value: win.value, toLocal: win === account, toAccount: win === local };
  }
  if (key.startsWith("scenarios-")) {
    const value = mergeScenarios(Array.isArray(local.value) ? local.value : [], Array.isArray(account.value) ? account.value : []);
    return { version: local.version, value, toLocal: !same(value, local.value), toAccount: !same(value, account.value) };
  }
  const l = key === "household" ? savedAt(local.value, local.at) : local.at;
  const a = key === "household" ? savedAt(account.value, account.at) : account.at;
  return l > a
    ? { version: local.version, value: local.value, toLocal: false, toAccount: true }
    : { version: account.version, value: account.value, toLocal: true, toAccount: false };
}
