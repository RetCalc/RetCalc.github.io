/* Children in the Stages calculator: the walkthrough's "Planning for kids"
   (tools/plan), counted in years from now instead of by your age, since
   Stages has no age. The stages are rebuilt over the same total years,
   starting from the first stage's saving, return and pay schedule; each
   saves that less what its children cost beyond today's (today's are
   already paid for). Without the account split, the cost comes out of
   saving one for one; with it, out of each account as "How will you cover
   this?" says. No React. */
import { PER_YEAR } from "@/lib/engine/typed";
import { groupDigits, parseNum } from "@/lib/format";
import { COVER_ORDER, type PlanKids } from "@/tools/plan/model";
import { coverStage, kidStages, stageKey, type KidStage, type Monthly } from "@/tools/plan/kids";
import { stageGlideYears, stageSplit, type StageInputs, type StagesInputs } from "./model";

/** The children are placed from this age; only differences from it are
    shown (Years 0 to 2), so any adult age gives the same stages. */
export const KID_BASE = 40;

const cents = (v: number) => Math.round(v * 100) / 100;

/** The years the stages cover in all, whole or half. */
export function stagesYears(list: StageInputs[]): number {
  return Math.round(list.reduce((s, st) => s + Math.max(0, parseNum(st.years) || 0), 0) * 2) / 2;
}

/** The first stage's saving a month, by account: its split with the account
    types on, all of it as one pot (counted as brokerage, cut one for one)
    with them off. */
export function stagesMonthly(s: StagesInputs): { today: Monthly; ppy: number } {
  const first = s.stages[0];
  const ppy = PER_YEAR[first?.period ?? "Monthly"] ?? 12;
  const mo = ((parseNum(first?.contrib ?? "0") || 0) * ppy) / 12;
  if (!s.saOn) return { today: { brok: mo, roth: 0, trad: 0, hsa: 0 }, ppy };
  const sp = stageSplit(first ?? {});
  return { today: { brok: mo * sp.b, roth: mo * sp.r, trad: mo * sp.t, hsa: mo * sp.h }, ppy };
}

/** The children's stages over the plan's years. */
export function stagesKidSegs(s: StagesInputs, k: PlanKids | null): KidStage[] {
  const years = stagesYears(s.stages);
  return years > 0 ? kidStages(k, KID_BASE, KID_BASE + years) : [];
}

/** The stages rebuilt around the children, and how many of them can't save
    anything because the children cost more than the saving. */
export function stagesFromKidsYears(s: StagesInputs, k: PlanKids, cover: Record<string, Partial<Monthly>>): { stages: StageInputs[]; short: number } {
  const first = s.stages[0], last = s.stages[s.stages.length - 1];
  const segs = stagesKidSegs(s, k);
  if (!first || !segs.length) return { stages: s.stages, short: 0 };
  const { today, ppy } = stagesMonthly(s);
  let short = 0;
  const stages = segs.map((seg, i): StageInputs => {
    const c = coverStage(seg.change, today, s.saOn ? cover[stageKey(seg)] : undefined);
    if (c.short > 0) short++;
    const m = Object.fromEntries(COVER_ORDER.map((a) => [a, Math.max(0, today[a] - c.take[a])])) as Monthly;
    const total = m.brok + m.roth + m.trad + m.hsa, years = seg.to - seg.from;
    const lastOne = i === segs.length - 1;
    // The first stage's rates and schedule; its typed split amounts and its
    // account shares are worked out again below.
    const keep: StageInputs = { ...first };
    delete keep.cT; delete keep.cR; delete keep.cB; delete keep.cH; delete keep.sTrad; delete keep.sRoth; delete keep.sHsa;
    return {
      ...keep,
      name: seg.label, years: String(years), contrib: groupDigits(cents((total * 12) / ppy), true),
      // Each later stage is in today's dollars, restated at its start.
      adj: i > 0 ? true : first.adj,
      // A glide only makes sense at the true end, so the last stage keeps it.
      glideOn: lastOne && last.glideOn, glideEnd: lastOne && last.glideOn ? last.glideEnd : "",
      glideYears: lastOne && last.glideOn ? stageGlideYears(String(years), last.glideYears) : "",
      ...(s.saOn ? (total > 0 ? { sTrad: m.trad / total, sRoth: m.roth / total, ...(m.hsa > 0 ? { sHsa: m.hsa / total } : {}) } : { sTrad: first.sTrad, sRoth: first.sRoth, ...(first.sHsa ? { sHsa: first.sHsa } : {}) }) : {}),
    };
  });
  return { stages, short };
}

export { readCover, readKids } from "@/tools/plan/kidsRead";
