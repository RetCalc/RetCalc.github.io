"use client";

/* The header over the calculator's pages (Basic, Advanced), which
   have no tool header: the title with the Basic / Advanced switch beside it
   and what the mode does under them on the left, its saved scenarios with
   Save, Share and Reset on the right. Other tools carry
   their saved scenarios in their own header (ToolHeader). Pages without a
   title (the Guide) get the saved scenarios alone. */

import { CalcSwitch } from "./ModeSwitch";
import { ScenarioBar } from "./ScenarioBar";

export function ToolBar({ title, desc, modes }: { title?: string; desc?: string; modes?: boolean }) {
  return (
    <div className="toolbar" id="toolBar">
      {title ? (
        <div className="toolbar-t">
          <div className="toolbar-h">
            <h2 className="toolhead-name">{title}</h2>
            {modes ? <CalcSwitch /> : null}
          </div>
          {desc ? <p className="toolhead-desc">{desc}</p> : null}
        </div>
      ) : null}
      <ScenarioBar />
    </div>
  );
}
