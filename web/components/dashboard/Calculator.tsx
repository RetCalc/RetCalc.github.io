"use client";

/* Calculator: the Stages calculator on your plan. Its stages are the
   plan's own saving: every change the plan makes (children, college years,
   saving that grows to its limits, both employers' match), so it reaches
   what the plan has at retirement. Balances, saving by account and the
   assumptions come from the dashboard; the children's costs and how
   they're covered are the profile's, so changing them here changes them
   everywhere and the stages are built again from the plan. Everything else changed here stays in the
   calculator. */

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { ToolInputs } from "@/components/tools/ToolState";
import type { StagesInputs } from "@/tools/stages/model";
import { Frame } from "./Frame";
import { stagesFor } from "./calc";
import { childrenSentence } from "./children";
import { coverScope, shiftCover } from "./cover";
import { budgetFor, flow, taxFor } from "./flows";
import { ageOf } from "./model";
import { KID_BASE } from "@/tools/stages/kids";
import { Hosted } from "./host";
import { useDashboard, type Profile } from "./store";

const Stages = dynamic(() => import("@/tools/stages/Stages").then((m) => m.Stages), { ssr: false });

/** What the profile keeps from the calculator: the children's costs, and
    how they're covered (by your age, where the calculator counts years). */
function fromStages(p: Profile, s: StagesInputs): Profile {
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
  const pr = data.profile;
  const seed = useMemo(() => {
    const st = stagesFor(pr, data.entries) as unknown as ToolInputs;
    return (id: string): ToolInputs | undefined => (id === "stages" ? st : id === "tax" ? (taxFor(pr) as unknown as ToolInputs) : id === "budget" ? (budgetFor(pr) as unknown as ToolInputs) : undefined);
  }, [pr, data.entries]);
  const summary = <>{childrenSentence(pr)} <Link href="/dashboard/profile#children" className="underline underline-offset-4">Change them in Profile</Link></>;
  return (
    <Frame current="calculator" title="Calculator" sub="Filled in from your dashboard. Changes here stay in the calculator.">
      {/* New child costs build the stages again, from the plan. */}
      <Hosted key={costsKey(pr)} household={null} cover={coverScope(flow(pr))} seed={seed} slots={{ kidsSummary: summary }}
        keep={(id, d) => { if (id === "stages" && (d as unknown as StagesInputs).kids) setProfile((p) => fromStages(p, d as unknown as StagesInputs)); }}>
        <Stages />
      </Hosted>
    </Frame>
  );
}
