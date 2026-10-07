import { expect, test } from "@playwright/test";
import { NEW } from "../playwright.config";

/* iOS zooms toward a focused field. PageEffects pins maximum-scale on the
   viewport while a field has focus, and must find the live viewport tag
   each time: Next puts a new one in on every page change, so a tool
   reached from another page is the case that matters. */
const vp = () => document.querySelector<HTMLMetaElement>('meta[name="viewport"]')!.content;

test("a field reached after a page change pins the viewport while focused", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1280) > 640, "phone only");
  await page.goto(NEW + "/");
  for (const path of ["/budget", "/fire"]) {
    await page.evaluate((h) => (window as unknown as { next: { router: { push: (h: string) => void } } }).next.router.push(h), path);
    await page.waitForURL("**" + path);
    const f = page.locator("#main input:visible:not([type=checkbox]):not([type=range])").first();
    await f.tap();
    expect(await page.evaluate(vp)).toContain("maximum-scale=1");
    expect(await f.evaluate((e) => getComputedStyle(e).fontSize)).toBe("16px");
    await page.evaluate(() => (document.activeElement as HTMLElement).blur());
    await expect.poll(() => page.evaluate(vp)).not.toContain("maximum-scale");
  }
});
