"use client";

/* The children, in words, and the pop-up their costs are changed in: the
   same one the Stages calculator uses, the children themselves fixed (they
   come from the profile), their costs, childcare and a later child's share
   editable. Saved to the profile, so the plan, the timeline and the
   Calculator all use them. */

import Link from "next/link";
import { KidsDialog } from "@/tools/plan/KidsDialog";
import { NO_KIDS } from "@/tools/plan/model";
import { planKidsOf } from "./calc";
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

export function ChildCostsDialog({ close }: { close: () => void }) {
  const { data, setProfile } = useDashboard();
  const pr = data.profile, kids = planKidsOf(pr) ?? NO_KIDS;
  const age = ageOf(pr.p1) ?? 40, retire = Math.max(age + 1, pr.p1.retire ?? age + 25);
  return (
    <KidsDialog kids={kids} age={age} retire={retire} cover={false} close={close} withLater saveLabel="Save"
      costsOnly={<>{childrenSentence(pr)} <Link href="/dashboard/profile#children" onClick={close} className="underline underline-offset-4">Change them in Profile</Link></>}
      save={(k) => {
        setProfile((p) => ({ ...p, childcare: k.childcare, careArea: k.area ?? p.careArea, childCosts: { early: k.early, school: k.school, teen: k.teen ?? "", later: k.later ?? p.childCosts.later } }));
        close();
      }} />
  );
}
