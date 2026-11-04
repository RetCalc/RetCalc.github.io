"use client";

/* The header over an open tool: the tool's icon, a small way back to the
   tool list over its name (the page's main heading), its one-line
   description, and the tool's saved scenarios and Help on the right. Markup from
   src/main/01-tool-header.html. */

import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";
import { ToolIconTile } from "@/components/tools/ToolIcon";
import { setNavDir } from "@/lib/nav-motion";
import type { ToolSub } from "@/lib/tools";
import { HelpButton } from "@/tools/help/ToolHelp";
import { cn } from "@/lib/utils";

/** `more` sits under the description (a strategy page's links); `full`
    is no longer needed (the description is whole on phones too); `controls`
    (the saved scenarios, Save, Share and Reset) sit beside Help. */
export function ToolHeader({ sub, name, desc, more, full, controls }: { sub: ToolSub; name: string; desc: string; more?: React.ReactNode; full?: boolean; controls?: React.ReactNode }) {
  return (
    <div className="toolback" id="toolBack">
      <div className="toolhead">
        <ToolIconTile sub={sub} className="toolcard-icon toolhead-icon" id="toolHeadIcon" />
        <div className="toolhead-t">
          <Link href="/tools" className="toolhead-back" id="btnToolBack" onClick={() => setNavDir("back")}><ChevronLeftIcon aria-hidden="true" />All tools</Link>
          <h1 className="toolhead-name" id="toolCrumb">{name}</h1>
          <p className={cn("toolhead-desc", full && "line-clamp-none")} id="toolHeadDesc">{desc}</p>
          {more}
        </div>
        {/* When the row runs out of room, these drop under the description
            rather than squeezing it. */}
        <div className="toolhead-ctl">
          {controls}
          <HelpButton tool={sub} />
        </div>
      </div>
    </div>
  );
}
