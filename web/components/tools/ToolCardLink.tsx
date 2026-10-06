"use client";

/* A tool card's link: opening a tool goes forward, so its page rises in and
   the card's icon tile glides up into the tool's header. */

import Link from "next/link";
import { setNavDir } from "@/lib/nav-motion";

export function ToolCardLink({ href, sub, i, children }: { href: string; sub: string; i: number; children: React.ReactNode }) {
  return (
    <Link href={href} className="toolcard" style={{ "--i": i } as React.CSSProperties} data-pick={sub}
      transitionTypes={["nav-forward"]} onClick={() => setNavDir("fwd")}>
      {children}
    </Link>
  );
}
