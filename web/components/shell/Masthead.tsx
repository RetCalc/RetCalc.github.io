"use client";

/* The top bar: the brand (a link home), the saved-scenario controls, and
   the household and theme buttons. Markup from src/page.html. Pages with no
   tool leave out the scenario controls and the household button; a page
   with the one-row header has no masthead at all (NavBar carries the brand
   and theme button there). */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHousehold } from "@/components/household/HouseholdProvider";
import { hasToolControls, oneRowHeader, slugFromPath } from "@/lib/site";
import { setThemeChoice, useTheme } from "@/lib/theme";
import { Brandmark } from "./Brandmark";
import { ScenarioBar } from "./ScenarioBar";
import { Button } from "@/components/ui/button";

const SUN = (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="10" cy="10" r="3.6" stroke="currentColor" strokeWidth="1.7" />
    <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M10 1.6v2.2M10 16.2v2.2M18.4 10h-2.2M3.8 10H1.6M15.94 4.06l-1.56 1.56M5.62 14.38l-1.56 1.56M15.94 15.94l-1.56-1.56M5.62 5.62L4.06 4.06" /></g>
  </svg>
);
const MOON = (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M16.5 12.4A7 7 0 017.6 3.5a7 7 0 108.9 8.9z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);

export function ThemeButton() {
  const theme = useTheme();
  // The button offers whichever theme isn't showing. Before hydration the
  // theme isn't known yet, so it renders empty, as the old site's did.
  const goingLight = theme === "dark";
  const label = theme ? (goingLight ? "Switch to light theme" : "Switch to dark theme") : "Switch theme";
  return (
    <Button variant="outline" size="icon" id="btnTheme" aria-label={label} title={theme ? label : undefined}
      onClick={() => setThemeChoice(goingLight ? "light" : "dark")}>
      {theme ? (goingLight ? SUN : MOON) : null}
    </Button>
  );
}

function HouseholdButton() {
  const { shown, setShown } = useHousehold();
  const label = shown ? "Hide your household bar" : "Show your household bar";
  return (
    <Button variant="outline" size="icon" id="btnHousehold" aria-pressed={shown} aria-label={label} title={label}
      onClick={() => {
        setShown(!shown);
        if (shown) return;
        // The homepage offers the bar after its result, not at the top.
        if (location.pathname === "/calculator") requestAnimationFrame(() => document.getElementById("hhCard")?.scrollIntoView({ behavior: "smooth", block: "start" }));
        else window.scrollTo({ top: 0, behavior: "smooth" });
      }}>
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3.2 9.2L10 3.6l6.8 5.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M5.2 8v8.2h9.6V8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M8.4 16.2v-4.3h3.2v4.3" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
    </Button>
  );
}

/** The logo and name, linking to the homepage. */
export function BrandLink({ tagline = true }: { tagline?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="RetCalc home">
      <Brandmark />
      <div className="wordmark">
        <div className="brandname">RetCalc</div>
        {tagline ? <div className="tagline">Know your number.</div> : null}
      </div>
    </Link>
  );
}

export function Masthead() {
  const slug = slugFromPath(usePathname());
  if (oneRowHeader(slug)) return null;
  const tool = hasToolControls(slug);
  return (
    <header>
      <div className="masthead">
        <BrandLink />
        <div className="scenariobar">
          {tool ? <ScenarioBar /> : null}
          {tool ? <HouseholdButton /> : null}
          <ThemeButton />
        </div>
      </div>
    </header>
  );
}
