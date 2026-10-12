/* Glyphs for the Never Alone Rule (DESIGN.md): a figure in Gain or Loss
   carries an icon as well as its color. Each icon is an empty aria-hidden
   <i> beside the figure, so the figure's text (innerText, the CSV, the
   numbers check) is unchanged: no "+" sign and no text glyph is added. The
   icons are lucide's shapes painted by a CSS mask (.glyph in
   styles/06-data-controls.css), not an SVG each: Drawdown's table has
   hundreds of rows, and an SVG per row made the page slow to open. */

import { cn } from "@/lib/utils";

/** The up or down arrow of a real gain or loss; nothing for zero. For a
    cell that already carries its color. */
export function SignArrow({ v }: { v: number }) {
  if (!v) return null;
  return <i className={cn("glyph glyph-arrow", v > 0 ? "glyph-up" : "glyph-down")} aria-hidden="true" />;
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

const TONE_GLYPH = { gain: "glyph-check", text: "glyph-alert", loss: "glyph-x" } as const;

/** A pass/fail or a rating's glyph: a check for gain, a warning circle for
    plain text, an x for loss. For a cell that already carries its color. */
export function ToneGlyph({ tone }: { tone: keyof typeof TONE_GLYPH }) {
  return <i className={cn("glyph glyph-tone", TONE_GLYPH[tone])} aria-hidden="true" />;
}
