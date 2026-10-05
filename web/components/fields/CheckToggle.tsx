/* A checkbox-style button that opens a group of fields under it: "Split by
   account type", "Glide path". Same markup as the old site (.glidebtn). A
   click on its "?" explains it without flipping it. */

export function CheckToggle({ id, on, onToggle, controls, children }: {
  id?: string; on: boolean; onToggle: () => void; controls?: string; children: React.ReactNode;
}) {
  return (
    <button type="button" className={on ? "glidebtn on" : "glidebtn"} id={id} aria-expanded={on} aria-controls={controls}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest?.(".tipdot")) return;
        onToggle();
      }}>
      <span className="glidebtn-check" aria-hidden="true"></span>
      <span className="glidebtn-txt">{children}</span>
    </button>
  );
}

/** The ± in front of a rate, since a phone's decimal keypad has no minus key. */
export function SignFlip({ value, onFlip }: { value: string; onFlip: (v: string) => void }) {
  const v = parseFloat(value.replace(/,/g, "")) || 0;
  return (
    <button type="button" className={v < 0 ? "signflip on" : "signflip"} title="Flip sign" aria-label="Flip sign"
      onClick={() => onFlip(String(-v))}>&plusmn;</button>
  );
}
