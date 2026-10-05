import { test } from "@playwright/test";
import { compareTool } from "./compare";

const retire: [string, string] = ["click", '#segTxMode [data-txmode="retire"]'];

test("income tax matches the current site", async ({ page }, info) => {
  await compareTool(page, info, "incometax", ["#asideTax", "#tab-tax"], [
    { name: "defaults", steps: [] },
    { name: "married, two earners, California", steps: [["txStatus", "m"], ["txGross", "185000"], ["txGross2", "92000"], ["txState", "CA"]] },
    { name: "take-home with pre-tax savings", steps: [["txPre", "23000"], ["click", '#segTxView [data-view="take"]'], ["txState", "NY"]] },
    { name: "itemized, high income", steps: [["txGross", "640000"], ["txDedType", "item"], ["txItem", "52000"], ["txState", "NJ"]] },
    { name: "no income tax state", steps: [["txState", "TX"], ["txGross", "48000"]] },
    { name: "no income", steps: [["txGross", "0"]] },
    { name: "retirement defaults", steps: [retire] },
    { name: "retirement, married, both 65", steps: [retire, ["txStatus", "m"], ["txSeniors", "2"], ["txState", "PA"], ["txPension", "28000"], ["txPenType", "pub"]] },
    { name: "retirement, big gain, NIIT", steps: [retire, ["txBrok", "400000"], ["txGainPct", "70"], ["txTrad", "120000"], ["txState", "CO"]] },
    { name: "retirement, gain inside the 0% band", steps: [retire, ["txTrad", "15000"], ["txSS", "24000"], ["txState", "FL"]] },
    { name: "retirement, nothing withdrawn", steps: [retire, ["txTrad", "0"], ["txRoth", "0"], ["txBrok", "0"], ["txSS", "0"]] },
    { name: "back to single after both 65", steps: [retire, ["txStatus", "m"], ["txSeniors", "2"], ["txStatus", "s"], ["txState", "MD"]] },
  ]);
});
