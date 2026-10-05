/* Helpers for the old-vs-new checks: open a page on both sites, give both
   the same inputs, and compare what they show. */
import { writeFileSync } from "node:fs";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { NEW, OLD } from "../playwright.config";

/** One input change: a field and its new value, or a click. The field is an
    id ("moPrice") or a CSS selector ("#dtList .dtrow:nth-child(2) .desc").
    Selects are chosen by value; everything else is typed, as a person would.
    ["click", selector] presses a button; ["until", selector] waits for
    something to appear (a Monte Carlo run's result, say). */
export type Step = [target: string, value: string];
export interface Case { name: string; steps: Step[] }

/* Known, intended differences, hidden on both sites before comparing. */
const HIDE: string[] = [];

/* Page calls that wait on the page itself have no time limit of their own,
   so a page that stops responding would hold the test until its overall
   limit. Each gets 30 seconds instead, and the retry takes over. */
/* With STEP_LOG=1, every step is printed with its time, to find a stall. */
const t0 = Date.now();
const log = (msg: string) => process.env.STEP_LOG && console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`);

function within<T>(what: string, p: Promise<T>, ms = 30_000): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  const late = new Promise<never>((_, reject) => { t = setTimeout(() => reject(new Error(`${what}: no answer in ${ms / 1000}s`)), ms); });
  return Promise.race([p, late]).finally(() => clearTimeout(t));
}

const STILL = ".navbar,.sbcover,aside,.gd-top,.gd-side,thead th{position:static!important}";

export async function open(page: Page, url: string, hide = "") {
  log("goto " + url);
  await page.goto(url);
  log("loaded " + url);
  // The old site hides its page until its script has run.
  await page.waitForFunction(() => !document.documentElement.classList.contains("booting"), null, { timeout: 30_000 });
  log("styling " + url);
  const hidden = [...HIDE, hide].filter(Boolean).join(",");
  await page.addStyleTag({ content: (hidden ? `${hidden}{display:none!important} ` : "") + "*{animation:none!important;transition:none!important}" });
}

export async function apply(page: Page, steps: Step[]) {
  for (const [target, value] of steps) {
    if (target === "click") {
      await page.locator(value).click();
      continue;
    }
    // work that finishes in the background: wait for what it shows
    if (target === "until") {
      await page.locator(value).first().waitFor({ timeout: 90_000 });
      continue;
    }
    const el = page.locator(/^[#.\[]/.test(target) ? target : "#" + target);
    const tag = await within(`reading ${target}`, el.evaluate((e) => e.tagName));
    if (tag === "SELECT") await el.selectOption(value);
    else await el.fill(value);
  }
  // let headline figures finish counting to their values
  await page.waitForTimeout(400);
}

/* Fields the old site kept on the page, hidden and unused, that weren't
   ported: Advanced's inflation calculator and each stage's stock mix. */
const UNPORTED = ["inflAmt", "inflYrs", "mix", "glideMix"];

/** Everything a tool shows: the visible text of its panels (inputs and
    results) and the value in every field, normalized for whitespace. */
export async function snapshot(page: Page, roots: string[]) {
  return within("reading the page", page.evaluate(([sel, skip]) => {
    const out: Record<string, string> = {};
    for (const s of sel) {
      const el = document.querySelector<HTMLElement>(s);
      out[s] = el ? el.innerText.replace(/\s+/g, " ").trim() : "(missing)";
      el?.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input,select").forEach((f) => {
        // Stage cards' fields have no ids; they're named by field and stage.
        const key = f.id || (f.dataset.f ? f.dataset.f + "@" + f.dataset.i : f.dataset.stotal ? "total@" + f.dataset.stotal : "");
        if (key && !skip.includes(f.id || f.dataset.f || "")) out[key.startsWith("#") || !f.id ? key : "#" + key] = f.type === "checkbox" ? String((f as HTMLInputElement).checked) : f.value;
      });
    }
    return out;
  }, [roots, UNPORTED] as const));
}

function diffImages(a: Buffer, b: Buffer) {
  const A = PNG.sync.read(a), B = PNG.sync.read(b);
  const w = Math.min(A.width, B.width), h = Math.min(A.height, B.height);
  const crop = (p: PNG) => {
    const out = new PNG({ width: w, height: h });
    PNG.bitblt(p, out, 0, 0, w, h, 0, 0);
    return out;
  };
  const ca = crop(A), cb = crop(B), diff = new PNG({ width: w, height: h });
  const n = pixelmatch(ca.data, cb.data, diff.data, w, h, { threshold: 0.15 });
  return { ratio: n / (w * h), sizeA: [A.width, A.height], sizeB: [B.width, B.height], diff: PNG.sync.write(diff) };
}

/** Runs each case on both sites: the numbers must match exactly, and the
    page must look the same (under 0.5% of pixels differing). */
/** `hide`: selectors set aside on both sites, for a known difference that's
    checked on its own (a control the old site lost, say). */
export async function compareTool(page: Page, info: TestInfo, slug: string, roots: string[], cases: Case[], hide = "") {
  log("opening a second page");
  const oldPage = await page.context().newPage();
  log("second page open");
  for (const c of cases) {
    await open(oldPage, `${OLD}/${slug === "home" ? "index" : slug}.html`, hide);
    await open(page, `${NEW}/${slug === "home" ? "" : slug}`, hide);
    await apply(oldPage, c.steps);
    await apply(page, c.steps);
    await compareShown(oldPage, page, info, c.name, roots);
  }
  await oldPage.close();
}

/** Compares what the two pages show now: the numbers exactly, and the look
    (under 0.5% of pixels differing). */
export async function compareShown(oldPage: Page, page: Page, info: TestInfo, name: string, roots: string[]) {
  log(name + ": reading both");
  const [a, b] = [await snapshot(oldPage, roots), await snapshot(page, roots)];
  log(name + ": read");
  expect.soft(b, `${name}: numbers`).toEqual(a);
  if (JSON.stringify(a) !== JSON.stringify(b))
    for (const [kind, snap] of [["old", a], ["new", b]] as const)
      writeFileSync(info.outputPath(`${name}-${kind}.json`.replace(/[^\w.-]+/g, "-")), JSON.stringify(snap, null, 1));

  // Sticky panels land wherever the last click left the page scrolled, so
  // both pages go back to the top and sticky parts are held in place.
  for (const p of [oldPage, page]) {
    await p.addStyleTag({ content: STILL });
    await within("scrolling to the top", p.evaluate(() => window.scrollTo(0, 0)));
  }
  /* Chrome can't capture an image over 16,384 pixels tall; a long page on
     a phone's dense screen passes that, so it's taken at one pixel per CSS
     pixel instead. */
  const tall = await within("measuring", oldPage.evaluate(() => document.querySelector("#main")!.getBoundingClientRect().height * devicePixelRatio > 16_000));
  const shot = { timeout: 30_000, scale: tall ? "css" : "device" } as const;
  const shotA = await oldPage.locator("#main").screenshot(shot);
  const shotB = await page.locator("#main").screenshot(shot);
  const d = diffImages(shotA, shotB);
  if (d.ratio > 0.005 || d.sizeA.join() !== d.sizeB.join()) {
    // Saved beside the test's results, to look at what differs.
    for (const [kind, body] of [["old", shotA], ["new", shotB], ["diff", d.diff]] as const) {
      const file = info.outputPath(`${name}-${kind}.png`.replace(/[^\w.-]+/g, "-"));
      writeFileSync(file, body);
      await info.attach(`${name}-${kind}.png`, { path: file, contentType: "image/png" });
    }
  }
  expect.soft(d.sizeB, `${name}: page size`).toEqual(d.sizeA);
  expect.soft(d.ratio, `${name}: share of pixels that differ`).toBeLessThan(0.005);
}
