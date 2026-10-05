import { test, type Page } from "@playwright/test";
import { NEW, OLD } from "../playwright.config";
import { apply, compareShown, open, type Step } from "./compare";

/* Compare reads saved scenarios, so both sites get the same ones, saved
   through the Save menu as a person would, then open Compare from it. */
async function save(page: Page, name: string) {
  page.once("dialog", (d) => d.accept(name));
  await page.locator("#btnScenario").click();
  await page.locator(".popbtn").nth(0).click();
  await page.waitForTimeout(200);
}

async function setUp(page: Page, base: string, ext: string) {
  const at = async (slug: string, steps: Step[], hide = "") => {
    await open(page, `${base}/${slug}${ext}`, hide);
    await apply(page, steps);
  };
  await at(ext ? "index" : "", []);
  await save(page, "Basic plan");
  await at("advanced", [["years", "25"]]);
  await save(page, "Plan A");
  await at("advanced", [["years", "35"], ["contrib", "900"], ["fees", "0.5"]]);
  await save(page, "Plan B");
  await at("stages", [["gInitial", "25000"]]);
  await save(page, "Staged");
  // The old site opened Compare in place, under the page's own article.
  await at("advanced", [], "#seoArticles");
  await page.locator("#btnScenario").click();
  await page.locator(".popbtn").nth(2).click();
  await page.waitForTimeout(400);
}

test("compare matches the current site", async ({ page }, info) => {
  const oldPage = await page.context().newPage();
  await setUp(oldPage, OLD, ".html");
  await setUp(page, NEW, "");
  const roots = ["#tab-compare"];
  await compareShown(oldPage, page, info, "two Advanced plans", roots);

  const steps: Step[] = [["[data-cmpmode='2']", "stages"], ["[data-cmp='2']", "Staged"]];
  await apply(oldPage, steps);
  await apply(page, steps);
  await compareShown(oldPage, page, info, "with a Stages plan", roots);

  const basic: Step[] = [["[data-cmpmode='0']", "basic"], ["[data-cmp='0']", "Basic plan"]];
  await apply(oldPage, basic);
  await apply(page, basic);
  await compareShown(oldPage, page, info, "against Basic", roots);
  await oldPage.close();
});

test("compare explains itself with nothing saved", async ({ page }, info) => {
  const oldPage = await page.context().newPage();
  for (const [p, url] of [[oldPage, OLD + "/advanced.html"], [page, NEW + "/advanced"]] as const) {
    await open(p, url, "#seoArticles");
    await p.locator("#btnScenario").click();
    await p.locator(".popbtn").nth(2).click();
    await p.waitForTimeout(400);
  }
  await compareShown(oldPage, page, info, "nothing saved", ["#tab-compare"]);
  await oldPage.close();
});

test("drawdown compare matches the current site", async ({ page }, info) => {
  test.setTimeout(240_000);
  const oldPage = await page.context().newPage();
  for (const [p, base, ext] of [[oldPage, OLD, ".html"], [page, NEW, ""]] as const) {
    await open(p, `${base}/drawdown${ext}`);
    await apply(p, [["click", "#segDDIn [data-ddin='adv']"], ["ddStarts", "year"]]);
    await save(p, "Four percent");
    await apply(p, [["ddStrategy", "guardrails"], ["ddRate", "5"]]);
    await save(p, "Guardrails");
    await open(p, `${base}/drawdown${ext}`, "#seoArticles");
    await p.locator("#btnScenario").click();
    await p.locator(".popbtn").nth(2).click();
    await p.waitForTimeout(600);
  }
  await compareShown(oldPage, page, info, "two drawdown plans", ["#tab-dd-compare"]);
  await oldPage.close();
});
