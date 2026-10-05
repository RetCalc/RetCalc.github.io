"use client";

/* A stage card's top row: its name, which doubles as a rename field, the
   span it covers and Remove. Clicking the name selects it, so a click can
   just be typed over; Enter commits; an empty or default name goes back to
   "Stage N". Stages and the Drawdown Simulator's spending stages use it.
   From buildStages() in src/js/app/08-stages.js. */

export function StageHead({ name, fallback, aria, rename, span, remove, attrs }: {
  name?: string;
  /** The name shown until one is given: "Stage 2". */
  fallback: string;
  aria: string;
  rename: (name: string | undefined) => void;
  span: React.ReactNode;
  remove: () => void;
  /** The old page's data attributes on the name, span and button. */
  attrs: { name: Record<string, number>; span: Record<string, number>; del: Record<string, number> };
}) {
  return (
    <div className="stagehead">
      <span className="stagenum" contentEditable suppressContentEditableWarning spellCheck={false} {...attrs.name} title="Click to rename" aria-label={aria + " name"}
        onFocus={(e) => {
          const range = document.createRange();
          range.selectNodeContents(e.currentTarget);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        onBlur={(e) => {
          const raw = (e.currentTarget.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
          const next = raw && raw !== fallback ? raw : undefined;
          e.currentTarget.textContent = next || fallback;
          rename(next);
        }}>{name || fallback}</span>
      <span className="stagespan" {...attrs.span}>{span}</span>
      <button className="btn mini" type="button" {...attrs.del} onClick={remove}>Remove</button>
    </div>
  );
}
