// The monthly check-in email: who is due, the unsubscribe token, and the
// email itself (HTML and plain text). One module, imported by the
// checkin-email Edge Function (Deno) and by the preview script and tests
// (Node, which strips the types itself), so it uses nothing but the
// language and Web Crypto, and imports nothing.
//
// What the email holds, by design: a first name, the date balances were last
// updated, and links. No dollar figures and no plan results: email is less
// private than the site, and every figure is worked out in the browser.
// supabase/CHECKIN_EMAIL.md has the rest.

export const SITE = "https://retcalc.app";
export const DASHBOARD_URL = SITE + "/dashboard";
export const CONTACT = "contact@retcalc.app";
export const FROM = "RetCalc <checkin@retcalc.app>";

/** Balances this old (or none at all) are due a check-in. */
export const STALE_DAYS = 30;
/** And no check-in in this many days before. */
export const GAP_DAYS = 28;

const DAY = 86_400_000;

/* ---------- Dates ---------- */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** A YYYY-MM-DD as midnight UTC, or null if it isn't one. */
function dayOf(date: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return Number.isNaN(t) ? null : t;
}

/** Whole days from a YYYY-MM-DD to `now`'s date (UTC), never below 0. */
export function daysSince(date: string, now: Date): number | null {
  const t = dayOf(date);
  if (t == null) return null;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((today - t) / DAY));
}

/** "September 2", with the year when it isn't `now`'s. */
export function longDate(date: string, now: Date): string {
  const t = dayOf(date);
  if (t == null) return date;
  const d = new Date(t);
  const s = MONTHS[d.getUTCMonth()] + " " + d.getUTCDate();
  return d.getUTCFullYear() === now.getUTCFullYear() ? s : s + ", " + d.getUTCFullYear();
}

/* ---------- Who is due ---------- */

/** A row of public.checkin_candidates(): someone with the email on. */
export interface Candidate {
  user_id: string;
  email: string;
  first_name: string | null;
  /** The latest balance entry's date, YYYY-MM-DD; null with none. */
  last_entry: string | null;
  /** When the last check-in went out (ISO), null if never. */
  last_sent: string | null;
}

/** Due: balances 30 or more days old (or none), and no check-in sent in
    the last 28 days. */
export function isDue(c: Pick<Candidate, "last_entry" | "last_sent">, now: Date): boolean {
  if (c.last_sent) {
    const sent = Date.parse(c.last_sent);
    if (!Number.isNaN(sent) && now.getTime() - sent < GAP_DAYS * DAY) return false;
  }
  if (!c.last_entry) return true;
  const age = daysSince(c.last_entry, now);
  return age == null || age >= STALE_DAYS;
}

/** Everyone due, those who've waited longest first (never sent, then the
    oldest send), so a run that stops early is fair the next day. */
export function dueList(cands: Candidate[], now: Date): Candidate[] {
  const sent = (c: Candidate) => (c.last_sent ? Date.parse(c.last_sent) || 0 : 0);
  return cands.filter((c) => isDue(c, now)).sort((a, b) => sent(a) - sent(b));
}

/* ---------- The unsubscribe token ---------- */

// "v1.<user id>.<signature>": the user id, signed with a secret only the
// function knows (CHECKIN_SECRET), so a link can only switch off the email
// for the person it was sent to. It doesn't expire: an old email's link
// still works.

const PURPOSE = "retcalc:checkin-unsubscribe:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(secret: string, userId: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(PURPOSE + userId))));
}

/** Same answer in the same time either way, so a signature can't be
    guessed a character at a time. */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function unsubscribeToken(secret: string, userId: string): Promise<string> {
  if (!secret) throw new Error("No signing secret.");
  return "v1." + userId + "." + (await sign(secret, userId.toLowerCase()));
}

/** The user id a token was made for, or null if it wasn't made with this secret. */
export async function verifyToken(secret: string, token: string | null | undefined): Promise<string | null> {
  if (!secret || !token) return null;
  const [v, id, sig, ...rest] = token.trim().split(".");
  if (v !== "v1" || rest.length || !id || !sig) return null;
  const uid = id.toLowerCase();
  if (!UUID.test(uid)) return null;
  return same(sig, await sign(secret, uid)) ? uid : null;
}

/* ---------- The email ---------- */

export interface CheckinInput {
  /** First name, or null/blank for none. */
  name: string | null;
  /** The latest balance entry, YYYY-MM-DD, or null with none. */
  lastEntry: string | null;
  now: Date;
  /** The one-click link in the footer (retcalc.app/unsubscribe?t=...). */
  unsubscribeUrl: string;
}

export interface CheckinEmail { subject: string; html: string; text: string }

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** A name fit for "Hi, Sam": trimmed, one line, not too long. */
function cleanName(name: string | null): string | null {
  const n = (name ?? "").replace(/\s+/g, " ").trim();
  return n && n.length <= 40 ? n : null;
}

/** The sentence about balances. */
export function balancesLine(lastEntry: string | null, now: Date): string {
  const days = lastEntry ? daysSince(lastEntry, now) : null;
  if (!lastEntry || days == null) return "You haven't added balances yet.";
  const ago = days === 0 ? "today" : days === 1 ? "1 day ago" : days + " days ago";
  return "Your balances were last updated on " + longDate(lastEntry, now) + ", " + ago + ".";
}

// RetCalc's light theme (web/app/globals.css, :root[data-theme="light"])
// and its dark one for mail apps that follow the system's dark mode.
const C = {
  ground: "#faf9f6", surface: "#ffffff", rule: "#e3e0d8", text: "#17191c", muted: "#5b636e", amber: "#9a6200", onAmber: "#ffffff",
  dGround: "#0e1116", dSurface: "#151a21", dRule: "#2a313c", dText: "#e8ebf0", dMuted: "#9aa4b2", dAmber: "#e3a93b", dOnAmber: "#0e1116",
};
const FONT = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function checkinEmail(input: CheckinInput): CheckinEmail {
  const name = cleanName(input.name);
  const hello = name ? "Hi " + name + "," : "Hi,";
  const balances = balancesLine(input.lastEntry, input.now);
  const never = !input.lastEntry || daysSince(input.lastEntry, input.now) == null;
  const steps = [
    never ? "Add your balances in Net worth." : "Update your balances in Net worth.",
    "Look over your spending for the month.",
    "See how your plan moved since last time.",
  ];
  const subject = "Your monthly RetCalc check-in";
  const why = "You're getting this because you have a RetCalc Dashboard. It comes when your balances haven't been updated for 30 days.";

  const text = [
    hello,
    "",
    balances,
    "",
    "A check-in takes a few minutes:",
    ...steps.map((s) => "- " + s),
    "",
    "Open my Dashboard: " + DASHBOARD_URL,
    "",
    "--",
    why,
    "Turn it off: " + input.unsubscribeUrl,
    "Questions: " + CONTACT,
    "",
  ].join("\n");

  const p = `margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.55;color:${C.text};`;
  const small = `margin:0 0 8px;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};`;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(subject)}</title>
<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  a { color: ${C.amber}; }
  @media (prefers-color-scheme: dark) {
    .rc-ground { background-color: ${C.dGround} !important; }
    .rc-card { background-color: ${C.dSurface} !important; border-color: ${C.dRule} !important; }
    .rc-text { color: ${C.dText} !important; }
    .rc-muted { color: ${C.dMuted} !important; }
    .rc-rule { border-color: ${C.dRule} !important; }
    .rc-amber { color: ${C.dAmber} !important; }
    .rc-btn { background-color: ${C.dAmber} !important; }
    .rc-btn a { color: ${C.dOnAmber} !important; }
  }
  [data-ogsc] .rc-text { color: ${C.dText} !important; }
  [data-ogsc] .rc-muted { color: ${C.dMuted} !important; }
  [data-ogsc] .rc-amber { color: ${C.dAmber} !important; }
  @media (max-width: 520px) { .rc-pad { padding: 24px 20px !important; } }
</style>
</head>
<body class="rc-ground" style="margin:0;padding:0;background-color:${C.ground};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(balances)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="rc-ground" style="background-color:${C.ground};">
<tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
  <tr><td style="padding:0 4px 16px;font-family:${FONT};font-size:18px;font-weight:700;letter-spacing:-0.01em;" class="rc-text"><span class="rc-text" style="color:${C.text};">RetCalc</span><span class="rc-amber" style="color:${C.amber};">.</span></td></tr>
  <tr><td class="rc-card rc-pad" style="background-color:${C.surface};border:1px solid ${C.rule};border-radius:12px;padding:32px;">
    <p class="rc-text" style="${p}">${esc(hello)}</p>
    <p class="rc-text" style="${p}">${esc(balances)}</p>
    <p class="rc-text" style="${p}margin-bottom:8px;">A check-in takes a few minutes:</p>
    <ul class="rc-text" style="margin:0 0 24px;padding:0 0 0 22px;font-family:${FONT};font-size:16px;line-height:1.55;color:${C.text};">
      ${steps.map((s) => `<li class="rc-text" style="margin:0 0 4px;color:${C.text};">${esc(s)}</li>`).join("\n      ")}
    </ul>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
    <tr><td class="rc-btn" bgcolor="${C.amber}" style="background-color:${C.amber};border-radius:8px;">
      <a href="${esc(DASHBOARD_URL)}" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:16px;font-weight:600;line-height:1.2;color:${C.onAmber};text-decoration:none;border-radius:8px;">Open my Dashboard</a>
    </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:20px 4px 0;">
    <p class="rc-muted" style="${small}">${esc(why)}</p>
    <p class="rc-muted" style="${small}"><a class="rc-amber" href="${esc(input.unsubscribeUrl)}" style="color:${C.amber};text-decoration:underline;">Turn off this email</a> with one click, or from Profile on your Dashboard.</p>
    <p class="rc-muted" style="${small}">Questions? <a class="rc-amber" href="mailto:${CONTACT}" style="color:${C.amber};text-decoration:underline;">${CONTACT}</a></p>
  </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>
`;
  return { subject, html, text };
}
