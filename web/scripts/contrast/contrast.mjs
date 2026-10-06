#!/usr/bin/env node
/* The redesign's contrast check: every text/background pair the design
   system allows, in both themes, plus the non-text marks that carry meaning
   (control edges, chart lines, the logo).

     node scripts/contrast/contrast.mjs          # print every pair
     node scripts/contrast/contrast.mjs check    # same, and exit 1 if any fails

   Run from web/. Text needs 4.5:1, non-text 3:1 (WCAG 1.4.3 and 1.4.11).
   The colors are read from the frontmatter of DESIGN.md at the repo root,
   so the check follows the spec; once the tokens live in app/globals.css it
   should read them from there instead. Regular borders (Rule) are left out:
   they divide panels and cards, they don't identify a control. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DESIGN = join(HERE, "../../../DESIGN.md");

/* The colors block of the frontmatter: `  name: "#RRGGBB"` lines. */
function readTokens() {
  const front = readFileSync(DESIGN, "utf8").split("\n---\n")[0];
  const block = front.split("\ncolors:\n")[1].split(/\n\w/)[0];
  return Object.fromEntries([...block.matchAll(/^ {2}([\w-]+): "(#[0-9A-Fa-f]{6})"/gm)].map((m) => [m[1], m[2]]));
}

/* Each theme's roles. Light swaps Graphite for Paper and the accent,
   semantic and chart colors (and the logo) for their Deep twins. */
function themes(c) {
  const need = (k) => {
    if (!c[k]) throw new Error(`DESIGN.md has no color token "${k}"`);
    return c[k];
  };
  const theme = (n, deep) => {
    const d = (k) => (deep && c[`${k}-deep`] ? c[`${k}-deep`] : need(k));
    return {
      ground: need(`${n}-ground`), surface: need(`${n}-surface`), raised: need(`${n}-raised`),
      ruleStrong: need(`${n}-rule-strong`), text: need(`${n}-text`), muted: need(`${n}-muted`),
      accent: deep ? need("signal-amber-deep") : need("signal-amber"),
      onAccent: deep ? need("on-signal-amber-deep") : need("on-signal-amber"),
      gain: deep ? need("gain-deep") : need("gain"),
      loss: deep ? need("loss-deep") : need("loss"),
      series: Object.fromEntries(["sky", "teal", "rose", "lavender", "gray"].map((s) => [s, d(`series-${s}`)])),
      logo: Object.fromEntries(["gold", "jade", "steel"].map((s) => [s, d(`brand-${s}`)])),
    };
  };
  return { dark: theme("graphite", false), light: theme("paper", true) };
}

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
const luminance = (h) => {
  const [r, g, b] = rgb(h).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/* A tint as color-mix(in srgb, fg N%, bg) paints it. */
const tint = (fg, bg, share) => hex(rgb(fg).map((v, i) => v * share + rgb(bg)[i] * (1 - share)));

/* Badges: a 15% tint of gain or loss, on Surface only (DESIGN.md, Badges). */
const PILL = 0.15;

function pairs(t) {
  const text = [], marks = [];
  const bgs = { ground: t.ground, surface: t.surface, raised: t.raised };
  for (const fg of ["text", "muted", "accent", "gain", "loss"])
    for (const [bg, v] of Object.entries(bgs)) text.push([fg, t[fg], bg, v]);
  text.push(["on-accent", t.onAccent, "accent (primary button)", t.accent]);
  for (const s of ["gain", "loss"]) {
    const pill = tint(t[s], t.surface, PILL);
    text.push([s, t[s], `${s} badge (15% on surface)`, pill]);
    text.push(["text", t.text, `${s} badge (15% on surface)`, pill]);
  }
  const edges = { surface: t.surface, raised: t.raised, "input fill (ground)": t.ground };
  for (const [bg, v] of Object.entries(edges)) marks.push(["border-strong", t.ruleStrong, bg, v]);
  for (const [bg, v] of Object.entries(bgs)) marks.push(["focus ring (text)", t.text, bg, v]);
  const lines = { plan: t.accent, ...t.series };
  for (const [s, v] of Object.entries(lines))
    for (const bg of ["surface", "raised"]) marks.push([`chart ${s}`, v, bg, bgs[bg]]);
  for (const [s, v] of Object.entries(t.logo))
    for (const [bg, b] of Object.entries(bgs)) marks.push([`logo ${s}`, v, bg, b]);
  return { text, marks };
}

const check = process.argv[2] === "check";
const all = themes(readTokens());
let failed = 0;
for (const [kind, min] of [["text", 4.5], ["marks", 3]]) {
  console.log(`\n${kind === "text" ? "Text" : "Non-text marks"} (at least ${min}:1)`);
  const rows = [];
  for (const [mode, t] of Object.entries(all))
    for (const [fg, f, bg, b] of pairs(t)[kind]) {
      const r = ratio(f, b), ok = r >= min;
      if (!ok) failed++;
      rows.push({ theme: mode, foreground: `${fg} ${f}`, background: `${bg} ${b}`, ratio: r.toFixed(2), result: ok ? "pass" : "FAIL" });
    }
  console.table(rows);
}
console.log(failed ? `\n${failed} pair(s) below the minimum.` : "\nEvery pair passes.");
if (check && failed) process.exit(1);
