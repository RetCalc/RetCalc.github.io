import { expect, test } from "@playwright/test";
import { NEW } from "../playwright.config";
import { compareTool, type Case, type Step } from "./compare";

/* The About page on both sites: folded, with panels opened, and in the
   light theme. The old page ends with an empty article box whose grid gap
   adds 20px above the footer; the new one has no box, so it's hidden. */
const cases: Case[] = [
  { name: "folded", steps: [] },
  // The same three sections on both sites, found by their heading's name:
  // the old site's h2, the new one's button inside an h3.
  { name: "panels opened", steps: ["How the projection works", "Plan Optimizer", "Historical"].map((t): Step => ["click", `#tab-about .panel.about > h2:text-is("${t}"), #tab-about h3 > button:text-is("${t}")`]) },
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
