/* Saves every link-preview card as an image: public/og/<slug>.jpg for each
   page in lib/cards.ts, and public/og.png (the site's card) from "home".
   The cards are drawn by app/og-card on the dev server, so start it first:

     npm run dev -- -p 3100
     node scripts/og/render.mjs [http://localhost:3100] [slug ...]
*/
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB = join(import.meta.dirname, "..", "..");
const args = process.argv.slice(2);
const base = args[0]?.startsWith("http") ? args.shift() : "http://localhost:3100";
const all = [...readFileSync(join(WEB, "lib", "cards.ts"), "utf8").matchAll(/^  "?([a-z0-9-]+)"?: \{/gm)].map((m) => m[1]);
const slugs = args.length ? args : all;

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, colorScheme: "dark", reducedMotion: "reduce" });
for (const slug of slugs) {
  const res = await page.goto(`${base}/og-card/${slug}`, { waitUntil: "networkidle" });
  if (!res?.ok()) throw new Error(`${slug}: ${res?.status()}`);
  // The card alone: the site's header, footer and the dev-server badge go.
  await page.evaluate(async () => {
    const card = document.querySelector("[data-og-card]");
    if (!card) throw new Error("no card");
    document.body.replaceChildren(card);
    await document.fonts.ready;
  });
  const path = slug === "home" ? join(WEB, "public", "og.png") : join(WEB, "public", "og", slug + ".jpg");
  await page.screenshot(slug === "home" ? { path } : { path, type: "jpeg", quality: 88 });
  console.log("saved", path.slice(WEB.length + 1));
}
await browser.close();
