/* The household profile filling tools in, on the new site alone: the old
   site filled every tool at once, the new one fills each when it's next
   opened (MIGRATION.md), so the moment differs but the numbers must not. */
import { expect, test } from "@playwright/test";
import { NEW } from "../playwright.config";
import { HOUSEHOLD_TOOLS, type Household } from "../lib/household";

/* What the form below enters. */
const PROFILE: Household = { status: "m", age: 45, spouseAge: null, retire: null, state: "CA", saved: null, monthly: null,
  income: 150000, income2: 60000, spend: null };

test("a saved household fills the tools that take it", async ({ page }) => {
  // About has the household form open; elsewhere it's a panel from the header or a tool bar.
  await page.goto(NEW + "/about");
  await page.locator("#hhStatus").selectOption("m");
  await page.locator("#hhAge").fill("45");
  await page.locator("#hhState").selectOption("CA");
  await page.locator("#hhIncome").fill("150000");
  await page.locator("#hhIncome2").fill("60000");
  await page.locator("#hhFill").click();
  // Every tool that takes this profile, in the order the site lists them.
  const filled = HOUSEHOLD_TOOLS.filter((t) => t.takes(PROFILE)).map((t) => t.name);
  await expect(page.locator("#toast")).toContainText(`Filled in ${filled.length} tools: ${filled.join(", ")}`);

  await page.goto(NEW + "/tools");
  await page.locator("a.toolcard[data-pick=tax]:visible").click();
  await expect(page.locator("#txStatus")).toHaveValue("m");
  await expect(page.locator("#txGross")).toHaveValue("150,000");
  await expect(page.locator("#txGross2")).toHaveValue("60,000");
  await expect(page.locator("#txState")).toHaveValue("CA");

  // The Budget's pay lives on its Paycheck tab: the household's gross pay.
  await page.goto(NEW + "/budget");
  await page.locator('#segBgView [data-bgview="paycheck"]').click();
  await expect(page.locator("#pcGross")).toHaveValue("150,000");

  // Edits after the fill stay put when the tool is opened again.
  await page.locator("#pcGross").fill("1000");
  await page.locator("#btnToolBack").click();
  await page.locator("a.toolcard[data-pick=budget]:visible").click();
  await page.locator('#segBgView [data-bgview="paycheck"]').click();
  await expect(page.locator("#pcGross")).toHaveValue("1,000");
});
