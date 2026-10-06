import { test } from "@playwright/test";
import { NEW, OLD } from "../playwright.config";
import { apply, compareShown, open, type Step } from "./compare";

/* Each tool's Help on both sites: opened, then every part in turn, with a
   few of the things it suggests trying, compared each time. */
/* What a part has to wait for (a view worked out in the background), and
   anything set aside: the Roth chart's switch, which the old site dropped. */
const WAIT: Record<string, Step[]> = {
  "drawdown part 5": [["until", "#ddShowTable tbody tr"]],
  "drawdown part 6": [["until", "#ddHeat tbody tr"], ["until", "#ddValIntro:has-text('CAPE')"]],
};
const HIDE: Record<string, string> = { roth: "#rcChartTitle .h2ctrl" };

const TOURS: [slug: string, parts: number, tries?: Step[]][] = [
  ["incometax", 3, [["txPre", "12000"], ["click", '[data-view="take"]']]],
  ["mortgage", 3, [["moTerm", "15"]]],
  ["budget", 3],
  ["college", 3],
  ["rentbuy", 3, [["rbHorizon", "10"]]],
  ["drawdown", 8, [["ddStrategy", "guardrails"]]],
  ["roth", 4],
  ["debt", 3, [["click", '[data-dt="snowball"]']]],
  ["backtest", 3, [["click", '#segBTEra [data-era="30"]']]],
  ["healthcare", 4],
  ["fire", 3],
  ["bridge", 4],
];

for (const [slug, parts, tries] of TOURS)
  test(`${slug} help matches the current site`, async ({ page }, info) => {
    test.setTimeout(240_000);
    const oldPage = await page.context().newPage();
    const hide = ["#seoArticles", HIDE[slug]].filter(Boolean).join(",");
    await open(oldPage, `${OLD}/${slug}.html`, hide);
    await open(page, `${NEW}/${slug}`, hide);
    const both = async (steps: Step[]) => { await apply(oldPage, steps); await apply(page, steps); };
    await both([["click", "#toolHelpBtn"], ["until", "#thCoach"]]);
    await compareShown(oldPage, page, info, slug + " part 1", ["#thCoach"]);
    if (tries) {
      await both(tries);
      await compareShown(oldPage, page, info, slug + " tried", ["#thCoach"]);
      // on a phone, typing in the tool folds the panel down; open it again
      for (const p of [oldPage, page]) if (await p.locator("#thCoach.min").count()) await p.locator('#thCoach button[aria-expanded][aria-label$="the steps"]').click();
    }
    for (let i = 2; i <= parts; i++) {
      await both([["click", '#thCoach [data-tp="1"]'], ...(WAIT[`${slug} part ${i}`] || [])]);
      await compareShown(oldPage, page, info, `${slug} part ${i}`, ["#thCoach"]);
    }
    await both([["click", "#thCoachDone"]]);
    await compareShown(oldPage, page, info, slug + " closed", ["#toolBack"]);
  });
