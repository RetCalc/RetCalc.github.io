/* The RetCalc mark: an arrow crossing a rising curve. */
export function Brandmark() {
  return (
    <svg className="brandmark" viewBox="4 4 56 56" aria-hidden="true">
      <g transform="rotate(-45 32 32)">
        <path d="M33 7 L11.5 28.5 M33 57 L11.5 35.5" fill="none" stroke="#7d9fd6" strokeWidth="2" />
        <path d="M33 7 C31 10 34 13 39 17 Q53 32 39 47 C34 51 31 54 33 57" fill="none" stroke="#4fbf95" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 32 H51" stroke="#e9b872" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M60 32 L48 25.5 L50.5 32 L48 38.5 Z" fill="#e9b872" />
        <path d="M11 32 L6 25.5 H11 L18 32 Z M11 32 L6 38.5 H11 L18 32 Z" fill="#e9b872" />
      </g>
    </svg>
  );
}
