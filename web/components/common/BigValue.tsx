"use client";

/* A headline figure. Its type steps down as the string gets longer, so a
   long result still fits the fixed-width column (setBig() in
   src/js/app/00-core.js), and a new value counts up or down to itself
   instead of jumping (the readout tween in 19-widgets-theme.js). */

import { useEffect, useRef } from "react";

const RE = /^([^\d]*)(\d[\d,]*(?:\.\d+)?)([\s\S]*)$/;
const MS = 240;

function sizeFor(text: string): number {
  const n = text.length;
  return n <= 11 ? 29 : n <= 13 ? 26 : n <= 15 ? 23 : n <= 17 ? 20 : n <= 20 ? 17 : 15;
}

function format(v: number, sample: string): string {
  const dot = sample.indexOf(".");
  let out = v.toFixed(dot < 0 ? 0 : sample.length - dot - 1);
  if (sample.includes(",")) {
    const parts = out.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    out = parts.join(".");
  }
  return out;
}

export function BigValue({ text, className = "v", id, sized = true }: { text: string; className?: string; id?: string; sized?: boolean | undefined }) {
  const el = useRef<HTMLDivElement>(null);
  const shown = useRef<{ num: number; pre: string } | null>(null);

  useEffect(() => {
    const node = el.current;
    const m = RE.exec(text);
    const from = shown.current;
    shown.current = m ? { num: parseFloat(m[2].replace(/,/g, "")), pre: m[1] } : null;
    if (!node) return;
    // Land on the new text first; an interrupted count must never leave an
    // old figure behind.
    node.textContent = text;
    if (!m || !from || from.pre !== m[1] || node.offsetParent === null) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const to = shown.current!.num;
    if (!isFinite(to) || to === from.num) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / MS);
      const e = 1 - Math.pow(1 - k, 3);
      node.textContent = k < 1 ? m[1] + format(from.num + (to - from.num) * e, m[2]) + m[3] : text;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text]);

  return (
    <div className={sized ? className + " text-(length:--fs)" : className} id={id} ref={el}
      style={sized ? { "--fs": sizeFor(text) + "px" } as React.CSSProperties : undefined}>
      {text}
    </div>
  );
}
