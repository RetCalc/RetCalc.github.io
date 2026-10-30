// The monthly check-in email (supabase/CHECKIN_EMAIL.md). Two jobs:
//
// POST /checkin-email                 the daily run, from pg_cron, gated by
//   x-checkin-cron: <CHECKIN_CRON_SECRET>. Sends the check-in to everyone
//   with it on whose balances are 30+ days old (or who has none) and who
//   wasn't sent one in the last 28 days, one at a time within Resend's rate
//   limit, and logs each send. Body (all optional):
//     { "dry_run": true }             count who's due, send nothing
//     { "only": "<user id>" }         just that person (if they're due)
//     { "only": "<user id>", "force": true }   just them, due or not
//
// POST /checkin-email/unsubscribe?t=<token>   switches the email off for the
//   person the signed token names. Called by mail apps' one-click
//   unsubscribe (RFC 8058, List-Unsubscribe-Post) and by the page at
//   retcalc.app/unsubscribe, which the email's footer links to. (Supabase
//   serves no HTML from functions, so the confirmation page lives on the
//   site.) The page may send the token as JSON { "token": ... } instead.
//
// Environment (supabase secrets set ...):
//   RESEND_API_KEY        a Resend key allowed to send from retcalc.app
//   CHECKIN_SECRET        signs and checks unsubscribe tokens (long, random;
//                         changing it breaks the links in emails already sent)
//   CHECKIN_CRON_SECRET   the value the schedule sends in x-checkin-cron
// SUPABASE_URL and the secret key are provided by Supabase.
// Deploy: `npx supabase functions deploy checkin-email --no-verify-jwt`.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { FROM, CONTACT, SITE, checkinEmail, dueList, unsubscribeToken, verifyToken, type Candidate } from "../_shared/checkin.ts";

/** At most this many per run; anyone left over is picked up the next day. */
const MAX_PER_RUN = 100;
/** Resend allows a few requests a second per team: one send every 600 ms
    stays well under it, beside the site's sign-in mail. */
const SPACING_MS = 600;
/** Stop starting new sends after this long, inside the function's time limit. */
const BUDGET_MS = 110_000;

const ALLOWED = [/^https:\/\/retcalc\.app$/, /^http:\/\/localhost:3100$/, /^https:\/\/retcalc-[a-z0-9-]+-ret-calc\.vercel\.app$/];

function cors(origin: string | null): Record<string, string> {
  const ok = origin != null && ALLOWED.some((re) => re.test(origin));
  return ok
    ? {
      "Access-Control-Allow-Origin": origin!,
      "Access-Control-Allow-Headers": "content-type",
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

function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function admin() {
  const url = Deno.env.get("SUPABASE_URL"), key = secretKey();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/* ---------- Unsubscribe ---------- */

async function unsubscribe(req: Request, headers: Record<string, string>): Promise<Response> {
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

  let token = new URL(req.url).searchParams.get("t");
  if (!token && (req.headers.get("Content-Type") ?? "").includes("application/json")) {
    try { token = String(((await req.json()) as { token?: unknown }).token ?? ""); } catch { /* no body */ }
  }
  const uid = await verifyToken(Deno.env.get("CHECKIN_SECRET") ?? "", token);
  if (!uid) return reply(400, { error: "This link isn't valid. Turn the email off from Profile on your Dashboard instead." });

  const db = admin();
  if (!db) return reply(500, { error: "The email service isn't set up." });
  const { error } = await db.from("email_prefs").upsert({ user_id: uid, checkin: false }, { onConflict: "user_id" });
  // 23503: the account was deleted, so there's nothing left to send to.
  if (error && error.code !== "23503") return reply(500, { error: "Couldn't turn it off. Try again in a minute." });
  return reply(200, { off: true });
}

/* ---------- The daily run ---------- */

interface RunBody { dry_run?: boolean; only?: string; force?: boolean }

async function send(resend: string, c: Candidate, now: Date, fnUrl: string, secret: string): Promise<{ ok: boolean; status: number }> {
  const token = await unsubscribeToken(secret, c.user_id);
  const m = checkinEmail({ name: c.first_name, lastEntry: c.last_entry, now, unsubscribeUrl: SITE + "/unsubscribe?t=" + encodeURIComponent(token) });
  const body = JSON.stringify({
    from: FROM,
    to: [c.email],
    reply_to: CONTACT,
    subject: m.subject,
    html: m.html,
    text: m.text,
    headers: {
      "List-Unsubscribe": "<" + fnUrl + "/unsubscribe?t=" + encodeURIComponent(token) + ">",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
  const post = () => fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + resend,
      "Content-Type": "application/json",
      // The same person on the same day is sent once, even if the run repeats.
      "Idempotency-Key": "checkin/" + c.user_id + "/" + now.toISOString().slice(0, 10),
    },
    body,
  });
  let r = await post();
  if (r.status === 429) {
    // Over the rate limit: wait as asked (or 2 seconds), then try once more.
    const wait = Math.min(10, Number(r.headers.get("retry-after")) || 2);
    await r.body?.cancel();
    await sleep(wait * 1000);
    r = await post();
  }
  await r.body?.cancel();
  return { ok: r.ok, status: r.status };
}

async function run(req: Request): Promise<Response> {
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  const expected = Deno.env.get("CHECKIN_CRON_SECRET") ?? "";
  const given = req.headers.get("x-checkin-cron") ?? "";
  if (!expected || !sameSecret(given, expected)) return json(401, { error: "Not allowed." });

  let opts: RunBody = {};
  try { opts = ((await req.json()) ?? {}) as RunBody; } catch { /* empty body: an ordinary run */ }
  if (opts.only != null && !UUID.test(opts.only)) return json(400, { error: "only must be a user id." });

  const db = admin(), resend = Deno.env.get("RESEND_API_KEY"), secret = Deno.env.get("CHECKIN_SECRET") ?? "";
  const base = Deno.env.get("SUPABASE_URL");
  if (!db || !base || !secret || (!resend && !opts.dry_run)) return json(500, { error: "The check-in email isn't set up." });
  const fnUrl = base.replace(/\/$/, "") + "/functions/v1/checkin-email";

  const { data, error } = await db.rpc("checkin_candidates");
  if (error || !data) return json(500, { error: "Couldn't read who has the email on." });

  const now = new Date();
  let cands = data as Candidate[];
  if (opts.only) cands = cands.filter((c) => c.user_id === opts.only!.toLowerCase());
  const due = opts.only && opts.force ? cands : dueList(cands, now);
  const batch = due.slice(0, MAX_PER_RUN);
  if (opts.dry_run) return json(200, { on: (data as Candidate[]).length, due: due.length, would_send: batch.length });

  const started = Date.now();
  let sent = 0, failed = 0, left = due.length - batch.length;
  const statuses: Record<string, number> = {};
  for (let i = 0; i < batch.length; i++) {
    if (Date.now() - started > BUDGET_MS) { left += batch.length - i; break; }
    if (i) await sleep(SPACING_MS);
    const c = batch[i];
    let r: { ok: boolean; status: number };
    try { r = await send(resend!, c, now, fnUrl, secret); } catch { r = { ok: false, status: 0 }; }
    if (!r.ok) {
      failed++;
      statuses[r.status] = (statuses[r.status] ?? 0) + 1;
      // A bad key or a refused sender won't fix itself on the next person.
      if (r.status === 401 || r.status === 403) { left += batch.length - i - 1; break; }
      continue;
    }
    sent++;
    const logged = await db.from("email_log").insert({ user_id: c.user_id, kind: "checkin", sent_at: now.toISOString() });
    if (logged.error) console.error("checkin-email: sent but not logged", logged.error.message);
  }
  // Counts only in the reply and the logs: no addresses.
  console.log("checkin-email run", JSON.stringify({ on: (data as Candidate[]).length, due: due.length, sent, failed, left, statuses }));
  return json(200, { on: (data as Candidate[]).length, due: due.length, sent, failed, left, statuses });
}

Deno.serve(async (req) => {
  const headers = cors(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST." }), { status: 405, headers: { ...headers, "Content-Type": "application/json", Allow: "POST, OPTIONS" } });
  }
  const path = new URL(req.url).pathname.replace(/\/+$/, "");
  if (path.endsWith("/unsubscribe")) return unsubscribe(req, headers);
  return run(req);
});
