import { PageShell } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { Budget } from "@/tools/budget/Budget";

export const metadata = metadataFor("budget");

export default function Page() {
  return <PageShell slug="budget"><Budget /></PageShell>;
}
