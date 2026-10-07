"use client";

/* The three zones every card has, in a fixed order (doc 1, "The shell";
   doc 2, parts 4 to 6): Learn, one idea with its figure and links; Your
   numbers, at most three fields with More detail for the rest; and What
   this means, the live readout in the person's own figures. */

import { useId, type ReactNode } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDownIcon } from "lucide-react";

export function Learn({ children }: { children: ReactNode }) {
  const id = useId();
  return <section className="gd-zone gd-learn" aria-labelledby={id}><h3 className="gd-zone-h" id={id}>Learn</h3>{children}</section>;
}

/** The fields; `more` folds under "More detail". */
export function Numbers({ children, more, moreLabel = "More detail", moreOpen }: { children: ReactNode; more?: ReactNode; moreLabel?: string; moreOpen?: boolean }) {
  const id = useId();
  return (
    <section className="gd-zone gd-nums" aria-labelledby={id}>
      <h3 className="gd-zone-h" id={id}>Your numbers</h3>
      {children}
      {more ? (
        <div className="gd-more-detail"><Collapsible defaultOpen={moreOpen}>
          <CollapsibleTrigger data-more="">{moreLabel}<ChevronDownIcon aria-hidden="true" /></CollapsibleTrigger>
          <CollapsibleContent>{more}</CollapsibleContent>
        </Collapsible></div>
      ) : null}
    </section>
  );
}

/** The readout. `stale` while the worker works on newer figures: the last
    ones stay, quietly marked "updating" (busy, for a screen reader, rather
    than announced on every keystroke). */
export function Means({ children, stale }: { children: ReactNode; stale?: boolean }) {
  const id = useId();
  return (
    <section className={"gd-zone gd-means" + (stale ? " stale" : "")} aria-labelledby={id} aria-busy={stale || undefined}>
      <h3 className="gd-zone-h" id={id}>What this means{stale ? <span className="gd-upd">updating</span> : null}</h3>
      {children}
    </section>
  );
}
