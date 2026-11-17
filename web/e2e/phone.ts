/* On a phone (under 768px) a tool shows its Inputs and its Results as two
   views, and folds the inputs a first visit leaves alone ("More options").
   A check that goes straight to a control by its id may find it in the view
   that isn't showing, or inside a closed fold. reveal() brings it on screen
   the way a person would: switch to its view, open the folds. On a desktop
   everything is already showing and it does nothing. */
import type { Page } from "@playwright/test";

export async function reveal(page: Page, selector: string) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: "attached" });
  if (await el.isVisible()) return;
  // Its view: the nearest block marked data-pv="in" or "out".
  const view = await el.evaluate((e) => e.closest("[data-pv]")?.getAttribute("data-pv") ?? null);
  if (view) {
    await page.evaluate((v) => window.dispatchEvent(new CustomEvent("retcalc:phone-view", { detail: v })), view);
    await page.waitForFunction((v) => document.body.getAttribute("data-pv") === v, view);
  }
  // Its folds: every closed one, until it shows (a fold can sit inside another).
  for (let i = 0; i < 4 && !(await el.isVisible()); i++) {
    const closed = page.locator('.pfold-t[aria-expanded="false"]:visible');
    const n = await closed.count();
    if (!n) break;
    for (let k = 0; k < n; k++) await closed.first().click();
  }
}
