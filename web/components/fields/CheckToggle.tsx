"use client";

import { Toggle, ToggleCheck } from "@/components/ui/toggle";

/* A checkbox-style button that opens a group of fields under it: "Split by
   account type", "Glide path". shadcn's Toggle; it keeps the old markup's
   hooks (.glidebtn-check for the box; the stage card layout finds it by data-slot)
   and says it opens its fields (aria-expanded) rather than that it's
   pressed. A click on its "?" explains it without flipping it. */

export function CheckToggle({ id, on, onToggle, controls, children }: {
  id?: string; on: boolean; onToggle: () => void; controls?: string; children: React.ReactNode;
}) {
  return (
    <Toggle variant="check" pressed={on} id={id} aria-pressed={undefined} aria-expanded={on} aria-controls={controls}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest?.(".tipdot")) return;
        onToggle();
      }}>
      <ToggleCheck />
      <span className="glidebtn-txt">{children}</span>
    </Toggle>
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
