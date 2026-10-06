"use client";

/* Where the guide's coach goes: on every page but the guide's own, while a
   trip into a tool is under way and Tool Help isn't open. It's small; the
   coach itself, with the trips and what they read, loads only then. */

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useHelp } from "@/tools/help/state";
import { useGuide } from "./store";

const CoachBody = dynamic(() => import("./CoachBody"), { ssr: false });

export function GuideCoach() {
  const g = useGuide(), path = usePathname(), helping = !!useHelp();
  return g.trip && path !== "/guide" && !helping ? <CoachBody /> : null;
}
