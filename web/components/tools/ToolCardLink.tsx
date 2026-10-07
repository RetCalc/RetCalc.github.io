"use client";

/* A tool card's link: opening a tool goes forward, so its page rises in and
   the card's icon tile glides up into the tool's header. A touch or pen
   press gives the card .is-beat for the length of its icon's animation (up to 1.2s),
   so a tap plays what hover and keyboard focus play, without :hover sticking
   on afterwards (styles/04-tool-icons-header.css). */

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

export function ToolCardLink({ href, sub, i, children }: { href: string; sub: string; i: number; children: React.ReactNode }) {
  return (
    <Link href={href} className="toolcard" style={{ "--i": i } as React.CSSProperties} data-pick={sub}
      transitionTypes={["nav-forward"]} onClick={() => setNavDir("fwd")} onPointerDown={beat}>
      {children}
    </Link>
  );
}
