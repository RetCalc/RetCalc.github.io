"use client";

/* The bar over the calculator's pages (Basic, Advanced, Stages), which have
   no tool header: the tool's saved scenarios with Save, Share and Reset, on
   the right. Other tools carry these in their header (ToolHeader). */

import { ScenarioBar } from "./ScenarioBar";

export function ToolBar() {
  return (
    <div className="toolbar" id="toolBar">
      <ScenarioBar />
    </div>
  );
}
