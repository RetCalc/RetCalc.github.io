import { test } from "@playwright/test";
import { compareTool } from "./compare";

const kid = (n: number, field: string) => `#clKids .clkid:nth-child(${n}) ${field}`;

test("college savings matches the current site", async ({ page }, info) => {
  await compareTool(page, info, "college", ["#asideCollege", "#tab-college"], [
    { name: "defaults", steps: [] },
    { name: "private school, saved already", steps: [["clPreset", "59000"], ["clSaved", "25000"], ["clYears", "10"]] },
    { name: "custom cost and returns", steps: [["clPreset", "0"], ["clCost", "41000"], ["clReturn", "4.5"], ["clInfl", "5"], ["clCollegeYrs", "5"]] },
    { name: "two children", steps: [["click", "#clAddKid"]] },
    { name: "three children, one removed", steps: [["click", "#clAddKid"], ["click", "#clAddKid"], [kid(3, "input[data-f='years']"), "3"], [kid(2, "select"), "82000"], ["click", kid(1, ".stagehead button")]] },
    { name: "one year to go", steps: [["clYears", "1"], ["clSaved", "80000"]] },
  ]);
});
