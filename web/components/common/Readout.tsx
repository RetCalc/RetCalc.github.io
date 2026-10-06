/* The small display pieces the tools share: a headline figure, a row of
   label and value, and a segmented switch. Same markup as the old site. */

import type { ReactNode } from "react";
import { BigValue } from "./BigValue";
import { Segmented as SegmentedGroup, SegmentedItem } from "@/components/ui/segmented";

/** One figure in a panel's headline: its label, the number, a note under it. */
/** `sized: false` leaves the figure at the CSS's own size (for a dash). */
export function Figure({ label, labelId, id, value, className, note, noteId, sized }:
  { label: ReactNode; labelId?: string; id: string; value: string; className?: string; note: ReactNode; noteId?: string; sized?: boolean }) {
  return (
    <div>
      <div className="k" id={labelId}>{label}</div>
      <BigValue className={className} id={id} text={value} sized={sized} />
      <div className="note" id={noteId}>{note}</div>
    </div>
  );
}

/** A label on the left, its value on the right. */
export function KV({ k, v, cls, id }: { k: ReactNode; v: ReactNode; cls?: string; id?: string }) {
  return (
    <div className="kv"><span className="k">{k}</span><span className={cls ? `v ${cls}` : "v"} id={id}>{v}</span></div>
  );
}

/** A row of buttons, one of them on. `attr` names the data attribute each
    button carries its value in (data-dt="avalanche"), as the old markup did. */
export function Segmented<V extends string | number>({ id, size, attr, options, value, onChange, hidden, disabled }: {
  id?: string; size?: "default" | "compact" | "fill" | "chart"; attr: `data-${string}`; options: readonly (readonly [V, string])[];
  value: V; onChange: (v: V) => void; hidden?: boolean; disabled?: (v: V) => boolean;
}) {
  return (
    <SegmentedGroup size={size} id={id} hidden={hidden}>
      {options.map(([v, label]) => (
        <SegmentedItem key={String(v)} {...{ [attr]: v }} pressed={value === v} disabled={disabled?.(v)} onClick={() => onChange(v)}>{label}</SegmentedItem>
      ))}
    </SegmentedGroup>
  );
}
