"use client";

/* The readiness guide's charts, and the Plan Optimizer's: drawn at the
   width they actually have (so labels stay legible on a phone), redrawn
   when it changes, with a tooltip for the point under the pointer, a
   finger, or the arrow keys. From opHover() in
   src/js/app/31b-plan-optimizer.js and gdChartDraw() in 28-guide-core.js. */

import { useLayoutEffect, useRef, useState } from "react";
import { useScrub } from "./ChartFrame";

export interface GdDrawing {
  H: number;
  /** How many points can be shown, and where each sits across the chart. */
  n: number;
  xAt: (i: number) => number;
  /** The drawing, given the point shown (for its highlight), or null. */
  body: (hover: number | null) => React.ReactNode;
  tip: (i: number) => React.ReactNode;
  /** Where the arrow keys start when nothing is shown yet. */
  start?: number;
  /** Anything under the drawing, inside the chart (a note on what's off the scale). */
  after?: React.ReactNode;
}

export function GdChart({ className = "gd-chart", minW = 300, fallbackW = 700, draw, ...attrs }: {
  className?: string; minW?: number; fallbackW?: number; draw: (W: number) => GdDrawing;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "className"> & Record<`data-${string}`, string>) {
  const [width, setWidth] = useState(0);
  const [cur, setCur] = useState<number | null>(null);
  const el = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const W = Math.max(minW, width || fallbackW);
  const D = draw(W);

  const nearest = (cx: number) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < D.n; i++) {
      const d = Math.abs(D.xAt(i) - cx);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };
  const at = (clientX: number) => {
    const b = svgRef.current?.getBoundingClientRect();
    if (b?.width) setCur(nearest(((clientX - b.left) / b.width) * W));
  };
  const hide = () => setCur(null);
  const scrub = useScrub(el, at, hide);
  const shown = cur != null ? Math.max(0, Math.min(D.n - 1, cur)) : null;

  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    setWidth(node.clientWidth);
    const ro = new ResizeObserver(() => setWidth(node.clientWidth));
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  // The tooltip beside the point, on whichever side has room.
  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!tip || shown == null) return;
    const x = D.xAt(shown), tw = tip.offsetWidth;
    tip.style.left = Math.max(0, Math.min(W - tw, x > W / 2 ? x - tw - 14 : x + 14)) + "px";
  });

  return (
    <div className={className} ref={el} tabIndex={0} {...attrs} {...scrub}
      onKeyDown={(e) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
        e.preventDefault();
        const last = D.n - 1;
        if (e.key === "Home") setCur(0);
        else if (e.key === "End") setCur(last);
        else setCur((c) => Math.max(0, Math.min(last, (c == null ? D.start ?? 0 : c) + (e.key === "ArrowRight" ? 1 : -1))));
      }}
      onBlur={hide}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${D.H}`} width={W} height={D.H} aria-hidden="true"
        onPointerMove={(e) => { if (e.pointerType !== "touch") at(e.clientX); }}
        onPointerLeave={(e) => { if (e.pointerType !== "touch") hide(); }}>
        {D.body(shown)}
      </svg>
      <div className="gd-tip" ref={tipRef} hidden={shown == null}>{shown != null ? D.tip(shown) : null}</div>
      {D.after}
    </div>
  );
}
