import { PageShell } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { Fire } from "@/tools/fire/Fire";

export const metadata = metadataFor("fire");

export default function Page() {
  return <PageShell slug="fire"><Fire /></PageShell>;
}
