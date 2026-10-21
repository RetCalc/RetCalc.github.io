"use client";

/* <main>, one column on the pages that want it (main.solo in the CSS), and
   the page-change fade. */

import { usePathname } from "next/navigation";
import { ViewTransition } from "react";
import { isSolo } from "@/lib/site";
import { slugFromPath } from "./NavBar";

export function Main({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const solo = isSolo(slugFromPath(path));
  // Keyed to the page: a page change swaps one boundary for another, so the
  // old page fades out while the new one comes in (page-out / page-in in
  // styles/03-navigation.css). Typing in a tool never remounts it, so
  // nothing fades while you work.
  return (
    <ViewTransition key={path} enter="page-in" exit="page-out" default="none">
      <main id="main" className={solo ? "solo" : undefined}>
        {children}
      </main>
    </ViewTransition>
  );
}
