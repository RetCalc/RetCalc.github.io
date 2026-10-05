import { PageShell } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { Stages } from "@/tools/stages/Stages";

export const metadata = metadataFor("stages");

export default function Page() {
  return <PageShell slug="stages"><Stages /></PageShell>;
}
