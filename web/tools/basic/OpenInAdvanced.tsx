"use client";

/* Carries Basic's answers into Advanced. Basic's real return is split back
   into a return and inflation, and its contribution, steady in today's
   dollars, becomes one that grows with inflation, so the two agree. */

import { useToast } from "@/components/shell/Toast";
import { useToolNav, useToolStore } from "@/components/tools/ToolState";
import { BASIC_INFL } from "@/lib/engine/typed";
import { pctStr } from "@/lib/format";
import { ADVANCED_DEFAULTS, advancedFields } from "@/tools/advanced/model";
import { basicInput, type BasicInputs } from "./model";
import { Button } from "@/components/ui/button";

export function OpenInAdvanced({ basic }: { basic: BasicInputs }) {
  // The site's own Advanced, or the scope's (the Dashboard's Tools).
  const store = useToolStore(), go = useToolNav();
  const toast = useToast();
  return (
    <Button id="btnUpgrade"
      onClick={() => {
        const p = basicInput(basic);
        const infl = BASIC_INFL as number;
        const nominal = (1 + p.real) * (1 + infl) - 1;
        store.write("advanced", {
          ...store.read("advanced", ADVANCED_DEFAULTS),
          ...advancedFields({ initial: p.initial, contrib: p.contrib, period: p.period, growth: infl, gross: nominal, nominal,
            inflation: infl, years: Math.max(1, p.years), withdrawal: 0.04, taxRate: 0.1, vol: 0.15, fees: 0 }),
        });
        go("/advanced");
        toast("Copied across, with " + pctStr(infl, 2) + " inflation and a 10% tax rate added");
      }}>Open these numbers in Advanced</Button>
  );
}
