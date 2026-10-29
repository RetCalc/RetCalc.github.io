"use client";

/* Full screen for a chart: a button for its card's header, and the chart
   again over the whole page, drawn at the size it has there (one unit to
   a pixel, so its labels keep their size) with whatever goes under it (a
   legend). Escape or the button closes it. Not on phones or touch screens
   (styles/11-charts.css). Advanced's chart has its own, in Projection.tsx. */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MaximizeIcon, MinimizeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export type Px = { w: number; h: number };

/** The button, and the overlay to render beside the chart. `chart` draws
    the chart at a size; `under` goes below it in full screen. */
export function useFullScreen(title: string) {
  const [open, setOpen] = useState(false);
  const button = (
    <span className="chart-fullbtn">
      <Button variant="outline" size="icon" aria-label="Full screen" title="Full screen" onClick={() => setOpen(true)}><MaximizeIcon aria-hidden="true" /></Button>
    </span>
  );
  const overlay = (chart: (px: Px) => ReactNode, under?: ReactNode) =>
    open ? <FullOverlay title={title} chart={chart} under={under} close={() => setOpen(false)} /> : null;
  return { button, overlay };
}

function FullOverlay({ title, chart, under, close }: { title: string; chart: (px: Px) => ReactNode; under?: ReactNode; close: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [px, setPx] = useState<Px | null>(null);
  // The room the chart has: the box under the title and above what goes
  // under it, less the chart's own padding (.chartwrap: 16px top, 6px
  // bottom, 18px each side).
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const fit = () => {
      const w = Math.floor(el.clientWidth - 36), h = Math.floor(el.clientHeight - 22);
      setPx((p) => (p && Math.abs(p.w - w) < 2 && Math.abs(p.h - h) < 2 ? p : { w: Math.max(320, w), h: Math.max(240, h) }));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [close]);
  return createPortal(
    <div className="chart-full chart-full-any" role="dialog" aria-label={title + ", full screen"}>
      <div className="chart-full-head">
        <h2 className="m-0 text-base font-semibold">{title}</h2>
        <Button variant="outline" size="icon" aria-label="Close full screen" title="Close full screen" onClick={close}><MinimizeIcon aria-hidden="true" /></Button>
      </div>
      <div className="chart-full-host" ref={host}>{px ? chart(px) : null}</div>
      {under ? <div className="chart-full-under">{under}</div> : null}
    </div>,
    document.body,
  );
}
