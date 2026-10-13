"use client";

/* The theme switch (System, Dark, Light), as a settings row. On the About
   and Account pages. */
import { setThemeChoice, useThemeChoice, type ThemeChoice } from "@/lib/theme";
import { Segmented as SegmentedGroup, SegmentedItem } from "@/components/ui/segmented";

export function ThemeRow() {
  const choice = useThemeChoice();
  const opts: [ThemeChoice, string][] = [["system", "System"], ["dark", "Dark"], ["light", "Light"]];
  return (
    <div className="themerow">
      <span>Theme</span>
      {/* On a phone the switch (the chart size: 44px options sharing the
          width) takes the rest of the row. */}
      <div className="flex max-w-80 min-w-0 flex-1 justify-end sm:flex-none">
        <SegmentedGroup id="segTheme" size="chart">
          {opts.map(([k, label]) => <SegmentedItem key={k} data-theme={k} pressed={choice === k} onClick={() => setThemeChoice(k)}>{label}</SegmentedItem>)}
        </SegmentedGroup>
      </div>
    </div>
  );
}
