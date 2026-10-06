/* The RetCalc mark: an arrow crossing a rising curve. In the brand colors,
   which the theme swaps for their deeper twins in light mode (DESIGN.md,
   Brand mark) so the mark clears 3:1 on paper. */
export function Brandmark() {
  return (
    <svg className="brandmark" viewBox="4 4 56 56" aria-hidden="true">
      <g transform="rotate(-45 32 32)">
        <path d="M33 7 L11.5 28.5 M33 57 L11.5 35.5" fill="none" stroke="var(--ds-brand-steel)" strokeWidth="2" />
        <path d="M33 7 C31 10 34 13 39 17 Q53 32 39 47 C34 51 31 54 33 57" fill="none" stroke="var(--ds-brand-jade)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 32 H51" stroke="var(--ds-brand-gold)" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M60 32 L48 25.5 L50.5 32 L48 38.5 Z" fill="var(--ds-brand-gold)" />
        <path d="M11 32 L6 25.5 H11 L18 32 Z M11 32 L6 38.5 H11 L18 32 Z" fill="var(--ds-brand-gold)" />
      </g>
    </svg>
  );
}
