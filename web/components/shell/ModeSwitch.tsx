"use client";

/* The calculator's two modes as a switch under its title, in place of the
   header menu it had: Basic and Advanced are one planner at two depths,
   each at its own address. The switch goes to the other address; the header's
   Calculator tab still reopens the mode last used. */

import { usePathname, useRouter } from "next/navigation";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { CALC_MODE_NAMES, CALC_PATHS, type CalcMode } from "@/lib/site";

const MODES: CalcMode[] = ["simple", "single"];

export function CalcSwitch() {
  const path = usePathname(), router = useRouter();
  return (
    <Segmented size="tab" role="group" aria-label="Calculator mode">
      {MODES.map((m) => {
        const href = CALC_PATHS[m], on = path === href;
        return (
          <SegmentedItem key={m} pressed={on} aria-current={on ? "page" : undefined}
            onMouseEnter={() => router.prefetch(href)} onPressedChange={() => { if (!on) router.push(href); }}>
            {CALC_MODE_NAMES[m]}
          </SegmentedItem>
        );
      })}
    </Segmented>
  );
}
