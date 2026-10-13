// Deletes the calling user's account and everything synced to it
// (ACCOUNTS_PLAN.md, step 5). Called from the account page with the user's
// own access token; it deletes that user and no one else.
//
// Order matters: deleting a user doesn't end the sessions they already
// have, so every session is signed out first, then the user is deleted.
// Their public.user_data rows go with them (on delete cascade).
//
// The secret key is read here, server-side, from the function's own
// environment (SUPABASE_SECRET_KEYS, its "default" key); it never reaches
// a browser. Deploy: `npx supabase functions deploy delete-account`.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

// Who may call this from a browser: the live site, local development and
// this project's Vercel previews.
const ALLOWED = [/^https:\/\/retcalc\.app$/, /^http:\/\/localhost:3100$/, /^https:\/\/retcalc-[a-z0-9-]+-ret-calc\.vercel\.app$/];

function cors(origin: string | null): Record<string, string> {
  const ok = origin != null && ALLOWED.some((re) => re.test(origin));
  return ok
    ? {
      "Access-Control-Allow-Origin": origin!,
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    }
    : { "Vary": "Origin" };
}

function secretKey(): string | undefined {
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>;
    if (keys.default) return keys.default;
  } catch { /* fall through to the legacy key */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}

Deno.serve(async (req) => {
  const headers = cors(req.headers.get("Origin"));
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply(405, { error: "Use POST." });

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const url = Deno.env.get("SUPABASE_URL"), key = secretKey();
  if (!jwt) return reply(401, { error: "Sign in first." });
  if (!url || !key) return reply(500, { error: "The account service isn't set up." });

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // Who is asking: the token is checked by Supabase Auth, not trusted as sent.
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) return reply(401, { error: "Your session has expired. Sign in again." });

  const signedOut = await admin.auth.admin.signOut(jwt, "global");
  if (signedOut.error) return reply(500, { error: "Couldn't sign out your other devices. Nothing was deleted." });

  const deleted = await admin.auth.admin.deleteUser(data.user.id);
  if (deleted.error) return reply(500, { error: "Couldn't delete the account. Try again in a minute." });

  return reply(200, { deleted: true });
});
