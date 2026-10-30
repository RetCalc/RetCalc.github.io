// The check-in email's rules: who is due, the unsubscribe token and what
// the email says. Run from web/: `npm run test:checkin` (Node's own test
// runner; Node strips the types).
import { test } from "node:test";
import assert from "node:assert/strict";
import { balancesLine, checkinEmail, daysSince, dueList, isDue, longDate, unsubscribeToken, verifyToken, type Candidate } from "../_shared/checkin.ts";

const NOW = new Date("2026-10-06T14:00:00Z");
const A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222";
const cand = (over: Partial<Candidate>): Candidate => ({ user_id: A, email: "sam@example.com", first_name: "Sam", last_entry: null, last_sent: null, ...over });

test("days since a date count whole calendar days in UTC", () => {
  assert.equal(daysSince("2026-09-02", NOW), 34);
  assert.equal(daysSince("2026-10-06", NOW), 0);
  assert.equal(daysSince("2026-10-07", NOW), 0, "a date ahead (time zones) counts as today");
  assert.equal(daysSince("junk", NOW), null);
});

test("dates read as words, with the year only when it isn't this one", () => {
  assert.equal(longDate("2026-09-02", NOW), "September 2");
  assert.equal(longDate("2025-12-31", NOW), "December 31, 2025");
});

test("due: balances 30 days old or more, or none", () => {
  assert.equal(isDue(cand({ last_entry: null }), NOW), true);
  assert.equal(isDue(cand({ last_entry: "2026-09-06" }), NOW), true, "exactly 30 days");
  assert.equal(isDue(cand({ last_entry: "2026-09-07" }), NOW), false, "29 days");
  assert.equal(isDue(cand({ last_entry: "2026-10-01" }), NOW), false);
});

test("not due when a check-in went out in the last 28 days", () => {
  assert.equal(isDue(cand({ last_sent: "2026-09-10T14:00:00Z" }), NOW), false, "26 days ago");
  assert.equal(isDue(cand({ last_sent: "2026-09-08T14:00:00Z" }), NOW), true, "exactly 28 days ago");
  assert.equal(isDue(cand({ last_entry: "2026-10-01", last_sent: "2026-08-01T00:00:00Z" }), NOW), false, "fresh balances win");
});

test("the due list leaves out who isn't due and puts the longest wait first", () => {
  const list = dueList([
    cand({ user_id: "recent", last_entry: "2026-10-01" }),
    cand({ user_id: "sent-long-ago", last_sent: "2026-07-01T00:00:00Z" }),
    cand({ user_id: "never-sent" }),
    cand({ user_id: "sent-lately", last_sent: "2026-10-01T00:00:00Z" }),
  ], NOW);
  assert.deepEqual(list.map((c) => c.user_id), ["never-sent", "sent-long-ago"]);
});

test("a token unsubscribes the person it was made for, and no one else", async () => {
  const t = await unsubscribeToken("s3cret", A);
  assert.match(t, /^v1\.[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);
  assert.equal(await verifyToken("s3cret", t), A);
  assert.equal(await verifyToken("s3cret", " " + t + " "), A, "spaces around it are fine");
  assert.equal(await verifyToken("other", t), null, "another secret");
  assert.equal(await verifyToken("s3cret", t.replace(A, B)), null, "someone else's id with this signature");
  const sig = t.split(".")[2];
  assert.equal(await verifyToken("s3cret", "v1." + A + "." + sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A")), null, "a changed signature");
  assert.equal(await verifyToken("s3cret", "v2." + A + "." + sig), null);
  assert.equal(await verifyToken("s3cret", "v1.not-a-uuid." + sig), null);
  assert.equal(await verifyToken("s3cret", t + ".extra"), null);
  assert.equal(await verifyToken("s3cret", ""), null);
  assert.equal(await verifyToken("", t), null, "no secret set: nothing verifies");
  await assert.rejects(() => unsubscribeToken("", A));
});

test("the balances sentence", () => {
  assert.equal(balancesLine("2026-09-02", NOW), "Your balances were last updated on September 2, 34 days ago.");
  assert.equal(balancesLine("2026-10-05", NOW), "Your balances were last updated on October 5, 1 day ago.");
  assert.equal(balancesLine(null, NOW), "You haven't added balances yet.");
});

test("the email: name, balances, the button and the footer, and no figures", () => {
  const unsub = "https://retcalc.app/unsubscribe?t=v1.x.y";
  const m = checkinEmail({ name: "Sam", lastEntry: "2026-09-02", now: NOW, unsubscribeUrl: unsub });
  assert.equal(m.subject, "Your monthly RetCalc check-in");
  for (const part of [m.html, m.text]) {
    assert.ok(part.includes("Hi Sam,"));
    assert.ok(part.includes("September 2, 34 days ago"));
    assert.ok(part.includes("https://retcalc.app/dashboard"));
    assert.ok(part.includes(unsub));
    assert.ok(part.includes("contact@retcalc.app"));
    assert.ok(!/\$\s?\d/.test(part), "no dollar figures");
    assert.ok(!/ a month\b/.test(part), "per month, never a month");
  }
  assert.ok(m.html.includes("Open my Dashboard"));
  const none = checkinEmail({ name: "  ", lastEntry: null, now: NOW, unsubscribeUrl: unsub });
  assert.ok(none.text.startsWith("Hi,\n"));
  assert.ok(none.text.includes("You haven't added balances yet."));
  assert.ok(none.text.includes("Add your balances"));
});

test("a name can't put markup in the email", () => {
  const m = checkinEmail({ name: "<b>Sam</b>", lastEntry: null, now: NOW, unsubscribeUrl: "https://retcalc.app/unsubscribe?t=a&b" });
  assert.ok(!m.html.includes("<b>Sam</b>"));
  assert.ok(m.html.includes("&lt;b&gt;Sam&lt;/b&gt;"));
  assert.ok(m.html.includes("t=a&amp;b"));
});
