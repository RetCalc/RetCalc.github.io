import { PageShell } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { College } from "@/tools/college/College";

export const metadata = metadataFor("college");

export default function Page() {
  return <PageShell slug="college"><College /></PageShell>;
}
