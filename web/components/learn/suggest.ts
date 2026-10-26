"use client";

/* Next for you: the lessons a plan points to, each with the reason from
   the plan, in the order they matter. Without a plan (signed out, or not
   set up yet), the first lesson not yet read. Read lessons drop out. */

import { useMemo } from "react";
import { useAccount } from "@/components/account/AccountProvider";
import { useDashboard, unstarted } from "@/components/dashboard/store";
import { ageOf, holdings, results } from "@/components/dashboard/model";
import type { LessonSummary } from "@/lib/learn/lessons";

export interface Pick { slug: string; why: string }

export function useSuggestions(lessons: LessonSummary[], read: Record<string, string>): Pick[] {
  const { account } = useAccount();
  const { data } = useDashboard();
  const own = !!account && !unstarted(data);
  return useMemo(() => {
    const have = new Set(lessons.map((l) => l.slug)), out: Pick[] = [];
    const add = (slug: string, why: string) => { if (have.has(slug) && !read[slug] && !out.some((p) => p.slug === slug)) out.push({ slug, why }); };
    if (own) {
      const pr = data.profile, R = results(pr, data.entries), H = holdings(data.entries, pr);
      const age = ageOf(pr.p1), retire = pr.p1.retire, toGo = age != null && retire != null ? retire - age : null;
      if (pr.match === "partial") add("employer-match", "Your plan says you're not getting the whole employer match.");
      if (R.cushion != null && R.cushion < 3) add("emergency-fund", `Your cash covers ${R.cushion.toFixed(1)} months of spending.`);
      if (toGo != null && toGo <= 10) {
        add("sequence-risk", `You retire in ${R.retireYear ?? "under ten years"}, and the first years of retirement matter most.`);
        add("choosing-a-strategy", "With retirement close, how you'll draw on savings is the next decision.");
      }
      if (age != null && age >= 60) add("when-to-claim", "You're within a few years of the first age you can claim Social Security.");
      if (retire != null && retire < 59.5) add("bridge-to-59", `Retiring at ${retire} means years before retirement accounts open without a penalty.`);
      if (retire != null && retire < 65) add("health-cover-before-65", `Retiring at ${retire} leaves years before Medicare to cover.`);
      const tot = H.trad + H.roth + H.brok;
      if (tot > 0 && H.trad / tot >= 0.9) add("traditional-or-roth", "Nearly all of your savings is pre-tax.");
      const now = new Date().getFullYear();
      const kid = pr.kidList.find((k) => k.by && k.by + 18 >= now && k.by + 18 - now <= 10);
      if (kid && pr.college.help !== "none") add("saving-for-college", `${kid.name || "Your child"} starts college in ${(kid.by ?? 0) + 18}.`);
      if (R.success != null && R.success < 0.8) add("fixed-or-flexible", `Your plan lasted in ${Math.round(R.success * 100)}% of past markets; flexible spending can raise that.`);
      if (H.mortgage > 0 && retire != null) add("mortgage-payoff", "You're carrying a mortgage toward retirement.");
    }
    // Then the curriculum in order.
    for (const l of lessons) add(l.slug, !own && l.slug === lessons[0]?.slug ? "Start here: what a plan answers, and what the rest of Learn covers." : "Next in the curriculum.");
    return out;
  }, [own, data, lessons, read]);
}
