"use client";

/* What's new, in About after "What this is": every release, newest first,
   folded to one row that names the current version. It opens by itself
   when there's a release you haven't seen, and opening About marks it seen. */

import Link from "next/link";
import { ChevronDownIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CURRENT, RELEASES } from "./releases";

const day = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export function WhatsNew({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Card size="flush" id="about-whatsnew">
      <div className="overflow-hidden rounded-(--r-panel)">
        <Collapsible open={open} onOpenChange={onOpenChange}>
          <h2 className="m-0">
            <CollapsibleTrigger variant="row">
              <span className="about-wn-t">What&apos;s new<span className="about-wn-v">Version {CURRENT.version} · {day(CURRENT.date)}</span></span>
              <ChevronDownIcon aria-hidden="true" />
            </CollapsibleTrigger>
          </h2>
          <CollapsibleContent variant="reveal" hiddenUntilFound>
            <ol className="about about-wn px-4.5 pt-1 pb-6">
              {RELEASES.map((r) => (
                <li key={r.version}>
                  <div className="about-wn-h"><b>{r.version}</b><span>{day(r.date)}</span></div>
                  <p className="about-wn-title">{r.title}</p>
                  {r.items?.length ? (
                    <ul>
                      {r.items.map((it) => <li key={it.text}>{it.text}{it.href ? <> <Link href={it.href}>Show me</Link></> : null}</li>)}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </Card>
  );
}
