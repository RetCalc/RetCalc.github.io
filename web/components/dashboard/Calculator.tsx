"use client";

/* Calculator: the Stages calculator on your plan. Its stages are the
   plan's own saving: every change the plan makes (children, college years,
   saving that grows to its limits, both employers' match), so it reaches
   what the plan has at retirement. Balances, saving by account and the
   assumptions come from the dashboard; the children's costs and how
   they're covered are the profile's, so changing them here changes them
   everywhere and the stages are built again from the plan. Everything else
   changed here (fees, returns, the stages themselves) is saved to the plan
   in place of its figures, and the Calculator's result becomes the plan's
   savings at retirement: Retirement, the chance of success and the
   overview all start from it. "Use the plan's figures" lets go of them. */

import Link from "next/link";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import { useState } from "react";
import type { ToolInputs } from "@/components/tools/ToolState";
import type { StagesInputs } from "@/tools/stages/model";
import { Frame } from "./Frame";
import { calcInputs, calcOwnOf } from "./calc";
import { childrenSentence } from "./children";
import { coverScope, shiftCover } from "./cover";
import { budgetFor, flow, taxFor } from "./flows";
import { ageOf } from "./model";
import { KID_BASE } from "@/tools/stages/kids";
import { Hosted } from "./host";
import { useDashboard, type Profile } from "./store";

const Stages = dynamic(() => import("@/tools/stages/Stages").then((m) => m.Stages), { ssr: false });

/** What the profile keeps from the calculator: historical mode's mix, the
    children's costs, and how they're covered (by your age, where the
    calculator counts years). Everything else changed here is kept too
   (calcOwn), and the Calculator's result is then the plan's savings at
   retirement (calc.ts). */
function fromStages(p0: Profile, s: StagesInputs): Profile {
  const mix = { stock: s.histMix, sv: s.histSv ?? "0", cash: s.histCash ?? "0", end: s.histMixEnd };
  const p = JSON.stringify(mix) === JSON.stringify(p0.calcMix ?? { stock: "80", sv: "0", cash: "0", end: "40" }) ? p0 : { ...p0, calcMix: mix };
  const k = s.kids;
  if (!k) return p;
  const next = {
    childcare: k.childcare, careArea: k.area ?? p.careArea, childCosts: { early: k.early, school: k.school, teen: k.teen ?? "", later: k.later ?? p.childCosts.later },
    kidCover: shiftCover((s.kidCover ?? {}) as Profile["kidCover"], (ageOf(p.p1) ?? KID_BASE) - KID_BASE) as Profile["kidCover"],
  };
  return costsKey(next) === costsKey(p) ? p : { ...p, ...next };
}
const costsKey = (p: Pick<Profile, "childcare" | "careArea" | "childCosts" | "kidCover">) => JSON.stringify([p.childcare, p.careArea, p.childCosts, p.kidCover ?? {}]);

export function Calculator() {
  const { data, setProfile } = useDashboard();
  const pr = data.profile, entries = data.entries;
  // Bumped by "Use the plan's figures", so the calculator opens again from the plan.
  const [rev, setRev] = useState(0);
  // Read when a tool opens: the stages are worked out then, not on every change.
  const seed = (id: string): ToolInputs | undefined =>
    id === "stages" ? (calcInputs(pr, entries) as unknown as ToolInputs) : id === "tax" ? (taxFor(pr) as unknown as ToolInputs) : id === "budget" ? (budgetFor(pr) as unknown as ToolInputs) : undefined;
  const keep = (id: string, d: ToolInputs) => {
    if (id !== "stages") return;
    setProfile((p) => {
      const q = fromStages(p, d as unknown as StagesInputs), own = calcOwnOf(q, entries, d as unknown as StagesInputs);
      return JSON.stringify(own ?? null) === JSON.stringify(q.calcOwn ?? null) ? q : { ...q, calcOwn: own ?? undefined };
    });
  };
  const changed = !!pr.calcOwn && Object.keys(pr.calcOwn).length > 0;
  const summary = <>{childrenSentence(pr)} <Button variant="link" size="inline" nativeButton={false} render={<Link href="/dashboard/profile#children" />}>Change them in Profile</Button></>;
  return (
    <Frame current="calculator" title="Calculator" sub="Filled in from your plan. What you change here is saved to your plan, and its result is your savings at retirement everywhere.">
      {changed ? (
        <p className="dsh-cap dsh-mt6">Your own changes here are saved in place of the plan&apos;s figures, and this result is your savings at retirement on every tab.{" "}
          <Button variant="link" size="inline" onClick={() => { setProfile((p) => ({ ...p, calcOwn: undefined })); setRev((r) => r + 1); }}>Use the plan&apos;s figures</Button></p>
      ) : null}
      {/* New child costs build the stages again, from the plan. */}
      <Hosted key={costsKey(pr) + "|" + rev} household={null} cover={coverScope(flow(pr))} seed={seed} slots={{ kidsSummary: summary }} keep={keep}>
        <Stages />
      </Hosted>
    </Frame>
  );
}
