/* The home page: the Basic calculator. */

import { PageShell } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { Basic } from "@/tools/basic/Basic";

export const metadata = metadataFor("home");

export default function Home() {
  return <PageShell slug="home"><Basic /></PageShell>;
}
