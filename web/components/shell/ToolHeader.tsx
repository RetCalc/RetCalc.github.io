"use client";

/* The header over an open tool: back to the tool list, then the tool's
   icon, name (the page's main heading) and one-line description. Markup
   from src/main/01-tool-header.html. */

import { useRouter } from "next/navigation";
import { ToolIcon } from "@/components/tools/ToolIcon";
import type { ToolSub } from "@/lib/tools";
import { HelpButton } from "@/tools/help/ToolHelp";

export function ToolHeader({ sub, name, desc }: { sub: ToolSub; name: string; desc: string }) {
  const router = useRouter();
  return (
    <div className="toolback" id="toolBack">
      <button type="button" className="backbtn" id="btnToolBack" onClick={() => router.push("/tools")}>
        <i className="arw back" aria-hidden="true"></i>
        All tools
      </button>
      <div className="toolhead">
        <span className="toolcard-icon toolhead-icon" id="toolHeadIcon" aria-hidden="true"><ToolIcon sub={sub} /></span>
        <div className="toolhead-t">
          <h1 className="toolhead-name" id="toolCrumb">{name}</h1>
          <p className="toolhead-desc" id="toolHeadDesc">{desc}</p>
        </div>
        <HelpButton tool={sub} />
      </div>
    </div>
  );
}
