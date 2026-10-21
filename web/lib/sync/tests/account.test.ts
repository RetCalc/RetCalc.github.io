/* Telling "signed out" from "couldn't ask" (lib/sync/account.ts): offline,
   Supabase answers getUser() with no user and a network error, which must
   never pass for signed out. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { AuthRetryableFetchError, AuthSessionMissingError, type SupabaseClient } from "@supabase/supabase-js";
import { push, settle, signedInUser } from "../account";

const client = (user: { id: string } | null, error: Error | null) =>
  ({ auth: { getUser: async () => ({ data: { user }, error }) } }) as unknown as SupabaseClient;

test("a signed-in user is returned", async () => {
  assert.deepEqual(await signedInUser(client({ id: "u1" }, null)), { id: "u1" });
});

test("no session is signed out", async () => {
  assert.equal(await signedInUser(client(null, new AuthSessionMissingError())), null);
});

test("offline is an error, not signed out", async () => {
  await assert.rejects(signedInUser(client(null, new AuthRetryableFetchError("Failed to fetch", 0))));
});

test("an offline push throws, so the change isn't marked as agreed", async () => {
  await assert.rejects(push(client(null, new AuthRetryableFetchError("Failed to fetch", 0)), "household", 1, { age: 40 }));
});

test("a push with nobody signed in saves nothing and says so", async () => {
  assert.equal(await push(client(null, new AuthSessionMissingError()), "household", 1, { age: 40 }), false);
});

test("a call that never answers gives up with a timeout", async () => {
  const r = await settle(new Promise<{ error: null }>(() => {}), 20);
  assert.deepEqual(r.error, { message: "timeout", status: 0 });
});

test("a call that throws becomes an error", async () => {
  const r = await settle(Promise.reject(new Error("Failed to fetch")));
  assert.equal(r.error?.message, "Failed to fetch");
});
