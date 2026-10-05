import { PageShell } from "@/components/shell/PageShell";
import { ToolPicker } from "@/components/tools/ToolPicker";
import { metadataFor } from "@/lib/seo";

export const metadata = metadataFor("tools");

export default function Page() {
  return <PageShell slug="tools"><ToolPicker /></PageShell>;
}
