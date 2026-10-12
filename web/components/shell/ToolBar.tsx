"use client";

/* The bar at the top of each tool: on the left, its tie to the household
   (using its numbers, or changed from them); on the right, the tool's own
   saved scenarios with Save, Share and Reset. Both belong to the tool on
   the page, so they sit with it rather than in the site header. */

import { HouseholdStatus } from "@/components/household/HouseholdBar";
import { ScenarioBar } from "./ScenarioBar";

export function ToolBar() {
  return (
    <div className="toolbar" id="toolBar">
      <HouseholdStatus />
      <ScenarioBar />
    </div>
  );
}
