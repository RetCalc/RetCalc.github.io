import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="stack solo">
      <h1 className="srlive" id="pageH1">Page not found</h1>
      <Card>
        <CardHeader><CardTitle>There&apos;s no page at this address</CardTitle></CardHeader>
        <CardContent>
          <p className="hint">
            Try the <Link href="/">calculator</Link> or the <Link href="/tools">list of tools</Link>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
