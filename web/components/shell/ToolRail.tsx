"use client";

/* The tools' sidebar: every calculator, tool and walkthrough by name,
   grouped as the tool list groups them, beside the pages that hold a tool,
   from 1400px wide. Narrower screens reach the same pages through the tab
   rail and the tool list. The page in view is marked; a strategy page, /72t
   and /rmd mark the tool they open.

   It can be hidden: the button at its top folds it to a single button that
   brings it back. The choice is remembered in this browser and applied
   before the page paints (lib/tool-rail.ts, lib/tool-rail-script.ts). */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { CALC_MODE_NAMES, CALC_PATHS, TOOL_SUB, slugFromPath, type CalcMode, type Slug } from "@/lib/site";
import { TOOL_GROUPS, TOOLS } from "@/lib/tools";
import { setRailHidden, useRailHidden } from "@/lib/tool-rail";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CALC: CalcMode[] = ["simple", "single", "series"];
const GUIDES = [{ href: "/guide", name: "Readiness Guide" }, { href: "/guide/paycheck", name: "Paycheck to Retirement" }];

/** The pages the sidebar stands beside: the calculator's modes, Compare and every tool's page. */
export function hasRail(slug: Slug): boolean {
  return !!TOOL_SUB[slug] || slug === "calculator" || slug === "advanced" || slug === "stages" || (slug as string) === "compare";
}

export function ToolRail() {
  const path = usePathname();
  const hidden = useRailHidden();
  const showBtn = useRef<HTMLButtonElement>(null), hideBtn = useRef<HTMLButtonElement>(null);
  // Focus moves to the button that takes the other one's place.
  const toggle = (hide: boolean) => {
    setRailHidden(hide);
    (hide ? showBtn : hideBtn).current?.focus();
  };
  const slug = slugFromPath(path);
  if (!hasRail(slug)) return null;
  // The tool this page opens (a strategy page opens the Drawdown Simulator).
  const sub = TOOL_SUB[slug];
  const here = sub ? "/" + TOOLS[sub].path : path;
  const item = (href: string, name: string) => (
    <li key={href}>
      <Link href={href} aria-current={href === here ? "page" : undefined}
        className={cn("toolrail-link", href === here && "on")}>{name}</Link>
    </li>
  );
  // Each group's name labels its list (not a heading: the page's own
  // headings stay the page's outline).
  const group = (label: string, items: React.ReactNode[]) => {
    const id = "rail-" + label.toLowerCase().replace(/\W+/g, "-");
    return (
      <div key={label} className="toolrail-g">
        <div className="toolrail-h" id={id}>{label}</div>
        <ul aria-labelledby={id}>{items}</ul>
      </div>
    );
  };
  return (
    <nav className="toolrail" aria-label="All tools">
      {/* Both buttons are always in the page; the stylesheet shows the one
          that fits html[data-tool-rail], so the first paint is right. */}
      <span className="toolrail-show">
        <Button ref={showBtn} variant="ghost" size="icon-sm" aria-label="Show the tools list" title="Show the tools list"
          aria-expanded={!hidden} aria-controls="toolRailBody" onClick={() => toggle(false)}>
          <PanelLeftOpenIcon aria-hidden="true" />
        </Button>
      </span>
      <div className="toolrail-body" id="toolRailBody">
        <div className="toolrail-top">
          <Link href="/tools" className="toolrail-title">All tools</Link>
          <Button ref={hideBtn} variant="ghost" size="icon-sm" aria-label="Hide the tools list" title="Hide the tools list"
            aria-expanded={!hidden} aria-controls="toolRailBody" onClick={() => toggle(true)}>
            <PanelLeftCloseIcon aria-hidden="true" />
          </Button>
        </div>
        {group("Calculator", CALC.map((m) => item(CALC_PATHS[m], CALC_MODE_NAMES[m])))}
        {TOOL_GROUPS.map((g) => group(g.label, g.cards.map((c) => item("/" + c.path, c.name))))}
        {group("Walkthroughs", GUIDES.map((x) => item(x.href, x.name)))}
      </div>
    </nav>
  );
}
