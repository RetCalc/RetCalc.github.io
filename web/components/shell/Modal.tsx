"use client";

/* A dialog over the page: Escape or a click outside closes it, Tab stays
   inside it, and focus goes back to whatever opened it. The menu popup, the
   contribution converter and the per-account growth rates all use it. From
   wireModal() in src/js/app/23-scenarios.js. */

import { useEffect, useRef } from "react";

const FOCUSABLE = "button,select,input,textarea,a[href],[tabindex]:not([tabindex='-1'])";

interface Props {
  onClose: () => void;
  className?: string;
  /** What gets focus when it opens (a selector inside the dialog). */
  focus?: string;
  children: React.ReactNode;
}

export function Modal({ onClose, className = "popup", focus, children }: Props) {
  const pop = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const first = focus ? pop.current?.querySelector<HTMLElement>(focus) : null;
    first?.focus();
    if (first instanceof HTMLInputElement) first.select();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
        return;
      }
      if (e.key !== "Tab" || !pop.current) return;
      const items = [...pop.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
        .filter((el) => !(el as HTMLButtonElement).disabled && el.offsetParent !== null);
      if (!items.length) return;
      const a = items[0], z = items[items.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      opener?.focus?.();
    };
  }, [focus]);
  return (
    <div className="popup-overlay" onClick={(e) => e.target === e.currentTarget && close.current()}>
      <div className={className} role="dialog" aria-modal="true" ref={pop}>{children}</div>
    </div>
  );
}

/** A dialog's title row, with its close button. */
export function ModalTop({ title, onClose }: { title: React.ReactNode; onClose: () => void }) {
  return (
    <div className="sg-top"><h3>{title}</h3><button type="button" className="sg-close" aria-label="Close" onClick={onClose}>&times;</button></div>
  );
}
