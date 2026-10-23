"use client";

/* Calculator: Advanced, or Stages, filled in from the dashboard: balances
   by account, saving by account and how it grows, the match, the
   assumptions and the years to retirement; Stages also with the children,
   their costs taking from saving in the years they run. What's changed
   here stays here. */

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { CalculatorIcon } from "lucide-react";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import type { ToolInputs } from "@/components/tools/ToolState";
import { Frame } from "./Frame";
import { advancedFor, planKidsOf, stagesFor } from "./calc";
import { budgetFor, taxFor } from "./flows";
import { Hosted } from "./host";
import { useDashboard } from "./store";
import { Tile } from "./ui";

const Advanced = dynamic(() => import("@/tools/advanced/Advanced").then((m) => m.Advanced), { ssr: false });
const Stages = dynamic(() => import("@/tools/stages/Stages").then((m) => m.Stages), { ssr: false });

export function Calculator() {
  const { data } = useDashboard();
  const pr = data.profile;
  const [view, setView] = useState<"advanced" | "stages">("advanced");
  const kids = planKidsOf(pr);
  // Built as the calculator opens; the dashboard isn't changed by it.
  const seed = useMemo(() => {
    const adv = advancedFor(pr, data.entries) as unknown as ToolInputs, st = stagesFor(pr, data.entries) as unknown as ToolInputs;
    return (id: string): ToolInputs | undefined => (id === "advanced" ? adv : id === "stages" ? st : id === "tax" ? (taxFor(pr) as unknown as ToolInputs) : id === "budget" ? (budgetFor(pr) as unknown as ToolInputs) : undefined);
  }, [pr, data.entries]);
  return (
    <Frame current="calculator" title="Calculator" sub="Filled in from your dashboard. Changes here stay in the calculator.">
      <Tile icon={CalculatorIcon} title={view === "advanced" ? "Advanced" : "Stages"} right={
        <Segmented aria-label="Which calculator">
          <SegmentedItem pressed={view === "advanced"} onPressedChange={() => setView("advanced")}>Advanced</SegmentedItem>
          <SegmentedItem pressed={view === "stages"} onPressedChange={() => setView("stages")}>Stages</SegmentedItem>
        </Segmented>
      }>
        <p className="dsh-cap dsh-mt6">
          {view === "advanced"
            ? "One plan to retirement: your balances and saving by account, the match, and how each grows."
            : kids ? "Your plan in stages, with your children: their costs come out of saving in the years they run. Edit them under Planning for kids." : "Your plan in stages. Add stages for changes ahead, or children under Planning for kids."}
        </p>
      </Tile>
      <div className="dsh-r4">
        <Hosted key={view} household={null} seed={seed}>{view === "advanced" ? <Advanced /> : <Stages />}</Hosted>
      </div>
    </Frame>
  );
}
