"use client";

/* What's new, in About after "What this is": the five newest releases,
   folded to one row that names the current version, and every release in
   a dialog behind "See all releases". It opens by itself when there's a
   release you haven't seen, and opening About marks it seen. */

import Link from "next/link";
import { useState } from "react";
import { ChevronDownIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { CURRENT, RELEASES, type Release } from "./releases";

/** How many releases show before "See all releases". */
const SHOWN = 5;

const day = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

function List({ releases, onLink }: { releases: Release[]; onLink?: () => void }) {
  return (
    <ol className="about about-wn">
      {releases.map((r) => (
        <li key={r.version}>
          <div className="about-wn-h"><b>{r.version}</b><span>{day(r.date)}</span></div>
          <p className="about-wn-title">{r.title}</p>
          {r.items?.length ? (
            <ul>
              {r.items.map((it) => <li key={it.text}>{it.text}{it.href ? <> <Link href={it.href} onClick={onLink}>Show me</Link></> : null}</li>)}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function WhatsNew({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [all, setAll] = useState(false);
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
            <div className="px-4.5 pt-1 pb-5">
              <List releases={RELEASES.slice(0, SHOWN)} />
              {RELEASES.length > SHOWN ? (
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setAll(true)}>See all {RELEASES.length} releases</Button>
              ) : null}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
      <Dialog open={all} onOpenChange={setAll}>
        <DialogContent size="guide" aria-labelledby="wnAllTitle">
          <div className="dsh-menu-h">
            <h2 id="wnAllTitle" className="dsh-dlg-h">Every release</h2>
            <DialogClose render={<Button variant="ghost" size="icon" aria-label="Close" />}><XIcon aria-hidden="true" /></DialogClose>
          </div>
          <p className="dsh-cap dsh-mt6">Version {CURRENT.version} is the current one. A major version is a rebuild or redesign, a minor one a new feature, a patch fixes.</p>
          <List releases={RELEASES} onLink={() => setAll(false)} />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
