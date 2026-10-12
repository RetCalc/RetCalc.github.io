/* The Basic calculator. It was the home page until the homepage arrived
   (2026-10); old share links to /#... are forwarded here (app/page.tsx). */

import { PageShell } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { Basic } from "@/tools/basic/Basic";

export const metadata = metadataFor("calculator");

export default function CalculatorPage() {
  return <PageShell slug="calculator"><Basic /></PageShell>;
}
