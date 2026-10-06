"use client";

/* What the header's Share menu can make for the page that's open: its
   printable one-page summary and its square image card. A tool hands them
   over with useShareKit(); the menu offers only what the page has. The
   card is drawn as SVG, turned into a PNG through a canvas, and saved or
   copied; nothing leaves the browser. From 10-summary-sheets.js and
   25-share-card.js in src/js/app. */

import { useEffect, useRef } from "react";

/** A square card of the page's headline numbers. */
export interface CardData {
  title: string; sub: string; bigLabel: string; big: string;
  rows: [label: string, value: string][];
  verdict?: string;
  /** A chart on the page to copy onto the card, at this size. */
  chart?: { sel: string; w: number; h: number };
}
export interface ShareKit {
  /** The page's own link, in place of the inputs link (the guide's plan). */
  link?: { run: () => void; title: string; desc: [sheet: string, copy: string] };
  /** The one-page summary; text instead says why there isn't one yet. */
  sheet?: () => React.ReactNode | string;
  sheetLabel?: [label: string, desc: string];
  card?: () => CardData | string;
}

/* On a phone with a share sheet, offer it; elsewhere copy the link. */
export function canShareSheet() {
  try {
    return !!navigator.share && window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}
/** Sends a link: the phone's share sheet, or copied with `copied` said. */
export function sendLink(url: string, copied: string, toast: (m: string) => void) {
  const copy = () => navigator.clipboard.writeText(url).then(() => toast(copied)).catch(() => { prompt("Copy this link:", url); });
  if (!canShareSheet()) { void copy(); return; }
  navigator.share({ url }).catch((err) => { if (err?.name !== "AbortError") void copy(); });
}

const kits: Record<string, ShareKit> = {};
/** What this page offers to the Share menu, kept current as it changes. */
export function useShareKit(id: string, kit: ShareKit) {
  const latest = useRef(kit);
  useEffect(() => {
    latest.current = kit;
  });
  useEffect(() => {
    kits[id] = {
      link: latest.current.link && { ...latest.current.link, run: () => latest.current.link!.run() },
      sheetLabel: latest.current.sheetLabel,
      sheet: latest.current.sheet && (() => latest.current.sheet!()),
      card: latest.current.card && (() => latest.current.card!()),
    };
    return () => { delete kits[id]; };
  }, [id]);
}
export const shareKit = (id: string): ShareKit | undefined => kits[id];

/* ---- copying a chart off the page ----
   Charts draw their structural lines in the theme's colors, so a copy for
   the light printed page, or the dark card, has those swapped for a fixed
   palette; any other color the theme sets is fixed at what it is now. */
const STRUCTURAL = ["--ds-muted", "--grid", "--axis", "--stageline", "--dotstroke", "--bg", "--gold", "--jade", "--steel", "--coral",
  "--ds-series-plan", "--ds-series-sky", "--ds-series-teal", "--ds-series-rose", "--ds-series-lavender", "--ds-series-gray",
  "--ds-gain", "--ds-loss"] as const;
type Palette = Record<(typeof STRUCTURAL)[number], string>;
/* The data hues go out as the dark theme's, on either palette. Charts name
   their colors by series (lib/hues.ts); each series goes out as the hue it
   took over from, so the card and the printed summary look as they did. */
const HUES = {
  "--gold": "#e9b872", "--jade": "#4fbf95", "--steel": "#7d9fd6", "--coral": "#e2795f",
  "--ds-series-plan": "#e9b872", "--ds-series-sky": "#7d9fd6", "--ds-series-teal": "#4fbf95", "--ds-series-rose": "#e2795f",
  "--ds-series-lavender": "#a98fd6", "--ds-series-gray": "#8ba0ac", "--ds-gain": "#4fbf95", "--ds-loss": "#e2795f",
  "--ds-muted": "#8b97ad",
};
export const PRINT_PALETTE: Palette = { "--grid": "#e2e5e3", "--axis": "#666e73", "--stageline": "#9aa5ab", "--dotstroke": "#ffffff", "--bg": "#ffffff", ...HUES };
export const CARD_PALETTE: Palette = { "--grid": "#1c2740", "--axis": "#7f8eaa", "--stageline": "#4a5a7b", "--dotstroke": "#080b16", "--bg": "#151e33", ...HUES };

function recolor(node: Element, pal: Palette) {
  const css = getComputedStyle(document.documentElement);
  const now: Record<string, string> = {};
  STRUCTURAL.forEach((v) => { now[css.getPropertyValue(v).trim().toLowerCase()] = pal[v]; });
  const resolve = (s: string) => s.replace(/var\((--[\w-]+)\)/g, (_, v: string) => (pal as Record<string, string>)[v] ?? css.getPropertyValue(v).trim());
  const walk = (el: Element) => {
    for (const a of ["stroke", "fill", "stop-color"]) {
      const v = el.getAttribute(a);
      if (!v) continue;
      const r = resolve(v);
      el.setAttribute(a, now[r.toLowerCase()] ?? r);
    }
    const st = el.getAttribute("style");
    if (st && st.includes("var(")) el.setAttribute("style", resolve(st));
    for (const c of Array.from(el.children)) walk(c);
  };
  walk(node);
}
/** The chart's markup, recolored for the page or card it's going on; ""
    when the page hasn't drawn it. */
export function copyChart(sel: string, pal: Palette = PRINT_PALETTE): string {
  const src = document.querySelector(sel);
  if (!src || !src.childNodes.length) return "";
  const clone = src.cloneNode(true) as Element;
  recolor(clone, pal);
  clone.removeAttribute("style");
  clone.removeAttribute("class");
  return clone.outerHTML;
}

/* ---- the card ---- */
const esc = (t: string) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* The chart goes in as a plain group scaled from its own viewBox: nested
   SVG scaling doesn't survive the trip through an image reliably. */
function embedChart(sel: string, w: number, h: number): string {
  const src = document.querySelector(sel);
  if (!src || !src.childNodes.length) return "";
  const vb = (src.getAttribute("viewBox") || "0 0 900 340").split(/\s+/).map(Number);
  const clone = src.cloneNode(true) as Element;
  recolor(clone, CARD_PALETTE);
  return '<g transform="scale(' + w / (vb[2] || 900) + "," + h / (vb[3] || 340) + ')">' + clone.innerHTML + "</g>";
}

export function cardSVG(d: CardData): string {
  const W = 1080, H = 1350;
  // The site's own dark palette, so a shared card looks like the site. (Web
  // fonts can't load inside an SVG drawn as an image, so the faces are the
  // closest system ones.)
  const bg = "#080b16", panel = "#151e33", line = "#26314b";
  const text = "#e8edf7", dim = "#94a6bf", gold = "#e9b872", jade = "#4fbf95", steel = "#7d9fd6";
  const mono = "ui-monospace, SF Mono, Menlo, monospace", sans = "Helvetica Neue, Helvetica, Arial, sans-serif";
  // The bow and arrow, 64px, in the header's top-right corner.
  const logo = '<g transform="translate(926 90) scale(1.1429) translate(-4 -4)"><g transform="rotate(-45 32 32)">' +
    '<path d="M33 7 L11.5 28.5 M33 57 L11.5 35.5" fill="none" stroke="' + steel + '" stroke-width="2"/>' +
    '<path d="M33 7 C31 10 34 13 39 17 Q53 32 39 47 C34 51 31 54 33 57" fill="none" stroke="' + jade + '" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M7 32 H51" stroke="' + gold + '" stroke-width="3.2" stroke-linecap="round"/>' +
    '<path d="M60 32 L48 25.5 L50.5 32 L48 38.5 Z" fill="' + gold + '"/>' +
    '<path d="M11 32 L6 25.5 H11 L18 32 Z M11 32 L6 38.5 H11 L18 32 Z" fill="' + gold + '"/></g></g>';
  // Top to bottom: header, headline, chart (if any), rows, footer; a card
  // without a chart gets a longer list rather than a gap.
  const chartSvg = d.chart ? embedChart(d.chart.sel, d.chart.w, d.chart.h) : "", chartW = d.chart?.w ?? 900, chartH = chartSvg ? d.chart!.h : 0;
  const chartY = 268, rowsY = chartH > 0 ? chartY + chartH + 40 : chartY + 30;
  const chartBlock = chartSvg
    ? '<rect x="90" y="' + chartY + '" width="900" height="' + chartH + '" rx="10" fill="' + bg + '" stroke="' + line + '"/>' +
      '<g transform="translate(' + (90 + (900 - chartW) / 2) + "," + chartY + ')">' + chartSvg + "</g>"
    : "";
  let y = rowsY;
  const rowSvg = d.rows.map(([k, v]) => {
    const block = '<text x="90" y="' + y + '" font-family="' + sans + '" font-size="27" fill="' + dim + '">' + esc(k) + "</text>" +
      '<text x="990" y="' + y + '" font-family="' + mono + '" font-size="29" font-weight="600" fill="' + text + '" text-anchor="end">' + esc(v) + "</text>" +
      '<line x1="90" y1="' + (y + 22) + '" x2="990" y2="' + (y + 22) + '" stroke="' + line + '" stroke-width="1"/>';
    y += 76;
    return block;
  }).join("");
  const verdict = d.verdict ? '<text x="90" y="' + (y + 10) + '" font-family="' + sans + '" font-size="24" fill="' + jade + '" font-weight="600">' + esc(d.verdict) + "</text>" : "";
  const footY = H - 60;
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '">' +
    '<defs><radialGradient id="cg" cx="12%" cy="4%" r="70%"><stop offset="0" stop-color="' + jade + '" stop-opacity=".14"/><stop offset="1" stop-color="' + jade + '" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="ce" x1="0" x2="1"><stop offset="0" stop-color="' + jade + '" stop-opacity="0"/><stop offset=".35" stop-color="' + jade + '" stop-opacity=".7"/><stop offset=".65" stop-color="' + gold + '" stop-opacity=".7"/><stop offset="1" stop-color="' + gold + '" stop-opacity="0"/></linearGradient></defs>' +
    '<rect width="' + W + '" height="' + H + '" fill="' + bg + '"/>' +
    '<rect x="40" y="40" width="1000" height="' + (H - 80) + '" rx="28" fill="' + panel + '" stroke="' + line + '"/>' +
    '<rect x="40" y="40" width="1000" height="' + (H - 80) + '" rx="28" fill="url(#cg)"/>' +
    '<rect x="100" y="40" width="880" height="2" fill="url(#ce)"/>' + logo +
    '<text x="90" y="140" font-family="' + sans + '" font-size="34" font-weight="600" fill="' + text + '">' + esc(d.title) + "</text>" +
    '<text x="90" y="182" font-family="' + sans + '" font-size="24" fill="' + dim + '">' + esc(d.sub) + "</text>" +
    '<text x="90" y="243" font-family="' + sans + '" font-size="22" fill="' + dim + '">' + esc(d.bigLabel) + "</text>" +
    '<text x="990" y="243" font-family="' + mono + '" font-size="68" font-weight="700" fill="' + gold + '" text-anchor="end">' + esc(d.big) + "</text>" +
    chartBlock + rowSvg + verdict +
    '<line x1="90" y1="' + (footY - 20) + '" x2="990" y2="' + (footY - 20) + '" stroke="' + line + '" stroke-width="1"/>' +
    '<text x="90" y="' + footY + '" font-family="' + sans + '" font-size="20" fill="' + dim + '">Projections, not predictions. Not financial advice.</text>' +
    '<text x="990" y="' + (footY - 1) + '" font-family="' + sans + '" font-size="22" text-anchor="end"><tspan fill="' + gold + '">Know your number.</tspan><tspan dx="12" font-weight="600" fill="' + jade + '">retcalc.app</tspan></text>' +
    "</svg>";
}

/** The card as a PNG. */
export function cardPNG(d: CardData): Promise<Blob | null> {
  return new Promise((done) => {
    const url = URL.createObjectURL(new Blob([cardSVG(d)], { type: "image/svg+xml;charset=utf-8" }));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = 1080; c.height = 1350;
      c.getContext("2d")!.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      c.toBlob((b) => done(b), "image/png");
    };
    img.onerror = () => { URL.revokeObjectURL(url); done(null); };
    img.src = url;
  });
}

/* A phone's share sheet is what offers "Save to Photos", so it's used
   whenever the browser can share a file; a plain download otherwise. */
export async function saveCard(d: CardData, toast: (m: string) => void) {
  const b = await cardPNG(d);
  if (!b) { toast("Couldn't build the image"); return; }
  const file = new File([b], "retirement-summary.png", { type: "image/png" });
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = "retirement-summary.png";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("Image saved");
  };
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file] }).catch((err) => { if (err?.name !== "AbortError") download(); });
    return;
  }
  download();
}
export async function copyCard(d: CardData, toast: (m: string) => void) {
  if (!navigator.clipboard || !window.ClipboardItem) {
    toast("Your browser can't copy images. Downloading instead.");
    return saveCard(d, toast);
  }
  const b = await cardPNG(d);
  if (!b) { toast("Couldn't build the image"); return; }
  navigator.clipboard.write([new ClipboardItem({ "image/png": b })])
    .then(() => toast("Image copied to clipboard"))
    .catch(() => { toast("Copy blocked. Downloading instead."); void saveCard(d, toast); });
}
