/* A small picture of the full report (REPORT_BRIEF.md) for the places that
   mention it, the homepage's Guide tile and the Guide's welcome card: three
   pages fanned out, the front one its cover in the report's own colors (the
   black band, the savings map and the trail). Illustration only: no figures. */

export function ReportThumb() {
  return (
    <svg className="rp-thumb" viewBox="0 0 120 112" width={120} height={112} aria-hidden="true">
      <g transform="rotate(-8 60 56)"><rect className="pg" x="22" y="10" width="68" height="88" rx="2" /><rect className="band" x="22" y="10" width="68" height="13" /></g>
      <g transform="rotate(5 60 56)"><rect className="pg" x="30" y="12" width="68" height="88" rx="2" /><rect className="band" x="30" y="12" width="68" height="13" />
        <rect className="side" x="36" y="70" width="18" height="12" /><rect className="side" x="58" y="70" width="18" height="12" /><rect className="side" x="80" y="70" width="12" height="12" /></g>
      <g>
        <rect className="pg" x="24" y="16" width="68" height="88" rx="2" />
        <rect className="band" x="24" y="16" width="68" height="14" />
        <rect className="ttl" x="29" y="21" width="30" height="4" rx="1" />
        <rect className="land" x="24" y="30" width="68" height="40" />
        <path className="hi" d="M50 64 C60 58 70 50 79 40 L88 33 L88 66 L50 66 Z" />
        <path className="mid" d="M50 64 C60 61 70 56 79 50 L88 46 L88 65 L50 66 Z" />
        <path className="ln" d="M28 67 C38 66 44 64 50 62 C60 60 70 56 88 48" />
        <circle className="stop" cx="50" cy="62" r="2.4" /><circle className="stop" cx="70" cy="56.5" r="2.4" />
        <rect className="txt" x="29" y="75" width="16" height="3" rx="1" /><rect className="txt" x="52" y="75" width="16" height="3" rx="1" /><rect className="txt" x="73" y="75" width="14" height="3" rx="1" />
        <rect className="txt2" x="29" y="81" width="13" height="2" rx="1" /><rect className="txt2" x="52" y="81" width="14" height="2" rx="1" /><rect className="txt2" x="73" y="81" width="12" height="2" rx="1" />
        <rect className="txt2" x="29" y="85" width="14" height="2" rx="1" /><rect className="txt2" x="52" y="85" width="11" height="2" rx="1" /><rect className="txt2" x="73" y="85" width="13" height="2" rx="1" />
        <rect className="band" x="24" y="98" width="68" height="6" />
      </g>
    </svg>
  );
}
