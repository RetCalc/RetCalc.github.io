"use client";

/* Carries Basic's answers into Stages, the way Advanced hands its plan on:
   Basic's numbers become Advanced's (as OpenInAdvanced does), and those
   become two stages, the plan as entered and then ten more years of it
   (tools/advanced/toStages.ts). */

import { useToast } from "@/components/shell/Toast";
import { useToolNav, useToolStore } from "@/components/tools/ToolState";
import { BASIC_INFL } from "@/lib/engine/typed";
import { ADVANCED_DEFAULTS, advancedFields, advancedPlan } from "@/tools/advanced/model";
import { toStages } from "@/tools/advanced/toStages";
import { basicInput, type BasicInputs } from "./model";
import { Button } from "@/components/ui/button";

export function OpenInStages({ basic }: { basic: BasicInputs }) {
  const store = useToolStore(), go = useToolNav(), toast = useToast();
  return (
    <Button variant="secondary" id="btnToStagesQ"
      onClick={() => {
        const p = basicInput(basic);
        const infl = BASIC_INFL as number;
        const nominal = (1 + p.real) * (1 + infl) - 1;
        const s = {
          ...ADVANCED_DEFAULTS,
          ...advancedFields({ initial: p.initial, contrib: p.contrib, period: p.period, growth: infl, gross: nominal, nominal,
            inflation: infl, years: Math.max(1, p.years), withdrawal: 0.04, taxRate: 0.1, vol: 0.15, fees: 0 }),
        };
        const out = toStages(advancedPlan(s, null), s, null, store);
        if (!out) return;
        go("/stages");
        toast(out);
      }}>Open these numbers in Stages</Button>
  );
}
