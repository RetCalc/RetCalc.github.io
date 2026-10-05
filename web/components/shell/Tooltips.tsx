"use client";

/* The "?" explanations. A TipDot marks a term; hovering it with a mouse
   shows the explanation in a box beside it, and tapping it on a phone opens
   it as a sheet from the bottom, titled with the field's name. One listener
   here serves every dot on the page. Ported from src/js/app/19-widgets-theme.js
   and glueTipdots() in 01-inputs.js. */

import { useEffect, useRef, useState } from "react";

/* The explanations' text is fetched the first time a "?" is pointed at, not
   with every page: most visits never open one. */
let gloss: Record<string, string> | null = null;
const loadGloss = () => import("@/lib/glossary").then((m) => (gloss = m.GLOSS));
async function textFor(key: string | null): Promise<string> {
  return ((gloss ?? (await loadGloss()))[key ?? ""]) || "";
}

/** A "?" for glossary entry `k`. */
export function TipDot({ k, title }: { k: string; title?: string }) {
  return <span className="tipdot" data-tip={k} data-tip-title={title} role="button" tabIndex={0} aria-label="What is this?">?</span>;
}

/** Label text ending in a "?". The last word and the dot are kept together,
    so a narrow column never strands the dot alone on a line. */
export function Tipped({ text, k }: { text: string; k: string }) {
  const m = text.match(/^([\s\S]*?)(\S+\s*)$/);
  if (!m) return <TipDot k={k} />;
  return <>{m[1]}<span className="tipglue">{m[2]}<TipDot k={k} /></span></>;
}

const phone = () => window.matchMedia?.("(max-width:640px)").matches ?? false;

/* The sheet's title: the text before the dot in its label or heading,
   without the "optional" pill or other markers. */
function titleOf(dot: HTMLElement): string {
  const own = dot.getAttribute("data-tip-title");
  if (own) return own;
  let box = dot.closest("label, h2, h3, h4, th, dt, .k, .optlabel, .gd-h3, .acgroup") || dot.parentElement;
  if (box?.classList.contains("tipglue")) box = box.parentElement;
  if (!box) return "";
  try {
    const r = document.createRange();
    r.setStart(box, 0);
    r.setEndBefore(dot);
    const f = r.cloneContents();
    f.querySelectorAll(".tipdot,.opt,.beta,.about-chevron,.mssub,.h2note").forEach((x) => x.remove());
    return (f.textContent ?? "").replace(/\s+/g, " ").replace(/[\s:]+$/, "").trim().slice(0, 80);
  } catch {
    return "";
  }
}

export function Tooltips() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ text: string; left: number; top: number; placed: boolean } | null>(null);
  const [sheet, setSheet] = useState<{ title: string; text: string } | null>(null);
  const openDot = useRef<HTMLElement | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  // Measure the box once its text is in, then place it over the dot,
  // flipped below when there's no room above.
  useEffect(() => {
    if (!box || box.placed || !boxRef.current || !openDot.current) return;
    const r = openDot.current.getBoundingClientRect();
    const bw = boxRef.current.offsetWidth, bh = boxRef.current.offsetHeight;
    let left = r.left + r.width / 2 - bw / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - bw - 8));
    let top = r.top - bh - 10;
    if (top < 8) top = r.bottom + 10;
    setBox({ ...box, left, top, placed: true });
  }, [box]);

  useEffect(() => {
    if (sheet) closeBtn.current?.focus({ preventScroll: true });
  }, [sheet]);

  useEffect(() => {
    const dotOf = (e: Event) => (e.target as Element).closest?.(".tipdot") as HTMLElement | null;
    const show = async (d: HTMLElement) => {
      const text = await textFor(d.getAttribute("data-tip"));
      if (!text) return;
      openDot.current?.classList.remove("on");
      d.classList.add("on");
      openDot.current = d;
      setBox({ text, left: 0, top: 0, placed: false });
    };
    const hide = () => {
      openDot.current?.classList.remove("on");
      openDot.current = null;
      setBox(null);
    };
    const over = (e: MouseEvent) => {
      const d = dotOf(e);
      if (d && !phone()) void show(d);
      // Fetch the text as soon as a pointer is near one, so it's there on arrival.
      else if (!gloss && (e.target as Element).closest?.(".field, .k, h2, th")) void loadGloss();
    };
    const out = (e: MouseEvent) => {
      const d = dotOf(e);
      if (d && d === openDot.current) hide();
    };
    const click = (e: MouseEvent) => {
      const d = dotOf(e);
      if (d && phone()) {
        e.preventDefault();
        hide();
        const title = titleOf(d) || "What this means";
        void textFor(d.getAttribute("data-tip")).then((text) => text && setSheet({ title, text }));
        return;
      }
      if (d) {
        e.preventDefault();
        if (d === openDot.current) hide();
        else void show(d);
      } else if (openDot.current) hide();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheet(null);
    };
    const scroll = () => {
      if (openDot.current) hide();
    };
    document.addEventListener("mouseover", over);
    document.addEventListener("mouseout", out);
    document.addEventListener("click", click);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", scroll, true);
    return () => {
      document.removeEventListener("mouseover", over);
      document.removeEventListener("mouseout", out);
      document.removeEventListener("click", click);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", scroll, true);
    };
  }, []);

  return (
    <>
      <div className={`tipbox${box ? " on" : ""}`} id="tipbox" role="tooltip" ref={boxRef}
        style={box ? { left: box.left, top: box.top, visibility: box.placed ? undefined : "hidden" } : undefined}>
        {box?.text}
      </div>
      {sheet ? (
        <>
          <div className="selscrim" onClick={() => setSheet(null)} />
          <div className="selmenu sheet tipsheet" role="dialog" aria-modal="true" aria-label={sheet.title}>
            <div className="selmenu-h">
              <span>{sheet.title}</span>
              <button type="button" className="tipsheet-x" aria-label="Close" ref={closeBtn} onClick={() => setSheet(null)}>
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
              </button>
            </div>
            <p className="tipsheet-b">{sheet.text}</p>
          </div>
        </>
      ) : null}
    </>
  );
}
