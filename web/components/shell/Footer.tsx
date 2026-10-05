"use client";

/* The site footer. Markup from src/page.html. */

import { useRouter } from "next/navigation";
import { Brandmark } from "./Brandmark";

const LINKS = [
  { label: "Guide", foot: "guide", href: "/guide" },
  { label: "Calculator", foot: "calc", href: "/" },
  { label: "Tools", foot: "tools", href: "/tools" },
  { label: "About", foot: "about", href: "/about" },
];

export function Footer() {
  const router = useRouter();
  return (
    <footer className="sitefoot">
      <div className="sitefoot-in">
        <div className="sitefoot-brand">
          <Brandmark />
          <div><b>RetCalc</b><span>Know your number.</span></div>
        </div>
        <div className="sitefoot-txt">
          <p>An educational tool, not financial or tax advice. Past returns don&apos;t predict future ones, and tax figures are estimates.{" "}
            <button type="button" className="sitefoot-link" id="footDisclaimer" onClick={() => router.push("/about#disclaimer")}>Read the full disclaimer</button></p>
          {/* The address is put together on click, so it never sits in the
              page for scrapers to collect. */}
          <p>Found a bug, or a number that looks off?{" "}
            <a className="sitefoot-link mailme" href="#"
              onClick={(e) => {
                e.preventDefault();
                window.location.href = "mailto:" + ["contact", "retcalc.app"].join("@");
              }}>contact [at] retcalc.app</a></p>
          <p className="src">Market history: Robert Shiller&apos;s dataset (Yale) and the US Bureau of Labor Statistics, 1926 to 2025. Taxes: 2026 federal and state rules. Healthcare: KFF&apos;s 2026 averages.</p>
        </div>
        <nav className="sitefoot-nav" aria-label="Site">
          {LINKS.map((l) => (
            <button key={l.foot} type="button" data-foot={l.foot}
              onClick={() => {
                router.push(l.href);
                window.scrollTo({ top: 0 });
              }}>{l.label}</button>
          ))}
        </nav>
      </div>
    </footer>
  );
}
