"use client";

/* A tool card's link: opening a tool goes forward, so its page rises in and
   the card's icon tile glides up into the tool's header. A touch or pen
   press gives the card .is-beat for the length of its icon's animation (up to 1.2s),
   so a tap plays what hover and keyboard focus play, without :hover sticking
   on afterwards (styles/04-tool-icons-header.css). A chart card (charted)
   also replays its chart then (styles/18-tool-picker.css). */

import Link from "next/link";
import { setNavDir } from "@/lib/nav-motion";

const BEAT_MS = 1300;

function beat(e: React.PointerEvent<HTMLAnchorElement>) {
  if (e.pointerType === "mouse") return;
  const el = e.currentTarget;
  el.classList.remove("is-beat");
  void el.offsetWidth; // restart the animation on a quick second tap
  el.classList.add("is-beat");
  window.setTimeout(() => el.classList.remove("is-beat"), BEAT_MS);
}

/* A chart card's chart plays while the card has .play: from the start, then
   again each time the card is pointed at, focused or tapped (the class is
   taken off and put back, which restarts its animations), a little faster
   then (.quick). */
function replay(el: HTMLElement) {
  el.classList.remove("play");
  void el.offsetWidth;
  el.classList.add("play", "quick");
}

export function ToolCardLink({ href, sub, i, className, charted, children }: {
  href: string; sub: string; i: number; className?: string; charted?: boolean; children: React.ReactNode;
}) {
  return (
    <Link href={href} className={"toolcard" + (className ? " " + className : "") + (charted ? " play" : "")} style={{ "--i": i } as React.CSSProperties} data-pick={sub}
      transitionTypes={["nav-forward"]} onClick={() => setNavDir("fwd")}
      onPointerDown={(e) => { beat(e); if (charted && e.pointerType !== "mouse") replay(e.currentTarget); }}
      onMouseEnter={charted ? (e) => replay(e.currentTarget) : undefined}
      onFocus={charted ? (e) => replay(e.currentTarget) : undefined}>
      {children}
    </Link>
  );
}
