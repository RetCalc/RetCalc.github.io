import { PageShell } from "@/components/shell/PageShell";
import { metadataFor } from "@/lib/seo";
import { RentBuy } from "@/tools/rentbuy/RentBuy";

export const metadata = metadataFor("rentbuy");

export default function Page() {
  return <PageShell slug="rentbuy"><RentBuy /></PageShell>;
}
