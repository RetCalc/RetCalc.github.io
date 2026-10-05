"use client";

/* The top bar: the brand, the saved-scenario controls, and the household
   and theme buttons. Markup from src/page.html. */

import { useHousehold } from "@/components/household/HouseholdProvider";
import { setThemeChoice, useTheme } from "@/lib/theme";
import { Brandmark } from "./Brandmark";

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
          {/* Saved scenarios, sharing and reset act on the open tool; each
              is wired up as its tool is ported (phases 3 to 5). */}
          <div className="scgroup">
            <select id="scenarioPick" aria-label="Saved scenarios"><option>No saved scenarios</option></select>
            <button className="btn" id="btnScenario" type="button" aria-label="Save or delete a scenario" title="Save or delete"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 3.5h9.5l2.5 2.5v10.5H4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M7 3.5v4h6v-4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M7 16.5v-5h6v5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg></button>
            <button className="btn" id="btnShareMenu" type="button" aria-label="Share" title="Share"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 12.5V3M6.5 6.2L10 2.8l3.5 3.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M6.5 9H5v8h10V9h-1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
            <button className="btn" id="btnReset" type="button" aria-label="Reset to defaults" title="Reset"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4.2 8.2A6 6 0 1 1 4 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M3.6 4v4.4H8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
          </div>
          <HouseholdButton />
          <ThemeButton />
        </div>
      </div>
    </header>
  );
}
