"use client";

import { Toggle, ToggleCheck } from "@/components/ui/toggle";

/* A checkbox-style button that opens a group of fields under it: "Split by
   account type", "Glide path". shadcn's Toggle; it keeps the old markup's
   hooks (.glidebtn-check for the box; the stage card layout finds it by data-slot)
   and says it opens its fields (aria-expanded) rather than that it's
   pressed. Its "?" (`tip`) is a separate control beside it. */

export function CheckToggle({ id, on, onToggle, controls, tip, children }: {
  id?: string; on: boolean; onToggle: () => void; controls?: string; tip?: React.ReactNode; children: React.ReactNode;
}) {
  const toggle = (
    <Toggle pressed={on} id={id} aria-pressed={undefined} aria-expanded={on} aria-controls={controls}
      variant={tip ? "checkInline" : "check"} onClick={onToggle}>
      <ToggleCheck />
      <span className="glidebtn-txt">{children}</span>
    </Toggle>
  );
  if (!tip) return toggle;
  // With a "?", the box is drawn by a wrapper and the "?" sits beside the
  // button rather than inside it, so each is its own control for keyboards
  // and screen readers. A click on the box's empty space still flips it.
  return (
    <div data-checkrow="" className={"flex w-full cursor-pointer items-center gap-1.5 rounded-(--r-well) border px-2.5 py-2.25 transition-colors hover:border-input " + (on ? "border-input bg-muted" : "border-border bg-muted")}
      onClick={(e) => { if (e.target === e.currentTarget) onToggle(); }}>
      {toggle}
      {tip}
    </div>
  );
}

/** The ± in front of a rate, since a phone's decimal keypad has no minus key. */
export function SignFlip({ value, onFlip }: { value: string; onFlip: (v: string) => void }) {
  const v = parseFloat(value.replace(/,/g, "")) || 0;
  return (
    <Toggle variant="sign" pressed={v < 0} title="Flip sign" aria-label="Flip sign"
      onClick={() => onFlip(String(-v))}>&plusmn;</Toggle>
  );
}
