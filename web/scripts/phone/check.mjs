#!/usr/bin/env node
/* The phone redesign's one guarantee: tablets and desktops (768px and wider)
   never change. Every stylesheet in styles/phone/ must be a single
   `@media (width < 768px){ ... }` block with nothing outside it but
   comments, and app/globals.css must import every one of them.

     node scripts/phone/check.mjs        # exits 1 on any breach
*/
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = join(WEB, "styles", "phone");
const OPEN = "@media (width < 768px){";
const globals = readFileSync(join(WEB, "app", "globals.css"), "utf8");
const bad = [];

for (const f of readdirSync(DIR).filter((f) => f.endsWith(".css")).sort()) {
  const src = readFileSync(join(DIR, f), "utf8");
  // Comments and strings out, so a brace inside either doesn't count.
  const css = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""').trim();
  if (!css.startsWith(OPEN)) { bad.push(`${f}: must start with ${OPEN}`); continue; }
  let depth = 0, end = -1;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) { end = i; break; }
  }
  if (end < 0) bad.push(`${f}: the media query never closes`);
  else if (css.slice(end + 1).trim()) bad.push(`${f}: rules after the media query: ${css.slice(end + 1).trim().slice(0, 60)}`);
  // A wider query nested inside would be dead code; a min-width one is a mistake.
  if (/@media[^{]*min-width\s*:\s*(7[6-9]\d|[89]\d\d|\d{4,})/.test(css)) bad.push(`${f}: a min-width query of 768px or more inside the phone file`);
  if (!globals.includes(`@import "../styles/phone/${f}";`)) bad.push(`${f}: not imported by app/globals.css`);
}
if (bad.length) { console.error("Phone stylesheets:\n  " + bad.join("\n  ")); process.exit(1); }
console.log(`Phone stylesheets: ${readdirSync(DIR).filter((f) => f.endsWith(".css")).length} files, each one phone-only media query.`);
