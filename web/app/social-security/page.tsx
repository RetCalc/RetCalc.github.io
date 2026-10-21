import { PageShell } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { Social } from "@/tools/social/Social";

export const metadata = metadataFor("social-security");

export default function Page() {
  return <PageShell slug="social-security"><Social /></PageShell>;
}
