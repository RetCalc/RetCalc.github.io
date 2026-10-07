"use client";

/* The pieces both compare pages build their slots from: the slot's key
   (its chart color and letter), the row its pickers sit on, a message under
   them, and the slot's reading (one figure at Display size, with what sets
   it against the first slot under it). The slots are peers, so nothing here
   is amber. */

import type { ReactNode } from "react";
import { CircleAlertIcon } from "lucide-react";
import { BigValue } from "@/components/common/BigValue";
import { MULTI_COLORS } from "@/components/charts/MultiChart";
import { useRouter } from "next/navigation";
import { compareNav } from "@/lib/compare-nav";
import { setNavDir } from "@/lib/nav-motion";
import { Button } from "@/components/ui/button";
import { CMP_LETTERS } from "./model";
import { cn } from "@/lib/utils";

/** A slot's color swatch and letter, as the chart and tables name it. */
export function SlotKey({ i, className }: { i: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-note font-semibold text-foreground", className)}>
      <i className="inline-block size-2.5 rounded-xs bg-(--swatch)" style={{ "--swatch": MULTI_COLORS[i] } as React.CSSProperties} aria-hidden="true"></i>
      {CMP_LETTERS[i]}
    </span>
  );
}

/** One slot: its key and pickers on one row, then a message or its reading. */
export function SlotRow({ i, pickers, children }: { i: number; pickers: ReactNode; children?: ReactNode }) {
  return (
    <div className="border-t border-border px-4.5 py-4 first:border-t-0 max-sm:px-4" data-slot-i={i}>
      <div className="flex items-center gap-2.5">
        <SlotKey i={i} className="w-7 shrink-0" />
        {pickers}
      </div>
      {children ? <div className="mt-3 pl-9.5 max-sm:pl-0">{children}</div> : null}
    </div>
  );
}

/** Why a slot is empty: the field's error treatment (icon and message). */
export function SlotError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p className="m-0 flex items-start gap-2 text-note text-destructive" id={id}>
      <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/** A quiet line in a slot's reading space (an optional slot left empty). */
export function SlotHint({ children }: { children: ReactNode }) {
  return <p className="m-0 text-note text-muted-foreground">{children}</p>;
}

const TONE = { text: "text-foreground", gain: "text-gain", loss: "text-destructive" } as const;

/** The slot's figure: Label above, the value at Display size, and what
    sets it against the first slot under it. */
export function SlotFigure({ id, label, value, tone = "text", icon, children }: {
  id: string; label: ReactNode; value: string; tone?: keyof typeof TONE; icon?: ReactNode; children?: ReactNode;
}) {
  return (
    <div className="min-w-0" data-pair>
      <span className="block text-label text-muted-foreground" data-k>{label}</span>
      <div className={cn("flex items-center gap-2", TONE[tone])}>
        {icon}
        <BigValue className="text-3xl leading-tight font-medium whitespace-nowrap tabular-nums sm:text-display" id={id} text={value} sized={false} />
      </div>
      {children ? <div className="mt-1 flex flex-wrap items-baseline gap-x-2">{children}</div> : null}
    </div>
  );
}

/** A second figure under the first: a difference, or a companion result. */
export function SlotSecond({ value, note }: { value?: string; note: ReactNode }) {
  return (
    <>
      {value ? <span className="text-xl leading-tight font-medium whitespace-nowrap text-foreground tabular-nums">{value}</span> : null}
      <span className="text-label text-muted-foreground">{note}</span>
    </>
  );
}

/** The page's heading row: back to the calculator it was opened from, the
    title and its one line. */
export function CompareHead({ id, backId, title, children }: { id?: string; backId: string; title: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <div className="col-span-full" id={id}>
      <Button variant="ghost" size="sm" className="-ml-2" id={backId} onClick={() => { setNavDir("back"); router.push(compareNav.path); }}>
        <i className="arw back" aria-hidden="true"></i>Back
      </Button>
      <h2 className="mt-2 mb-1 text-2xl leading-tight font-semibold tracking-tight">{title}</h2>
      <div className="max-w-copy text-note text-muted-foreground">{children}</div>
    </div>
  );
}

