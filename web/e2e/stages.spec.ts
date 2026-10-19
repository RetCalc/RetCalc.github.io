import { expect, test } from "@playwright/test";
import { NEW } from "../playwright.config";

const card = (i: number, f: string) => `#stageList [data-f='${f}'][data-i='${i}']`;

test("a stage can be renamed", async ({ page }) => {
  await page.goto(NEW + "/stages");
  await page.locator("#btnEditStages").click();
  const name = page.locator("#stageList [data-name='0']");
  await name.click();
  await page.keyboard.type("Early career");
  await page.keyboard.press("Enter");
  await expect(name).toHaveText("Early career");
  await page.keyboard.press("Escape");
  await expect(page.locator("#stageTable tbody tr")).toHaveCount(2);
});

test("Advanced hands its plan to Stages", async ({ page }) => {
  await page.goto(NEW + "/advanced");
  await page.locator("#years").fill("25");
  await page.locator("#btnToStages").click();
  await expect(page).toHaveURL(/\/stages$/);
  await page.locator("#btnEditStages").click();
  await expect(page.locator(card(0, "years"))).toHaveValue("25");
  await expect(page.locator(card(1, "years"))).toHaveValue("10");
  await expect(page.locator(".toast")).toContainText("Copied into two stages");
});
