"use client";

/* The header over an open tool: back to the tool list, then the tool's
   icon, name (the page's main heading) and one-line description. Markup
   from src/main/01-tool-header.html. */

import { useRouter } from "next/navigation";
import { ToolIconTile } from "@/components/tools/ToolIcon";
import { setNavDir } from "@/lib/nav-motion";
import type { ToolSub } from "@/lib/tools";
import { HelpButton } from "@/tools/help/ToolHelp";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** `more` sits under the description (a strategy page's links); `full`
    keeps the description whole on phones instead of two lines. */
export function ToolHeader({ sub, name, desc, more, full }: { sub: ToolSub; name: string; desc: string; more?: React.ReactNode; full?: boolean }) {
  const router = useRouter();
  return (
    <div className="toolback" id="toolBack">
      <Button variant="ghost" size="sm" className="-ml-2 flex-none" id="btnToolBack" onClick={() => { setNavDir("back"); router.push("/tools"); }}>
        <i className="arw back" aria-hidden="true"></i>
        All tools
      </Button>
      <div className="toolhead">
        <ToolIconTile sub={sub} className="toolcard-icon toolhead-icon" id="toolHeadIcon" />
        <div className="toolhead-t">
          <h1 className="toolhead-name" id="toolCrumb">{name}</h1>
          <p className={cn("toolhead-desc", full && "line-clamp-none")} id="toolHeadDesc">{desc}</p>
          {more}
        </div>
        <HelpButton tool={sub} />
      </div>
    </div>
  );
}
