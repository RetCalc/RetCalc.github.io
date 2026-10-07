"use client";

/* The hero reading (DESIGN.md, Headline readout, "Hero reading"): a page
   whose main result clearly dominates shows it alone at about twice
   Display size, with its Label above and note below, and the secondary
   figures at Display size beside it. From 1100px (`wide`) the top is two
   zones: the hero on the left; behind a hairline, the secondary figures side
   by side, spread across the rest of the width and centered vertically
   against the hero. Narrower, they sit under the hero behind a Rule.

   Built from the homepage (tools/basic/Basic.tsx), the first page to use
   it. Figures go through BigValue, so the headline count-up is unchanged,
   and each pair carries data-pair / data-k so the results are announced
   to screen readers (PageEffects). */

import type { ReactNode } from "react";
import { BigValue } from "./BigValue";
import { useNarrow } from "@/components/charts/useNarrow";
import { cn } from "@/lib/utils";
import { DASH } from "@/lib/format";

export interface ReadingFigure {
  label: ReactNode;
  id: string;
  value: string;
  note?: ReactNode;
  noteId?: string;
  labelId?: string;
  /** Under the figure, above its note (a change against a baseline, say). */
  extra?: ReactNode;
  /** An id for the figure's whole block. */
  wrapId?: string;
  /** A secondary that is a rating keeps its rating's color (with a glyph
      and a word in its note, per the Never Alone Rule); others are Text. */
  tone?: Exclude<HeroTone, "answer">;
}

/** The hero's color: amber when it's the page's answer (the Four Places
    Rule), or a rating's gain / loss / plain text, as the three-figure
    readout colors ratings. */
export type HeroTone = "answer" | "gain" | "loss" | "text";

const TONE: Record<HeroTone, string> = {
  answer: "text-primary",
  gain: "text-gain",
  loss: "text-destructive",
  text: "text-foreground",
};

export function HeroReading({ hero, tone = "answer", sized = true, figures = [], under = false, className, children }: {
  hero: ReadingFigure;
  tone?: HeroTone;
  /** False while the value is a dash: it then keeps the readout's own size. */
  sized?: boolean;
  figures?: ReadingFigure[];
  /** Keep the secondary figures under the hero at every width (three
      secondaries beside a wide hero would wrap into a ragged stack). */
  under?: boolean;
  className?: string;
  /** Anything that belongs under the hero in its zone (a badge, a link). */
  children?: ReactNode;
}) {
  const narrow = useNarrow();
  // An empty reading (the hero a dash at the secondaries' size): its labels
  // line up along the top instead of the secondaries centering on the hero.
  const placeholder = !sized && hero.value === DASH;
  return (
    <div className={cn("px-5.5 pt-6.5 pb-5 max-sm:px-4 max-sm:pt-5", !under && "wide:flex wide:items-start wide:gap-8", className)} data-readout>
      <div className={cn("min-w-0", !under && "wide:shrink-0")} data-pair>
        <div className={cn("text-label text-muted-foreground", !placeholder && "mb-2.5")} id={hero.labelId} data-k>{hero.label}</div>
        {/* A placeholder dash takes the secondary figures' size and spacing,
            so every dash in an empty reading looks alike and lines up. */}
        <BigValue className={cn("font-medium tracking-tight whitespace-nowrap tabular-nums", placeholder ? "text-3xl leading-tight sm:text-display" : "leading-none", TONE[tone])}
          id={hero.id} text={hero.value} sized={sized} scale={narrow ? 1.5 : 2} />
        <div className="mt-2.5 min-h-4 text-label text-muted-foreground" id={hero.noteId}>{hero.note}</div>
        {children}
      </div>
      {figures.length ? (
        <div className={cn("mt-5 flex flex-wrap gap-x-12 gap-y-3 border-t border-border pt-4", under ? "sm:justify-between sm:gap-x-8"
          : "wide:mt-0 wide:min-w-0 wide:flex-1 wide:justify-evenly wide:gap-x-8 wide:self-stretch wide:border-t-0 wide:border-l wide:pt-0 wide:pl-8", !under && (placeholder ? "wide:items-start" : "wide:items-center"))}>
          {figures.map((f) => (
            <div key={f.id} id={f.wrapId} data-pair>
              <span className="block text-label text-muted-foreground" id={f.labelId} data-k>{f.label}</span>
              <BigValue className={cn("text-3xl leading-tight font-medium tabular-nums sm:text-display", f.tone && TONE[f.tone])} id={f.id} text={f.value} sized={false} />
              {f.extra}
              {f.note != null ? <span className="block text-label text-muted-foreground" id={f.noteId}>{f.note}</span> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Phones and narrow screens (below 1024px): a compact copy of the reading
    that leads the inputs and stays under the tab rail while they're on
    screen. It repeats figures shown below, so screen readers skip it. Put
    it first inside the inputs column's wrapper, so it unpins where the
    inputs end. The page's scroll padding grows by its height (00-base.css),
    so a field scrolled into view isn't left under it. */
/* The two values share the last baseline; a dash on the right takes the main
   value's size, so an empty reading shows one dash style. */
export function PinnedReading({ main, side, tone = "answer" }: {
  main: { label: ReactNode; value: string };
  side?: { label: ReactNode; value: string };
  tone?: HeroTone;
}) {
  return (
    <div className="sticky top-(--navh) z-20 mb-3.5 flex items-baseline-last justify-between gap-4 rounded-(--r-panel) border border-border bg-card px-4 py-3 lg:hidden" aria-hidden="true" data-pinned-reading>
      <div className="min-w-0">
        <span className="block text-label text-muted-foreground">{main.label}</span>
        <b className={cn("block text-2xl leading-tight font-medium whitespace-nowrap tabular-nums", TONE[tone])}>{main.value}</b>
      </div>
      {side ? (
        <div className="text-right">
          <span className="block text-label text-muted-foreground">{side.label}</span>
          <span className={cn("block leading-tight font-medium whitespace-nowrap tabular-nums", side.value === DASH ? "text-2xl" : "text-body")}>{side.value}</span>
        </div>
      ) : null}
    </div>
  );
}

/** What a total is made of, as shares of one thin bar, with a matching
    swatch for each part's label (labels carry the meaning; the swatches
    only echo the bar). Colors by token: "start" (Rule Strong), "in"
    (Muted), "gain" (Gain, for real growth only); parts that are only
    categories (an asset mix's holdings) take the chart series in their
    order: "sky", "teal", "lavender", "gray". "answer" (Signal Amber) marks
    the part that is the page's key result (Budget's left over). */
export type PartTone = "start" | "in" | "gain" | "answer" | "sky" | "teal" | "lavender" | "gray";
const PART: Record<PartTone, string> = {
  start: "bg-input", in: "bg-muted-foreground", gain: "bg-gain", answer: "bg-primary",
  sky: "bg-series-sky", teal: "bg-series-teal", lavender: "bg-series-lavender", gray: "bg-series-gray",
};

export function CompositionBar({ parts }: { parts: { share: number; tone: PartTone }[] }) {
  return (
    <div className="mb-2 flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
      {parts.map((p, i) => (
        <i key={i} className={cn("block h-full w-(--w)", PART[p.tone])} style={{ "--w": Math.max(0, p.share) * 100 + "%" } as React.CSSProperties} />
      ))}
    </div>
  );
}

/** The swatch in front of a part's label, matching CompositionBar. */
export function PartKey({ tone }: { tone: PartTone }) {
  return <i className={cn("mr-2 inline-block size-2.5 rounded-xs", PART[tone])} aria-hidden="true" />;
}
