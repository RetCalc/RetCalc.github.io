"use client";

/* The Dashboard's pages, each signed in only. */

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Frame, SECTIONS, SignedIn, type Section } from "./Frame";
import { Overview } from "./Overview";
import { Setup } from "./Setup";

export function OverviewPage() {
  return <SignedIn><Overview /></SignedIn>;
}

export function SetupPage() {
  return <SignedIn><Setup /></SignedIn>;
}

/** A section still to be built: its place in the rail, and the way back. */
export function SectionPage({ id }: { id: Section }) {
  const s = SECTIONS.find((x) => x.id === id)!;
  return (
    <SignedIn>
      <Frame current={id} title={s.name}>
        <div className="dsh-center">
          <div className="dsh-card">
            <s.icon aria-hidden="true" />
            <h1>{s.name} is on its way</h1>
            <p>This part of your dashboard isn&apos;t built yet. Your overview works from what you gave in setup.</p>
            <Button variant="outline" nativeButton={false} render={<Link href="/dashboard" />}>Back to the overview</Button>
          </div>
        </div>
      </Frame>
    </SignedIn>
  );
}
