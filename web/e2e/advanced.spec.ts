import { test } from "@playwright/test";
import { compareTool, type Case } from "./compare";

const cases: Case[] = [
  { name: "defaults", steps: [] },
  { name: "glide path, fees", steps: [["click", "#glideToggle .glidebtn-check"], ["fees", "1"], ["nominal", "7"], ["glideYears", "8"]] },
  { name: "monthly, flat contributions, 40 years", steps: [["period", "Monthly"], ["contrib", "750"], ["growth", "0"], ["years", "40"]] },
  { name: "negative return", steps: [["click", "#asideSingle .signflip"], ["inflation", "2"]] },
  { name: "portfolio value target", steps: [["solveFor", "Portfolio Value"], ["target", "2000000"]] },
  { name: "split by account", steps: [["click", "#acToggle .glidebtn-check"], ["acRothC", "200"], ["acBrokBal", "50000"], ["acSalary", "90000"], ["acMatchPct", "50"], ["acStatus", "m"], ["acState", "CA"]] },
  { name: "growth by account", steps: [["click", "#acToggle .glidebtn-check"], ["acRothC", "150"], ["click", "#acGrowthBtn"], ["#gr_r", "6"], ["click", "[data-gr='apply']"]] },
  { name: "split back to one total", steps: [["click", "#acToggle .glidebtn-check"], ["acBrokC", "100"], ["click", "#acToggle .glidebtn-check"]] },
  { name: "rate band", steps: [["band", "3.5"]] },
  { name: "market history", steps: [["click", "#segSingle [data-mode='hist']"], ["histMix", "60"]] },
  { name: "market history, glide", steps: [["click", "#glideToggle .glidebtn-check"], ["click", "#segSingle [data-mode='hist']"], ["histMixEnd", "30"]] },
  { name: "Monte Carlo", steps: [["click", "#segSingle [data-mode='mc']"], ["volatility", "20"]] },
  { name: "use the solved contribution", steps: [["target", "150000"], ["click", "#btnApply"]] },
  { name: "use the solved timeline", steps: [["click", "#btnApplyYears"]] },
  { name: "converter", steps: [["click", "#convOpen"], ["click", "#convOut button[data-period='Monthly']"]] },
];

test("advanced calculator matches the current site", async ({ page }, info) => {
  await compareTool(page, info, "advanced", ["#asideSingle", "#tab-single"], cases);
});
