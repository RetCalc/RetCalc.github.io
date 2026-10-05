"use client";

/* The one-page summary: built on demand into a light-themed sheet that only
   the print stylesheet shows (styles/07-print-sheet.css), so the browser's
   own "Save as PDF" does the export. printSheet() puts a page's summary in
   and opens the print dialog once it's drawn. From 10-summary-sheets.js. */

import { useEffect, useSyncExternalStore } from "react";

let content: React.ReactNode = null, pending = false;
const listeners = new Set<() => void>();

/** Prints this as the page's summary sheet. */
export function printSheet(node: React.ReactNode) {
  content = node;
  pending = true;
  listeners.forEach((l) => l());
}

export function SheetHost() {
  const node = useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => content, () => null);
  useEffect(() => {
    if (!pending) return;
    pending = false;
    const t = setTimeout(() => window.print(), 60);
    return () => clearTimeout(t);
  }, [node]);
  return <div id="sheet" aria-hidden="true">{node}</div>;
}

/** The logo beside a summary's title, in the deeper light-theme hues so it
    holds up on paper. */
export function SheetMark() {
  return (
    <svg className="sh-mark" viewBox="4 4 56 56" aria-hidden="true"><g transform="rotate(-45 32 32)">
      <path d="M33 7 L11.5 28.5 M33 57 L11.5 35.5" fill="none" stroke="#5a81c3" strokeWidth="2" />
      <path d="M33 7 C31 10 34 13 39 17 Q53 32 39 47 C34 51 31 54 33 57" fill="none" stroke="#2a9e73" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 32 H51" stroke="#c1861e" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M60 32 L48 25.5 L50.5 32 L48 38.5 Z M11 32 L6 25.5 H11 L18 32 Z M11 32 L6 38.5 H11 L18 32 Z" fill="#c1861e" /></g></svg>
  );
}

/** A label and its figure, as each summary lists them. */
export const SheetRow = ({ k, v }: { k: React.ReactNode; v: React.ReactNode }) => <div className="sh-r"><span>{k}</span><b>{v}</b></div>;
