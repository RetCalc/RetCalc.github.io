"use client";

/* A small menu dialog: a title, a list of choices, Cancel. Resolves with the
   chosen index, or -1 when dismissed (Cancel, Escape, a click outside).
   Ported from showPopup() in src/js/app/24-strategy-guide.js. */

import { createContext, use, useCallback, useState } from "react";
import { Modal } from "./Modal";

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

function PopupDialog({ open, close }: { open: Open; close: (i: number) => void }) {
  return (
    <Modal onClose={() => close(-1)} focus=".popbtn">
      <h3>{open.title}</h3>
      {open.options.map((o, i) => (
        <button key={o.label} className="popbtn" onClick={() => close(i)}>
          {o.label}
          {o.desc ? <span className={o.money ? "subdesc money" : "subdesc"}>{o.desc}</span> : null}
        </button>
      ))}
      <button className="cancel" onClick={() => close(-1)}>Cancel</button>
    </Modal>
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
