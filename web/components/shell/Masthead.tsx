"use client";

/* The header's brand (a link home) and theme button, used by NavBar, which
   is the whole header. Markup from src/page.html. */

import Link from "next/link";
import { setThemeChoice, useTheme } from "@/lib/theme";
import { Brandmark } from "./Brandmark";
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

/** The logo and name, linking to the homepage. */
export function BrandLink({ tagline = true }: { tagline?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="RetCalc home">
      <Brandmark />
      <div className="wordmark">
        <div className="brandname">RetCalc</div>
        {tagline ? <div className="tagline">The complete retirement planning toolkit.</div> : null}
      </div>
    </Link>
  );
}
