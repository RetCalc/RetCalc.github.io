import { expect, test, type Page } from "@playwright/test";
import { NEW } from "../playwright.config";

/* Unusual input and damaged data: the tools say what's wrong, or carry on,
   but never crash, show NaN or ∞, or quietly open other numbers. */

const link = (t: string, d: unknown) => "#s=" + Buffer.from(JSON.stringify({ t, d })).toString("base64url");
const noBadText = async (page: Page) => expect(page.locator("main")).not.toContainText(/NaN|Infinity|∞|undefined/);

test("a share link cut short says so", async ({ page }) => {
  await page.goto(NEW + "/mortgage" + link("mortgage", { price: "500,000" }).slice(0, 20));
  await expect(page.locator("#toast")).toContainText("incomplete or damaged");
});

test("a share link with a filing status the dropdown lacks still opens", async ({ page }) => {
  await page.goto(NEW + "/incometax" + link("tax", { status: "zzz", gross: "90,000" }));
  await expect(page.getByText("Something went wrong")).toHaveCount(0);
  await expect(page.locator("main")).toBeVisible();
  await noBadText(page);
});

test("damaged saved scenarios and household don't break the page", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("retcalc.scenarios-advanced.v1", '{"not":"a list"}');
    localStorage.setItem("retcalc.household.v1", '{"age":"forty","retire":null,"saved":"lots","state":7}');
  });
  await page.goto(NEW + "/advanced");
  await expect(page.locator("#scenarioPick")).toContainText("Nothing saved yet");
  await expect(page.getByText("Something went wrong")).toHaveCount(0);
  await noBadText(page);
});

test("a money field stops at 12 digits; a percent at 100", async ({ page }) => {
  await page.goto(NEW + "/advanced");
  await page.locator("#initial").fill("9999999999999999");
  await expect(page.locator("#initial")).not.toHaveValue(/9{13}/);
  await page.locator("#nominal").fill("5000");
  await expect(page.locator("#nominal")).toHaveValue("100");
  await noBadText(page);
});

test("a 0% withdrawal rate explains why there's no answer", async ({ page }) => {
  await page.goto(NEW + "/advanced");
  await page.locator("#withdrawal").fill("0");
  await expect(page.locator("#payWarnText")).toContainText("0% withdrawal rate");
  // Reach your target has no answer to offer, so neither button shows.
  await expect(page.locator("#reachCard")).toBeVisible();
  await expect(page.locator("#btnCoast, #btnRetire")).toHaveCount(0);
  await noBadText(page);
});
