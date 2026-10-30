#!/usr/bin/env node
/* Writes the monthly check-in email, as it would be sent, for a few sample
   people, without sending anything: open the .html files in a browser (or
   drag one into a mail app) and read the .txt for the plain-text part.

     npm run email:preview      # from web/

   Output: web/scripts/email/preview/ (gitignored). The email comes from
   supabase/functions/_shared/checkin.ts, the same module the Edge Function
   sends with. Sample names only (Sam, Jordan), never real people's. */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkinEmail, unsubscribeToken } from "../../../supabase/functions/_shared/checkin.ts";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "preview");
const NOW = new Date("2026-10-06T14:00:00Z");
const SAMPLE_ID = "00000000-0000-4000-8000-000000000000";
const token = await unsubscribeToken("preview-only-secret", SAMPLE_ID);
const unsubscribeUrl = "https://retcalc.app/unsubscribe?t=" + encodeURIComponent(token);

const cases = [
  { file: "checkin-34-days", name: "Sam", lastEntry: "2026-09-02" },
  { file: "checkin-never-updated", name: "Jordan", lastEntry: null },
  { file: "checkin-no-name", name: null, lastEntry: "2026-08-06" },
];

mkdirSync(OUT, { recursive: true });
const links = [];
for (const c of cases) {
  const m = checkinEmail({ name: c.name, lastEntry: c.lastEntry, now: NOW, unsubscribeUrl });
  writeFileSync(join(OUT, c.file + ".html"), m.html);
  writeFileSync(join(OUT, c.file + ".txt"), "Subject: " + m.subject + "\n\n" + m.text);
  links.push(`<li><a href="${c.file}.html">${c.file}.html</a> (<a href="${c.file}.txt">plain text</a>)</li>`);
  console.log(join(OUT, c.file + ".html"));
}
writeFileSync(join(OUT, "index.html"), `<!doctype html><meta charset="utf-8"><title>Check-in email previews</title>
<body style="font:16px/1.5 -apple-system,sans-serif;margin:32px">
<h1 style="font-size:20px">Monthly check-in email: previews</h1>
<p>As of ${NOW.toISOString().slice(0, 10)}. Nothing here is sent. Switch your system to dark mode to see the dark version.</p>
<ul>${links.join("")}</ul></body>`);
console.log(join(OUT, "index.html"));
