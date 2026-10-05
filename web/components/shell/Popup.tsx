"use client";

/* A small menu dialog: a title, a list of choices, Cancel. Resolves with the
   chosen index, or -1 when dismissed (Cancel, Escape, a click outside).
   Escape closes it, Tab stays inside it, and focus goes back to whatever
   opened it. Ported from showPopup() and wireModal() in
   src/js/app/24-strategy-guide.js and 23-scenarios.js. */

import { createContext, use, useCallback, useEffect, useRef, useState } from "react";

export interface PopupOption {
  label: string;
  desc?: string;
  /** Set the description as a dollar figure. */
  money?: boolean;
}
type ShowPopup = (title: string, options: PopupOption[]) => Promise<number>;

const PopupContext = createContext<ShowPopup>(() => Promise.resolve(-1));

export function usePopup(): ShowPopup {
  return use(PopupContext);
}

interface Open {
  title: string;
  options: PopupOption[];
  resolve: (i: number) => void;
}

const FOCUSABLE = "button,select,input,textarea,a[href],[tabindex]:not([tabindex='-1'])";

function PopupDialog({ open, close }: { open: Open; close: (i: number) => void }) {
  const pop = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    pop.current?.querySelector<HTMLButtonElement>(".popbtn")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(-1);
        return;
      }
      if (e.key !== "Tab" || !pop.current) return;
      const items = [...pop.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      opener?.focus?.();
    };
  }, [close]);
  return (
    <div className="popup-overlay" onClick={(e) => e.target === e.currentTarget && close(-1)}>
      <div className="popup" role="dialog" aria-modal="true" ref={pop}>
        <h3>{open.title}</h3>
        {open.options.map((o, i) => (
          <button key={o.label} className="popbtn" onClick={() => close(i)}>
            {o.label}
            {o.desc ? <span className={o.money ? "subdesc money" : "subdesc"}>{o.desc}</span> : null}
          </button>
        ))}
        <button className="cancel" onClick={() => close(-1)}>Cancel</button>
      </div>
    </div>
  );
}

export function PopupProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<Open | null>(null);
  const show = useCallback<ShowPopup>(
    (title, options) => new Promise((resolve) => setOpen({ title, options, resolve })),
    [],
  );
  const close = useCallback((i: number) => {
    setOpen((cur) => {
      cur?.resolve(i);
      return null;
    });
  }, []);
  return (
    <PopupContext value={show}>
      {children}
      {open ? <PopupDialog open={open} close={close} /> : null}
    </PopupContext>
  );
}
