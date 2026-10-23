"use client";

/* The children, in words, and the pop-ups their costs are changed in: the
   same ones the Stages calculator uses. First the costs (the children
   themselves fixed, as they come from the profile; their costs, childcare
   and a later child's share editable), then "How will you cover it?",
   which says which accounts each stage's costs come out of. Both are
   saved to the profile, so the plan, the timeline and the Calculator all
   use them. */

import Link from "next/link";
import { useState } from "react";
import { CoverStagesDialog, KidsDialog } from "@/tools/plan/KidsDialog";
import { kidStages } from "@/tools/plan/kids";
import { NO_KIDS, type PlanKids } from "@/tools/plan/model";
import { planKidsOf } from "./calc";
import { coverScope } from "./cover";
import { flow } from "./flows";
import { ageOf } from "./model";
import { useDashboard, type Profile } from "./store";

/** "Maya, 5, and 2 planned, the first in 2 years, then one every 3 years." */
export function childrenSentence(pr: Profile): string {
  const now = pr.kidList.slice(0, pr.kids).filter((k) => k.by).map((k, i) => `${k.name.trim() || "Child " + (i + 1)}, ${ageOf(k)}`);
  const n = pr.planned.count;
  const planned = n ? `${n} planned, the first in ${pr.planned.firstIn} ${pr.planned.firstIn === 1 ? "year" : "years"}${n > 1 ? `, then one every ${pr.planned.spacing} years` : ""}` : "";
  if (!now.length && !planned) return "No children in your profile.";
  return (now.length ? "Children: " + now.join("; ") + (planned ? ". Also " + planned : "") : "Children: " + planned) + ".";
}

/** Your age now and at retirement, for the children's stages. */
const spanOf = (pr: Profile) => { const age = ageOf(pr.p1) ?? 40; return { age, retire: Math.max(age + 1, pr.p1.retire ?? age + 25) }; };

/** The stages where the children cost more or less than today. */
export function coverSegs(pr: Profile, k: PlanKids | null = planKidsOf(pr)) {
  const { age, retire } = spanOf(pr);
  return kidStages(k, age, retire).filter((s) => s.change !== 0);
}

/** "How will you cover it?" on the profile's children. */
export function CoverDialog({ close, kids }: { close: () => void; kids?: PlanKids }) {
  const { data, setProfile } = useDashboard();
  const pr = data.profile, C = coverScope(flow(pr));
  return (
    <CoverStagesDialog segs={coverSegs(pr, kids)} today={C.today} ppy={12} initial={pr.kidCover ?? {}} coverFn={C.fn} order={C.order} saveLabel="Save"
      close={close} save={(cover) => { setProfile((p) => ({ ...p, kidCover: cover as Profile["kidCover"] })); close(); }} />
  );
}

/** The children's costs, then how they're covered when they change saving. */
export function ChildCostsDialog({ close }: { close: () => void }) {
  const { data, setProfile } = useDashboard();
  const pr = data.profile, kids = planKidsOf(pr) ?? NO_KIDS;
  const { age, retire } = spanOf(pr);
  const [next, setNext] = useState<PlanKids | null>(null);
  if (next) return <CoverDialog kids={next} close={close} />;
  return (
    <KidsDialog kids={kids} age={age} retire={retire} cover={false} close={close} withLater saveLabel="Save"
      costsOnly={<>{childrenSentence(pr)} <Link href="/dashboard/profile#children" onClick={close} className="underline underline-offset-4">Change them in Profile</Link></>}
      save={(k) => {
        setProfile((p) => ({ ...p, childcare: k.childcare, careArea: k.area ?? p.careArea, childCosts: { early: k.early, school: k.school, teen: k.teen ?? "", later: k.later ?? p.childCosts.later } }));
        if (coverSegs(pr, k).length) setNext(k); else close();
      }} />
  );
}
