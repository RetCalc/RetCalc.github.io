"use client";

/* The top bar: the brand, the saved-scenario controls, and the household
   and theme buttons. Markup from src/page.html. */

import { useHousehold } from "@/components/household/HouseholdProvider";
import { setThemeChoice, useTheme } from "@/lib/theme";
import { Brandmark } from "./Brandmark";
import { ScenarioBar } from "./ScenarioBar";

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

function ThemeButton() {
  const theme = useTheme();
  // The button offers whichever theme isn't showing. Before hydration the
  // theme isn't known yet, so it renders empty, as the old site's did.
  const goingLight = theme === "dark";
  const label = theme ? (goingLight ? "Switch to light theme" : "Switch to dark theme") : "Switch theme";
  return (
    <button className="btn iconbtn" id="btnTheme" type="button" aria-label={label} title={theme ? label : undefined}
      onClick={() => setThemeChoice(goingLight ? "light" : "dark")}>
      {theme ? (goingLight ? SUN : MOON) : null}
    </button>
  );
}

function HouseholdButton() {
  const { shown, setShown } = useHousehold();
  const label = shown ? "Hide your household bar" : "Show your household bar";
  return (
    <button className="btn iconbtn" id="btnHousehold" type="button" aria-pressed={shown} aria-label={label} title={label}
      onClick={() => {
        setShown(!shown);
        if (!shown) window.scrollTo({ top: 0, behavior: "smooth" });
      }}>
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3.2 9.2L10 3.6l6.8 5.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M5.2 8v8.2h9.6V8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M8.4 16.2v-4.3h3.2v4.3" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
    </button>
  );
}

export function Masthead() {
  return (
    <header>
      <div className="masthead">
        <div className="brand">
          <Brandmark />
          <div className="wordmark">
            <div className="brandname">RetCalc</div>
            <div className="tagline">Know your number.</div>
          </div>
        </div>
        <div className="scenariobar">
          <ScenarioBar />
          <HouseholdButton />
          <ThemeButton />
        </div>
      </div>
    </header>
  );
}
