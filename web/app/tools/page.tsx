import { PageShell } from "@/components/shell/PageShell";
import { ToolPicker } from "@/components/tools/ToolPicker";
import { pickerData } from "@/components/tools/picker-data";
import { metadataFor } from "@/lib/seo";

export const metadata = metadataFor("tools");

export default function Page() {
  return <PageShell slug="tools"><ToolPicker data={pickerData()} /></PageShell>;
}
