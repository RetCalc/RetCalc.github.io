/* Glyphs for the Never Alone Rule (DESIGN.md): a figure in Gain or Loss
   carries an icon as well as its color. Each icon is an aria-hidden SVG
   beside the figure, so the figure's text (innerText, the CSV, the numbers
   check) is unchanged: no "+" sign and no text glyph is added. */

import { ArrowDownIcon, ArrowUpIcon, CircleAlertIcon, CircleCheckIcon, CircleXIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ARROW = "relative -top-px mr-0.5 inline size-3 align-middle";

/** The up or down arrow of a real gain or loss; nothing for zero. For a
    cell that already carries its color. */
export function SignArrow({ v }: { v: number }) {
  if (!v) return null;
  const Icon = v > 0 ? ArrowUpIcon : ArrowDownIcon;
  return <Icon className={ARROW} aria-hidden="true" />;
}

/** A return that is a real gain or loss: Gain or Loss with an arrow (the
    column or row names what it is). Zero stays in Text. */
export function Signed({ v, children }: { v: number; children: React.ReactNode }) {
  if (!v) return <>{children}</>;
  return (
    <span className={cn("whitespace-nowrap", v > 0 ? "text-gain" : "text-destructive")}>
      <SignArrow v={v} />{children}
    </span>
  );
}

const TONE_ICON = { gain: CircleCheckIcon, text: CircleAlertIcon, loss: CircleXIcon } as const;

/** A pass/fail or a rating's glyph: a check for gain, a warning circle for
    plain text, an x for loss. For a cell that already carries its color. */
export function ToneGlyph({ tone }: { tone: keyof typeof TONE_ICON }) {
  const Icon = TONE_ICON[tone];
  return <Icon className="relative -top-px mr-1 inline size-3.5 align-middle" aria-hidden="true" />;
}
