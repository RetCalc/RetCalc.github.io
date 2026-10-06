#!/usr/bin/env node
/* The focus check: tabs through a set of pages in dark and light and fails
   if a focused element shows no visible focus indicator.

     node scripts/focus/focus.mjs           # all pages
     node scripts/focus/focus.mjs mortgage  # just these

   Run from web/ after `npm run build`. Uses `next start` on port 3200
   (started and stopped here unless one is already running; BASE=<url> for
   another server) and the Chrome installed on this machine.

   An element counts as showing focus when it, or the group around it (two
   levels up), has a visible outline (not "none", wider than 0, not
   transparent), or when focusing it changes its
   box-shadow, border color or background (a ring or a fill drawn another
   way). Each failing kind of element is listed once per page, with how many
   times it was met. */
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE ?? "http://localhost:3200";
const PAGES = {
  home: "/", advanced: "/advanced", stages: "/stages", tools: "/tools", drawdown: "/drawdown", incometax: "/incometax",
  mortgage: "/mortgage", fire: "/fire", budget: "/budget", guide: "/guide", about: "/about",
};
const MAX_TABS = Number(process.env.MAX_TABS ?? 160);

const up = () => fetch(BASE).then((r) => r.ok, () => false);
let proc = null;
if (!(await up())) {
  if (process.env.BASE) throw new Error(`${BASE} isn't answering`);
  proc = spawn("npx", ["next", "start", "-p", "3200"], { stdio: "ignore" });
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise((r) => setTimeout(r, 500));
  if (!(await up())) { proc.kill(); throw new Error("next start didn't come up on :3200 (run `npm run build` first)"); }
}

const only = process.argv.slice(2);
const pages = Object.entries(PAGES).filter(([k]) => !only.length || only.includes(k));
const browser = await chromium.launch({ channel: "chrome", headless: true });
let failures = 0, checked = 0, rings = 0;
try {
  for (const theme of ["dark", "light"]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme, reducedMotion: "reduce" });
    await ctx.addInitScript((t) => { try { localStorage.setItem("retcalc.theme.v1", JSON.stringify(t)); } catch {} }, theme);
    for (const [name, path] of pages) {
      const page = await ctx.newPage();
      await page.goto(BASE + path, { waitUntil: "networkidle" });
      await page.waitForTimeout(300);
      const bad = new Map(), noRing = new Map();
      const seen = new Set();
      for (let i = 0; i < MAX_TABS; i++) {
        await page.keyboard.press("Tab");
        const r = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          window.__fi ??= 0; el.__fi ??= ++window.__fi; const key = el.__fi;
          const props = ["outlineStyle", "outlineWidth", "outlineColor", "boxShadow", "borderTopColor", "borderBottomColor", "backgroundColor"];
          const read = () => { const cs = getComputedStyle(el); return Object.fromEntries(props.map((p) => [p, cs[p]])); };
          const on = read();
          const transparent = (c) => /rgba\([^)]*,\s*0\)$/.test(c) || c === "transparent";
          const ringOn = (cs) => cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0 && !transparent(cs.outlineColor);
          // A ring may be drawn around a field's group (an input with its "$"
          // and unit) rather than on the input itself: look two levels up.
          let outline = ringOn(getComputedStyle(el));
          for (let a = el.parentElement, n = 0; !outline && a && n < 2; a = a.parentElement, n++) outline = ringOn(getComputedStyle(a)) && a.matches(":focus-within");
          // Compare with the same element unfocused: move focus to a throwaway
          // element (so :focus-visible styles drop), read, and put focus back.
          const tmp = document.createElement("span"); tmp.tabIndex = -1; tmp.style.position = "fixed"; tmp.style.top = "-9px"; document.body.appendChild(tmp);
          tmp.focus({ preventScroll: true }); const off = read(); el.focus({ preventScroll: true }); tmp.remove();
          const changed = ["boxShadow", "borderTopColor", "borderBottomColor", "backgroundColor"].some((p) => on[p] !== off[p]);
          const cls = typeof el.className === "string" ? el.className : el.getAttribute("class") || "";
          const kind = el.tagName.toLowerCase() + (el.getAttribute("role") ? `[role=${el.getAttribute("role")}]` : "") +
            (cls ? "." + cls.split(/\s+/).filter((c) => c && !/[:[\]()/]/.test(c)).slice(0, 3).join(".") : "") +
            (el.dataset.slot ? `[data-slot=${el.dataset.slot}]` : "");
          return { key, kind, ok: outline || changed, ring: outline, text: (el.getAttribute("aria-label") || el.textContent || el.value || "").trim().slice(0, 30) };
        });
        if (!r) continue;
        if (seen.has(r.key)) break; // wrapped around
        seen.add(r.key);
        checked++;
        if (!r.ok) { const e = bad.get(r.kind) ?? { n: 0, eg: r.text }; e.n++; bad.set(r.kind, e); failures++; }
        else if (!r.ring) { const e = noRing.get(r.kind) ?? { n: 0, eg: r.text }; e.n++; noRing.set(r.kind, e); rings++; }
      }
      const line = [...[...bad].map(([k, v]) => `    no focus indicator: ${k} ×${v.n} (e.g. "${v.eg}")`),
        ...[...noRing].map(([k, v]) => `    (note) shown without a ring: ${k} ×${v.n} (e.g. "${v.eg}")`)].join("\n");
      console.log(`${theme} ${name}: ${seen.size} focus stops${line ? "\n" + line : ", all show a ring"}`);
      await page.close();
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  proc?.kill();
}
console.log((failures ? `\n${failures} focus stops without a visible indicator (of ${checked}).` : `\nEvery focus stop shows an indicator (${checked} checked).`) +
  (rings ? ` ${rings} show focus by a border or fill change rather than a ring.` : ""));
process.exit(failures ? 1 : 0);
