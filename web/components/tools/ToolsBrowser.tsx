"use client";

/* The tool list (/tools), shown one of two ways, chosen with the switch at
   its top and remembered in this browser (lib/tools-view.ts):

   - Charts: a card per tool with a small chart of what it shows, mostly
     the homepage's own charts (components/home/charts.tsx) on the homepage's
     figures, and the picker's own for the Backtest, Rent vs. Buy, College
     Savings and Debt Payoff (picker-charts.tsx). The Drawdown Simulator
     leads, wide. Each chart plays as the page opens and again when its card
     is pointed at, focused or tapped.
   - Compact: small tiles, one column per section, so every tool fits on one
     desktop screen.

   Both views are on the page; the stylesheet shows the remembered one from
   the first paint (styles/18-tool-picker.css), so a visit never flashes the
   other one first. */

import { useLayoutEffect } from "react";
import { TOOLS, TOOL_GROUPS, type ToolSub } from "@/lib/tools";
import { applyToolsView, setToolsView, useToolsView, type ToolsView } from "@/lib/tools-view";
import type { PickerData } from "./picker-data";
import { ToolCardLink } from "./ToolCardLink";
import { ToolIconTile } from "./ToolIcon";
import { Badge } from "@/components/ui/badge";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import {
  BridgeChart, BudgetChart, CloudChart, FanChart, FireChart, HealthChart, MortgageChart, RothChart, TaxChart, SocialChart
} from "@/components/home/charts";
import { BacktestSliders, CollegeStairs, DebtDownhill, RentBuyBlueprint } from "./picker-charts";

/** Each tool's chart, and how its bars grow when it plays (lines draw on their own). */
function chartFor(sub: ToolSub, data: PickerData): { chart: React.ReactNode; bars?: "up" | "across" } {
  switch (sub) {
    case "drawdown": return { chart: <FanChart fan={data.fan} /> };
    case "optimizer": return { chart: <CloudChart /> };
    case "social": return { chart: <SocialChart />, bars: "up" };
    case "bridge": return { chart: <BridgeChart />, bars: "across" };
    case "roth": return { chart: <RothChart />, bars: "up" };
    case "healthcare": return { chart: <HealthChart /> };
    case "fire": return { chart: <FireChart /> };
    case "backtest": return { chart: <BacktestSliders /> };
    case "college": return { chart: <CollegeStairs /> };
    case "rentbuy": return { chart: <RentBuyBlueprint buy={data.rentbuy.buy} rent={data.rentbuy.rent} /> };
    case "tax": return { chart: <TaxChart tax={data.tax} />, bars: "across" };
    case "budget": return { chart: <BudgetChart />, bars: "across" };
    case "mortgage": return { chart: <MortgageChart years={data.mortgage} />, bars: "up" };
    case "debt": return { chart: <DebtDownhill /> };
  }
}

/* The chart cards' layout, by section: the Drawdown Simulator wide with the
   Optimizer beside it, three across under them; then two across, where the
   homepage's wide charts (Rent vs. Buy, Income Tax) have room. */
const CHART_LAYOUT: Record<string, [ToolSub, "lead" | "third" | "half" | "quarter"][]> = {
  "Retirement income": [["drawdown", "lead"], ["optimizer", "third"], ["social", "quarter"], ["bridge", "quarter"], ["roth", "quarter"], ["healthcare", "quarter"]],
  "Saving and investing": [["rentbuy", "half"], ["fire", "half"], ["backtest", "half"], ["college", "half"]],
  "Everyday money": [["tax", "half"], ["budget", "half"], ["mortgage", "half"], ["debt", "half"]],
};

function Name({ sub }: { sub: ToolSub }) {
  const c = TOOLS[sub];
  return <div className="toolcard-name">{c.name}{c.badge ? <Badge variant="highlight" className="ml-1.75 align-middle">{c.badge}</Badge> : null}</div>;
}

function ChartCard({ sub, size, data, glide }: { sub: ToolSub; size: "lead" | "third" | "half" | "quarter"; data: PickerData; glide: boolean }) {
  const c = TOOLS[sub], { chart, bars } = chartFor(sub, data);
  const top = (
    <div className="toolcard-top">
      <ToolIconTile sub={sub} className="toolcard-icon" glide={glide} />
      <Name sub={sub} />
      <div className="toolcard-arrow">&#8250;</div>
    </div>
  );
  if (size === "lead") {
    return (
      <ToolCardLink href={`/${c.path}`} sub={sub} i={c.i} className="tp-card tp-lead" charted>
        {top}
        <div className="tp-lead-body">
          <div>
            <h3 className="tp-lead-q">{c.q}</h3>
            <p className="toolcard-desc">It retires you in every month since 1926, through the Depression, the 1970s and 2008, with 15 withdrawal strategies to compare.</p>
            <div className="tp-lead-read">
              <div className="tp-lead-v">{Math.round(data.lasted * 100)}%</div>
              <div className="toolcard-desc">of retirements since 1926 lasted 30 years at 4% per year</div>
            </div>
          </div>
          <div className="tp-chart">{chart}</div>
        </div>
      </ToolCardLink>
    );
  }
  return (
    <ToolCardLink href={`/${c.path}`} sub={sub} i={c.i} className={"tp-card tp-" + size} charted>
      {top}
      <div className="toolcard-desc">{c.q}</div>
      <div className="tp-chart" data-bars={bars}>{chart}</div>
    </ToolCardLink>
  );
}

function CompactTile({ sub, glide }: { sub: ToolSub; glide: boolean }) {
  const c = TOOLS[sub];
  return (
    <ToolCardLink href={`/${c.path}`} sub={sub} i={c.i} className="tp-tile">
      <ToolIconTile sub={sub} className="toolcard-icon" glide={glide} />
      <div className="tp-tile-text">
        <Name sub={sub} />
        <div className="toolcard-desc">{c.q}</div>
      </div>
      <div className="toolcard-arrow">&#8250;</div>
    </ToolCardLink>
  );
}


const VIEWS: [ToolsView, string, React.ReactNode][] = [
  ["charts", "Charts", <svg key="c" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="1.5" y="2" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="M4 11 7 8l2 1.5 3-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>],
  ["compact", "Compact", <svg key="t" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="1.5" y="2" width="5.5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.4" /><rect x="9" y="2" width="5.5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.4" /><rect x="1.5" y="9" width="5.5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.4" /><rect x="9" y="9" width="5.5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.4" /></svg>],
];

export function ToolsBrowser({ data }: { data: PickerData }) {
  const view = useToolsView();
  // Arriving by a link inside the site, the inlined script hasn't run.
  useLayoutEffect(() => applyToolsView(), []);
  return (
    <div className="toolcards">
      {/* The page's h1 ("Financial Planning Calculators") is read by search
          engines and screen readers (PageShell); this is its visible face,
          so it is hidden from screen readers. Set like a tool's own header
          (toolhead-*). */}
      <div className="tp-head">
        <div>
          <p className="toolhead-name" aria-hidden="true">Tools</p>
        </div>
        <div className="tp-switch">
          <Segmented role="group" aria-label="Show the tools as">
            {VIEWS.map(([v, label, icon]) => (
              <SegmentedItem key={v} pressed={view === v} onClick={() => setToolsView(v)} data-view={v}>{icon}{label}</SegmentedItem>
            ))}
          </Segmented>
        </div>
      </div>

      <div className="tp-charts">
        {TOOL_GROUPS.map((g) => (
          <section className="toolgroup" aria-label={g.label} key={g.label}>
            <h2 className="toolgroup-h"><span>{g.title}</span></h2>
            <div className="tp-grid">
              {CHART_LAYOUT[g.label].map(([sub, size]) => <ChartCard key={sub} sub={sub} size={size} data={data} glide={view === "charts"} />)}
            </div>
          </section>
        ))}
      </div>

      <div className="tp-compact">
        {TOOL_GROUPS.map((g) => (
          <section className="tp-col" aria-label={g.label} key={g.label}>
            <h2 className="toolgroup-h"><span>{g.title}</span></h2>
            {g.cards.map((c) => <CompactTile key={c.sub} sub={c.sub} glide={view === "compact"} />)}
          </section>
        ))}
      </div>
    </div>
  );
}
