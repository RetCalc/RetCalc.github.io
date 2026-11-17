"use client";

/* A phone-only fold for blocks that can't be wrapped. PhoneFold
   (Words.tsx) wraps its block in display:contents elements, which hides the
   block's children from any CSS that selects them with `>`; the Clear Glass
   rules for an inputs card (styles/22-clear-glass.css, `aside > card >
   card-content > h3 ...`) do exactly that at every width. Here nothing is
   wrapped: the folded elements are marked data-fold="<name>", their
   container carries data-closed={folds.closed}, and <FoldToggle> is the row
   that opens them. On wide screens the row is display:none and the marks
   mean nothing.

     const folds = useFolds(["more"]);
     <CardContent data-closed={folds.closed}>
       <FoldToggle label="More options" sub="Property tax, insurance" open={folds.isOpen("more")} onToggle={() => folds.toggle("more")} />
       <div data-fold="more">...</div>

   styles/phone/05-words.css hides what is closed for the names "more",
   "a", "b", "c", "d" and "e"; a tool that wants other names adds its own
   rule ([data-closed~="x"] [data-fold="x"]{display:none}). */

import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";

/** Which folds are closed, as the value for the content element's data-closed. */
export function useFolds(names: string[]) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const closed = names.filter((n) => !open[n]).join(" ");
  return { closed, isOpen: (n: string) => !!open[n], toggle: (n: string) => setOpen((o) => ({ ...o, [n]: !o[n] })) };
}

export function FoldToggle({ label, sub, open, onToggle }: { label: string; sub: string; open: boolean; onToggle: () => void }) {
  return (
    <div className="pfold phone:hidden" data-open={open ? "" : undefined}>
      <button type="button" className="pfold-t" aria-expanded={open} onClick={onToggle}>
        <span className="pfold-l"><b>{label}</b><small>{sub}</small></span>
        <ChevronDownIcon aria-hidden="true" />
      </button>
    </div>
  );
}
