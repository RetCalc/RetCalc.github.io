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
      <path d="M33 7 L11.5 28.5 M33 57 L11.5 35.5" fill="none" stroke="var(--color-print-steel)" strokeWidth="2" />
      <path d="M33 7 C31 10 34 13 39 17 Q53 32 39 47 C34 51 31 54 33 57" fill="none" stroke="var(--color-print-jade)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 32 H51" stroke="var(--color-print-gold)" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M60 32 L48 25.5 L50.5 32 L48 38.5 Z M11 32 L6 25.5 H11 L18 32 Z M11 32 L6 38.5 H11 L18 32 Z" fill="var(--color-print-gold)" /></g></svg>
  );
}

/** Label-and-figure rows, as each summary lists them. */
export type SheetRows = [string, string][];

/** A label and its figure, as each summary lists them. */
export const SheetRow = ({ k, v }: { k: React.ReactNode; v: React.ReactNode }) => <div className="sh-r"><span>{k}</span><b>{v}</b></div>;

/** A summary's page: its title, the three headline figures, the chart
    copied off the screen, then sections, a table and the fine print. */
export function SheetPage({ title, sub, big, chart, children, foot }: {
  title: React.ReactNode; sub: React.ReactNode; big?: [k: React.ReactNode, v: React.ReactNode, n: React.ReactNode][];
  chart?: string; children: React.ReactNode; foot: React.ReactNode;
}) {
  return (
    <>
      <div className="sh-h"><SheetMark /><h1>{title}</h1><span>{sub}</span></div>
      {big ? <div className="sh-big">{big.map(([k, v, n], i) => <div key={i}><div className="k">{k}</div><div className="v">{v}</div><div className="n">{n}</div></div>)}</div> : null}
      {chart ? <SheetChart html={chart} /> : null}
      {children}
      <div className="sh-foot">{foot}</div>
    </>
  );
}
export const SheetChart = ({ html, className }: { html: string; className?: string }) =>
  <div className={"sh-chart" + (className ? " " + className : "")} dangerouslySetInnerHTML={{ __html: html }} />;
/** A section of label-and-figure rows. */
export const SheetSection = ({ t, rows, className }: { t: React.ReactNode; rows: [React.ReactNode, React.ReactNode][]; className?: string }) => (
  <section className={className}><div className="sh-t">{t}</div>{rows.map(([k, v], i) => <SheetRow key={i} k={k} v={v} />)}</section>
);
/** A year-by-year table, sampled so a long one stays on the page: every
    row up to 15, every other up to 30, every third beyond, always the
    first and last, and any `keep` asks for. */
export function sampled<T>(rows: T[], keep: (r: T) => boolean = () => false): T[] {
  const step = rows.length <= 15 ? 1 : rows.length <= 30 ? 2 : 3;
  return rows.filter((r, i) => i === 0 || i === rows.length - 1 || i % step === 0 || keep(r));
}
export function SheetTable({ t, head, rows }: { t: React.ReactNode; head: string[]; rows: (React.ReactNode[] | { cells: React.ReactNode[]; className?: string })[] }) {
  return (
    <div className="sh-table"><div className="sh-t">{t}</div>
      <table><thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => {
          const R = Array.isArray(r) ? { cells: r } : r;
          return <tr key={i} className={R.className}>{R.cells.map((c, j) => <td key={j}>{c}</td>)}</tr>;
        })}</tbody></table></div>
  );
}

