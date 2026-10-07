import Link from "next/link";
import { ToolCard } from "@/components/tools/ToolPicker";
import { buttonVariants } from "@/components/ui/button";
import { TOOLS, type ToolSub } from "@/lib/tools";

/* A few of the main tools, offered as the picker's own cards. */
const POPULAR: ToolSub[] = ["drawdown", "optimizer", "roth", "fire"];

/* main isn't one column here (an unknown address isn't in lib/site.ts SOLO),
   so the page spans both of its columns and centers its own. */
export default function NotFound() {
  return (
    <div className="stack solo col-span-full">
      <div className="mx-auto w-full max-w-3xl py-6 sm:py-12">
        <h1 className="toolhead-name" id="pageH1">Page not found</h1>
        <p className="mt-2 mb-0 text-body text-muted-foreground">There&apos;s no page at this address. The link may be mistyped or out of date.</p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <Link href="/" className={buttonVariants({ variant: "default" })}>Open the calculator</Link>
          <Link href="/tools" className={buttonVariants({ variant: "secondary" })}>See all tools</Link>
        </div>
        <section className="toolgroup mt-10" aria-label="Popular tools">
          <h2 className="toolgroup-h"><span>Popular tools</span></h2>
          <div className="toolgrid">
            {POPULAR.map((sub) => <ToolCard key={sub} c={TOOLS[sub]} />)}
          </div>
        </section>
      </div>
    </div>
  );
}
