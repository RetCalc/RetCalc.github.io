/* A whole sync against a stand-in account: Dashboard profiles added on one
   device reach the other, and a profile deleted on one isn't sent back by
   a device that still has it. */
import { test } from "node:test";
import assert from "node:assert/strict";

const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  },
  window: { dispatchEvent: () => true },
  CustomEvent: class { type: string; constructor(type: string) { this.type = type; } },
});

const { syncNow } = await import("../engine");
const { PROFILES_KEY } = await import("../merge");

type Row = { key: string; version: number; value: unknown; updated_at: string };
function account(rows: Row[]) {
  const c = {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) },
    from: () => ({
      select: async () => ({ data: rows, error: null }),
      delete: () => ({ eq: (_: string, key: string) => ({ eq: async (__: string, version: number) => {
        for (let i = rows.length - 1; i >= 0; i--) if (rows[i].key === key && rows[i].version === version) rows.splice(i, 1);
        return { error: null };
      } }) }),
      upsert: async (r: { key: string; version: number; value: unknown }) => {
        const at = rows.findIndex((x) => x.key === r.key);
        const row = { key: r.key, version: r.version, value: r.value, updated_at: new Date().toISOString() };
        if (at >= 0) rows[at] = row; else rows.push(row);
        return { error: null };
      },
    }),
  };
  return c as never;
}
const here = (key: string) => { const v = store.get(`retcalc.${key}.v1`); return v ? JSON.parse(v) : null; };
const keep = (key: string, value: unknown) => store.set(`retcalc.${key}.v1`, JSON.stringify(value));

test("a profile deleted on another device is deleted here too, not sent back", async () => {
  store.clear();
  keep("dashboard", { done: true });
  keep("dashboard-p-solo", { done: true });
  keep(PROFILES_KEY, { list: [{ id: "main", name: "Joint" }, { id: "solo", name: "Solo" }], gone: [] });
  const rows: Row[] = [
    { key: "dashboard", version: 1, value: { done: true }, updated_at: "2026-11-11T00:00:00Z" },
    { key: PROFILES_KEY, version: 1, value: { list: [{ id: "main", name: "Joint" }], gone: ["solo"] }, updated_at: "2026-11-11T00:00:00Z" },
  ];
  const r = await syncNow(account(rows));
  assert.equal(r.ok, true);
  assert.equal(here("dashboard-p-solo"), null);
  assert.ok(!rows.some((x) => x.key === "dashboard-p-solo"));
  assert.deepEqual(here(PROFILES_KEY).gone, ["solo"]);
  assert.deepEqual(here(PROFILES_KEY).list.map((p: { id: string }) => p.id), ["main"]);
  assert.deepEqual(here("dashboard"), { done: true });
});

test("a profile added on another device arrives here, and one added here goes up", async () => {
  store.clear();
  keep("dashboard", { done: true });
  keep("dashboard-p-here", { done: false });
  keep(PROFILES_KEY, { list: [{ id: "main", name: "" }, { id: "here", name: "Demo" }], gone: [] });
  const rows: Row[] = [
    { key: "dashboard", version: 1, value: { done: true }, updated_at: "2026-11-11T00:00:00Z" },
    { key: "dashboard-p-there", version: 1, value: { done: true }, updated_at: "2026-11-11T00:00:00Z" },
    { key: PROFILES_KEY, version: 1, value: { list: [{ id: "main", name: "" }, { id: "there", name: "Solo" }], gone: [] }, updated_at: "2026-11-11T00:00:00Z" },
  ];
  await syncNow(account(rows));
  assert.deepEqual(here("dashboard-p-there"), { done: true });
  assert.ok(rows.some((x) => x.key === "dashboard-p-here"));
  assert.deepEqual(here(PROFILES_KEY).list.map((p: { id: string }) => p.id), ["main", "here", "there"]);
  const up = rows.find((x) => x.key === PROFILES_KEY)!.value as { list: { id: string }[] };
  assert.deepEqual(up.list.map((p) => p.id), ["main", "here", "there"]);
});
