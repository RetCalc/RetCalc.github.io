import { expect, test } from "@playwright/test";
import { NEW } from "../playwright.config";
import { compareTool, type Case } from "./compare";

/* The About page on both sites: folded, with panels opened, and in the
   light theme. The old page ends with an empty article box whose grid gap
   adds 20px above the footer; the new one has no box, so it's hidden. */
const cases: Case[] = [
  { name: "folded", steps: [] },
  { name: "panels opened", steps: [["click", "#tab-about .panel.about:nth-of-type(4) h2"], ["click", "#tab-about .panel.about:nth-of-type(9) h2"], ["click", "#tab-about .panel.about:nth-of-type(21) h2"]] },
  { name: "light theme", steps: [["click", '#segTheme [data-theme="light"]']] },
];

test("about matches the current site", async ({ page }, info) => {
  test.setTimeout(240_000);
  await compareTool(page, info, "about", ["#tab-about"], cases, "#seoArticles");
});

test("the contact address is put together in the browser", async ({ page }) => {
  await page.goto(NEW + "/about");
  await expect(page.locator("#tab-about a.mailme")).toHaveAttribute("href", "mailto:contact@retcalc.app");
});
