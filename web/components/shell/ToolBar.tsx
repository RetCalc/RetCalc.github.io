"use client";

/* The header over the calculator's pages (Basic, Advanced), which
   have no tool header: the mode's name and what it does on the left, its
   saved scenarios with Save, Share and Reset on the right. Other tools carry
   their saved scenarios in their own header (ToolHeader). Pages without a
   title (the Guide) get the saved scenarios alone. */

import { ScenarioBar } from "./ScenarioBar";

export function ToolBar({ title, desc }: { title?: string; desc?: string }) {
  return (
    <div className="toolbar" id="toolBar">
      {title ? (
        <div className="toolbar-t">
          <h2 className="toolhead-name">{title}</h2>
          {desc ? <p className="toolhead-desc">{desc}</p> : null}
        </div>
      ) : null}
      <ScenarioBar />
    </div>
  );
}
