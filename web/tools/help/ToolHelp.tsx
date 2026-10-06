"use client";

/* Tool Help: the Help button in a tool's header, and the panel it opens.
   The panel and its tours load only when help is opened; leaving the tool
   closes it, and while it's open the guide's coach steps aside. */

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { TOUR_TOOLS, helpNow, setHelp, toggleHelp, useHelp } from "./state";
import { Button } from "@/components/ui/button";

const HelpPanel = dynamic(() => import("./HelpPanel"), { ssr: false });

/** The Help button, on a tool that has a tour. */
export function HelpButton({ tool }: { tool: string }) {
  const h = useHelp();
  if (!TOUR_TOOLS.has(tool)) return null;
  return (
    <Button variant="outline" size="sm" className="ml-auto flex-none self-center" id="toolHelpBtn" aria-controls="thCoach" aria-expanded={h?.tool === tool} onClick={() => toggleHelp(tool)}>
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.3" stroke="currentColor" strokeWidth="1.4" />
        <path d="M6.2 6.3a1.9 1.9 0 0 1 3.7.5c0 1.3-1.9 1.6-1.9 2.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><circle cx="8" cy="11.4" r=".85" fill="currentColor" /></svg>
      Help
    </Button>
  );
}

/** The panel, while help is open on the tool it belongs to. */
export function ToolHelp() {
  const h = useHelp(), path = usePathname();
  // Help belongs to the tool it was opened on: leaving closes it.
  useEffect(() => {
    if (helpNow() && helpNow()!.path !== path) setHelp(null);
  }, [path]);
  return h && h.path === path ? <HelpPanel h={h} /> : null;
}
