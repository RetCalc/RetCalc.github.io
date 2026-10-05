/* Each tool's icon, as drawn on its card in the tool list and in its page's
   header. Converted unchanged from src/main/16-tool-picker.html; the class
   names drive the hover animations in styles/04-tool-icons-header.css. */
import type { ToolSub } from "@/lib/tools";

const ICONS: Record<ToolSub, React.ReactNode> = {
  optimizer: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="18" r="12" stroke="currentColor" strokeWidth="2" /><circle className="op-ic-ring" cx="24" cy="18" r="6.5" stroke="currentColor" strokeWidth="2" /><circle cx="24" cy="18" r="1.8" fill="currentColor" /><g className="op-ic-arrow"><path d="M5.5 34.5 L19.3 22.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M23 19 L20.98 24.27 L17.54 20.37 Z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" /><path d="M9.02 34.78 L9.24 31.19 L5.65 30.97 M6.78 36.76 L7 33.17 L3.41 32.95" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></g></svg>
  ),
  drawdown: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path className="dd-line" pathLength="100" d="M5 10 L13 18 L20 13 L27 24 L35 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M5 30 h30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle className="dd-dot dd-dot1" cx="13" cy="18" r="2" fill="currentColor" /><circle className="dd-dot dd-dot2" cx="27" cy="24" r="2" fill="currentColor" /></svg>
  ),
  bridge: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 30 h32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M6 30 V21 M34 30 V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path className="br-arch" pathLength="100" d="M4 21 Q20 6 36 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" /><path className="br-cable br-cable1" d="M13 30 V15.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".7" /><path className="br-cable br-cable2" d="M20 30 V13.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".7" /><path className="br-cable br-cable3" d="M27 30 V15.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".7" /><circle className="br-walker" cx="7" cy="26.6" r="1.8" fill="currentColor" opacity="0" /></svg>
  ),
  roth: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="12" width="13" height="22" rx="2.5" stroke="currentColor" strokeWidth="2" />
    <rect className="roth-dest" x="23" y="18" width="13" height="16" rx="2.5" stroke="currentColor" strokeWidth="2" />
    <path className="roth-path" pathLength="100" d="M10.5 9 V8 a3 3 0 0 1 3 -3 h13 a3 3 0 0 1 3 3 V14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path className="roth-head" d="M26.5 11.5 l3 3 3 -3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  healthcare: (
    <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle className="hc-ring" cx="18" cy="18" r="14" stroke="currentColor" strokeWidth="1.8" />
    <path className="hc-cross" d="M18 10v16M10 18h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),
  fire: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path className="fi-flame" d="M20 36 C27 36 31 26 28.5 18 C26.5 12 22 9 20.5 4 C20.2 2 20 2 20 2 C20 2 19.8 2 19.5 4 C18 9 13.5 12 11.5 18 C9 26 13 36 20 36Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path className="fi-core" d="M20 32 C17.5 32 15.5 27 17 22 C18 18 19.5 17 20 13 C20.5 17 22 18 23 22 C24.5 27 22.5 32 20 32Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  ),
  backtest: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 32h32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <rect className="bt-bar bt-bar1" x="7" y="20" width="5" height="12" rx="1.2" stroke="currentColor" strokeWidth="2" />
    <rect className="bt-bar bt-bar2" x="17.5" y="13" width="5" height="19" rx="1.2" stroke="currentColor" strokeWidth="2" />
    <rect className="bt-bar bt-bar3" x="28" y="7" width="5" height="25" rx="1.2" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  college: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><polygon className="cl-cap" points="20,8 38,17 20,26 2,17" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M8 21v8c0 3.3 5.4 6 12 6s12-2.7 12-6v-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><line className="cl-tassel" x1="38" y1="17" x2="38" y2="26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  ),
  rentbuy: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="6" r="1.6" fill="currentColor" />
    <line x1="20" y1="7.5" x2="20" y2="30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <g className="rb-beam">
    <line x1="8" y1="9" x2="32" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="8" y1="9" x2="8" y2="18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <line x1="32" y1="9" x2="32" y2="18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M3 18 Q8 24 13 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    <path d="M27 18 Q32 24 37 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    </g>
    <rect x="14" y="30" width="12" height="4" rx="1" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  tax: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="4" width="22" height="32" rx="3" stroke="currentColor" strokeWidth="2" />
    <line x1="11" y1="14" x2="23" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="11" y1="20" x2="23" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="11" y1="26" x2="18" y2="26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <g className="tx-glass">
    <circle cx="31" cy="31" r="7" fill="var(--bg)" stroke="currentColor" strokeWidth="2" />
    <line x1="28" y1="31" x2="34" y2="31" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="31" y1="28" x2="31" y2="34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </g>
    </svg>
  ),
  budget: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="10" width="32" height="22" rx="3" stroke="currentColor" strokeWidth="2" />
    <line x1="4" y1="16" x2="36" y2="16" stroke="currentColor" strokeWidth="2" />
    <line x1="14" y1="10" x2="14" y2="32" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
    <g className="bg-coin">
    <circle cx="22" cy="24" r="4" stroke="currentColor" strokeWidth="2" />
    <line x1="22" y1="20" x2="22" y2="28" stroke="currentColor" strokeWidth="1.5" />
    <line x1="18" y1="24" x2="26" y2="24" stroke="currentColor" strokeWidth="1.5" />
    </g>
    </svg>
  ),
  debt: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path className="db-bar db-b1" d="M6 32 V24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path className="db-bar db-b2" d="M14 32 V18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path className="db-bar db-b3" d="M22 32 V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path className="db-bar db-b4" d="M30 32 V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M4 36 h32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M8 10 L34 28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3.5" />
    </svg>
  ),
  mortgage: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path className="mg-roof" d="M6 20 L20 8 L34 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="10" y="20" width="20" height="16" rx="1" stroke="currentColor" strokeWidth="2" />
    <rect x="16" y="28" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
};

export function ToolIcon({ sub }: { sub: ToolSub }) {
  return ICONS[sub];
}
