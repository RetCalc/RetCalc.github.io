/* The home page: the Basic calculator. */

import { PageShell, Placeholder } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";

export const metadata = metadataFor("home");

export default function Home() {
  return (
    <PageShell slug="home">
      <Placeholder what="Basic calculator" />
    </PageShell>
  );
}
