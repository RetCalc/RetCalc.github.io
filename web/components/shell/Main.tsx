"use client";

/* <main>, one column on the pages that want it (main.solo in the CSS). */

import { usePathname } from "next/navigation";
import { isSolo } from "@/lib/site";
import { slugFromPath } from "./NavBar";

export function Main({ children }: { children: React.ReactNode }) {
  const solo = isSolo(slugFromPath(usePathname()));
  return (
    <main id="main" className={solo ? "solo" : undefined}>
      {children}
    </main>
  );
}
