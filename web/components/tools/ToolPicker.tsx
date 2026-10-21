/* The tool list (/tools): every tool, by section, as chart cards or compact
   tiles (ToolsBrowser). The cards are links, so each tool's address can be
   followed by anything that reads the page. */

import { TOOLS_VIEW_SCRIPT } from "@/lib/tools-view-script";
import type { PickerData } from "./picker-data";
import { ToolsBrowser } from "./ToolsBrowser";

export function ToolPicker({ data }: { data: PickerData }) {
  return (
    <div className="stack solo" role="tabpanel" aria-labelledby="tabbtn-tools" id="tab-toolpicker">
      {/* Before the list is drawn: show it the way it was left (lib/tools-view-script.ts). */}
      <script dangerouslySetInnerHTML={{ __html: TOOLS_VIEW_SCRIPT }} />
      <ToolsBrowser data={data} />
    </div>
  );
}
