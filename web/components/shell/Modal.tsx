"use client";

/* A dialog over the page: shadcn's Dialog (components/ui/dialog.tsx, Base
   UI). Escape or a click outside closes it, Tab stays inside it, and focus
   goes back to whatever opened it. Focus is kept in without locking the
   page's scroll ("trap-focus"), as before. The menu popup, the
   contribution converter, the per-account growth rates and the Drawdown
   and Backtest dialogs all use it. From wireModal() in
   src/js/app/23-scenarios.js. */

import { useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  onClose: () => void;
  size?: "default" | "wide" | "guide" | "study";
  /** What gets focus when it opens (a selector inside the dialog); a text
      field's contents are selected too. */
  focus?: string;
  children: React.ReactNode;
}

export function Modal({ onClose, size, focus, children }: Props) {
  const pop = useRef<HTMLDivElement>(null);
  return (
    <Dialog open modal="trap-focus" onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size={size} ref={pop} initialFocus={() => {
        const first = focus ? pop.current?.querySelector<HTMLElement>(focus) : null;
        if (first instanceof HTMLInputElement) requestAnimationFrame(() => first.select());
        return first ?? true;
      }}>{children}</DialogContent>
    </Dialog>
  );
}

/** A dialog's title row, with its close button. */
export function ModalTop({ title, onClose }: { title: React.ReactNode; onClose: () => void }) {
  return (
    <div className="sg-top"><h3>{title}</h3><Button variant="ghost" size="icon-sm" className="-mt-1 -mr-2" aria-label="Close" data-modal-x onClick={onClose}>&times;</Button></div>
  );
}
