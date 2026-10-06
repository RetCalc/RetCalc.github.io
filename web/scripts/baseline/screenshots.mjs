#!/usr/bin/env node
/* Full-page screenshots of the main pages before the redesign: desktop and
   phone widths, dark and light themes. Saved outside the app, to
   ../redesign-baseline/screenshots/<theme>-<width>/<page>.png.

     npm run build                                 # once: shoots the production build
     node scripts/baseline/screenshots.mjs         # all pages
     node scripts/baseline/screenshots.mjs drawdown roth   # just these

   Uses `next start` on port 3200 (started and stopped here unless one is
   already running) and the Chrome installed on this machine, as the e2e
   checks do. BASE=<url> shoots another server instead. */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "@playwright/test";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(WEB, "..", "redesign-baseline", "screenshots");
const BASE = process.env.BASE ?? "http://localhost:3200";

export const PAGES = {
  home: "/", advanced: "/advanced", stages: "/stages", tools: "/tools", drawdown: "/drawdown",
  incometax: "/incometax", roth: "/roth", mortgage: "/mortgage", guide: "/guide", about: "/about",
};
const SIZES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  phone: { ...devices["iPhone 13"], defaultBrowserType: undefined },
};
const THEMES = ["dark", "light"];

const up = () => fetch(BASE).then((r) => r.ok, () => false);

async function server() {
  if (await up()) return null;
  if (process.env.BASE) throw new Error(`${BASE} isn't answering`);
  const proc = spawn("npx", ["next", "start", "-p", "3200"], { cwd: WEB, stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await up()) return proc;
  }
  proc.kill();
  throw new Error("next start didn't come up on :3200 (run `npm run build` first)");
}

const only = process.argv.slice(2);
const pages = Object.entries(PAGES).filter(([k]) => !only.length || only.includes(k));
const proc = await server();
const browser = await chromium.launch({ channel: "chrome", headless: true });
let n = 0;
try {
  for (const theme of THEMES) for (const [size, opts] of Object.entries(SIZES)) {
    const ctx = await browser.newContext({ ...opts, colorScheme: theme, reducedMotion: "reduce" });
    // The theme as a visitor's saved choice (lib/theme-script.ts), set before the page's own script reads it.
    await ctx.addInitScript((t) => { try { localStorage.setItem("retcalc.theme.v1", JSON.stringify(t)); } catch {} }, theme);
    const dir = join(OUT, `${theme}-${size}`);
    mkdirSync(dir, { recursive: true });
    for (const [name, path] of pages) {
      const page = await ctx.newPage();
      await page.goto(BASE + path, { waitUntil: "networkidle" });
      await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);
      const shown = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
      if (shown !== theme) throw new Error(`${path}: asked for ${theme}, page shows ${shown}`);
      const file = join(dir, `${name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log("  " + relative(join(WEB, ".."), file));
      n++;
      await page.close();
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  proc?.kill();
}
console.log(`${n} screenshots in ${relative(process.cwd(), OUT)}`);
