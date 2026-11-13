"use client";

/* If things go wrong, on the Plan summary: the plan against five hard
   events (a partner dying, a year without work, retiring into a bad
   market, long-term care, Social Security paying less), each with its
   chance of success and the middle market against the plan's own, and
   whether it holds up. The runs (stress-plan.ts) are worked out after the
   page draws and shared with the Dashboard's Chance of success tile. */

import { useEffect, useState } from "react";
import { UmbrellaIcon } from "lucide-react";
import { MoneyField, NumberField } from "@/components/fields/Field";
import { Fold, Empty, Tip, TipLabel, To } from "./ui";
import { useTyped, txt, num } from "./fields";
import { money, pctDown, shortMoney } from "./format";
import { toAges, type Results } from "./model";
import { CARE_DEFAULT, type RunSet } from "./stress";
import { STRESS_NAMES, STRESS_TIPS, lifeCover, lifeCoverCached, stressCached, stressTests, type Stress, type StressTest } from "./stress-plan";
import { useDashboard, type Entry, type Profile } from "./store";

/** The tests, worked out after the page draws (each is a run of the plan
    across history); the last answer shows until the new one is in.
    Undefined until the first is in; null when the plan can't run yet. */
export function useStress(pr: Profile, entries: Entry[], R: Results): Stress | null | undefined {
  const key = JSON.stringify([pr, entries]);
  const [st, setSt] = useState<{ key: string; s: Stress | null } | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setSt({ key, s: stressTests(pr, entries, R) }), 0);
    return () => clearTimeout(t);
  }, [key, pr, entries, R]);
  const hit = stressCached(pr, entries);
  return hit !== undefined ? hit : st ? st.s : undefined;
}

/** Life insurance that would cover a partner's death: a few more runs,
    after the tests are in. */
function useCover(pr: Profile, entries: Entry[], S: Stress | null | undefined): number | null | undefined {
  const key = JSON.stringify([pr, entries]);
  const [st, setSt] = useState<{ key: string; v: number | null } | null>(null);
  useEffect(() => {
    if (!S) return;
    const t = setTimeout(() => setSt({ key, v: lifeCover(pr, entries, S) }), 0);
    return () => clearTimeout(t);
  }, [key, pr, entries, S]);
  const hit = lifeCoverCached(pr, entries);
  return hit !== undefined ? hit : st?.key === key ? st.v : undefined;
}

/** The tally in words: "Holds up in 3 of 5 stress tests". */
export const heldWords = (S: Stress) => `Holds up in ${S.held} of ${S.of} stress ${S.of === 1 ? "test" : "tests"}`;

/** The middle market in words: what's left and when, or the age it ran out. */
function midWords(m: RunSet["mid"], R: Results, who: string, two: boolean): string {
  if (m.outAge != null) return `Runs out at ${two ? who + "'s " : ""}${m.outAge}`;
  return `${shortMoney(Math.round(m.end / 1000) * 1000)} left at ${toAges(R).replace(/^ages? /, "")}`;
}
/** A chance in points against the plan's own: "−6 points", or nothing when the same. */
function pointsWords(base: number, x: number): string | null {
  const d = Math.round((x - base) * 100);
  return d === 0 ? null : `${d > 0 ? "+" : "−"}${Math.abs(d)} ${Math.abs(d) === 1 ? "point" : "points"}`;
}

function Badge({ ok }: { ok: boolean }) {
  return <span className={ok ? "dsh-badge dsh-gain" : "dsh-badge dsh-st-short"}>{ok ? "Holds up" : "Falls short"}</span>;
}

/** When a test's event happens, in a few words. */
function whenWords(t: StressTest, two: boolean): string {
  if (t.year == null) return "";
  if (t.id === "ss") return `From ${t.year}`;
  return `${t.year}, ${two || t.id === "work" ? t.who + " " : "age "}${t.age}`;
}

function Row({ t, S, R, two, cover, pct }: { t: StressTest; S: Stress; R: Results; two: boolean; cover: number | null | undefined; pct?: number | null }) {
  const name = STRESS_NAMES[t.id];
  const sub = t.id === "death" ? (cover === undefined ? "Life insurance that would cover it: working it out…" : cover == null ? "No one-time sum brings the chance back" : cover === 0 ? "No life insurance needed to keep your chance" : `Life insurance that would cover it: ${money(cover)}`)
    : t.id === "work" && t.work ? `${shortMoney(t.work.need)} of spending from savings` + (R.atRetire != null && t.work.atRetire != null && R.atRetire - t.work.atRetire >= 500 ? `, ${shortMoney(Math.round((R.atRetire - t.work.atRetire) / 1000) * 1000)} less at retirement` : "")
    : t.id === "care" && t.care ? `${money(t.care.amount)} per year for ${t.care.years} ${t.care.years === 1 ? "year" : "years"}`
    : t.id === "ss" && t.ss ? (t.ss.already ? `Your plan already counts ${pct ?? 100}% of each benefit` : `${Math.round(t.ss.share * 100)}% of each benefit`)
    : null;
  return (
    <div className="dsh-st-row" role="row">
      <div className="dsh-st-name" role="cell">
        <TipLabel text={name} id={STRESS_TIPS[t.id]} />
        {sub ? <span className="dsh-cap">{sub}{t.id === "death" && cover ? <> <Tip id="lifeCover" title="Life insurance that would cover it" /></> : null}</span> : null}
      </div>
      <div className="dsh-st-when" role="cell">{whenWords(t, two)}</div>
      {t.id === "market" && t.starts ? (
        <ul className="dsh-st-years" role="cell" aria-label="Each start">
          {t.starts.map((s) => (
            <li key={s.year} data-out={s.outAge != null ? "" : undefined}><b>{s.year}</b>{s.outAge != null ? `runs out at ${two ? t.who + "'s " : ""}${s.outAge}` : `${shortMoney(Math.round(s.end / 1000) * 1000)} left`}</li>
          ))}
        </ul>
      ) : t.event ? <>
        <div className="dsh-st-fig" role="cell">{pctDown(t.event.rate)}%{pointsWords(S.base.rate, t.event.rate) ? <span className="dsh-cap">{pointsWords(S.base.rate, t.event.rate)}</span> : null}</div>
        <div className="dsh-st-mid" role="cell">{midWords(t.event.mid, R, t.who, two)}</div>
      </> : <><div role="cell" /><div role="cell" /></>}
      <div className="dsh-st-badge" role="cell"><Badge ok={t.holds} /></div>
    </div>
  );
}

/** Long-term care as tested: the amount per year and the years, kept in
    the profile. */
function CareFields() {
  const { data, setProfile } = useDashboard();
  const c = { ...CARE_DEFAULT, ...data.profile.stress?.care };
  const [amount, setAmount] = useTyped(txt(c.amount));
  const [years, setYears] = useTyped(String(c.years));
  const set = (over: { amount?: number; years?: number }) => setProfile((p) => ({ ...p, stress: { ...p.stress, care: { ...p.stress?.care, ...over } } }));
  return (
    <div className="dsh-st-assume">
      <div className="dsh-label">Assumptions you can change</div>
      <div className="dsh-row dsh-pair">
        <MoneyField id="dshCareAmt" label={<TipLabel text="Long-term care, per year" id="stressCare" />} value={amount}
          onValueChange={(v) => { setAmount(v); const n = num(v); if (n != null) set({ amount: Math.max(0, Math.round(n)) }); }} />
        <NumberField id="dshCareYears" label="For how many years" unit="years" step={1} max={20} value={years}
          onValueChange={(v) => { setYears(v); const n = num(v); if (n != null) set({ years: Math.max(1, Math.min(20, Math.round(n))) }); }} />
      </div>
    </div>
  );
}

export function StressTests({ pr, entries, R }: { pr: Profile; entries: Entry[]; R: Results }) {
  const S = useStress(pr, entries, R), cover = useCover(pr, entries, S);
  if (!R.S) return <Empty icon={UmbrellaIcon} title="If things go wrong" ghost="— of 5" text="How your plan holds up if a partner dies, work stops for a year, markets fall as you retire, care is needed or Social Security pays less. It fills in once your plan runs." action="Fill in your profile" href="/dashboard/profile" />;
  const two = pr.who === "couple";
  const summary = S === undefined ? "Testing your plan against hard events…" : S ? heldWords(S) + (S.held < S.of ? "; falls short: " + S.tests.filter((t) => !t.holds).map((t) => STRESS_NAMES[t.id]).join(", ") : "") : "Fills in once your plan runs";
  return (
    <Fold icon={UmbrellaIcon} title="If things go wrong" summary={summary} id="stress">
      {S ? (
        <div>
          <div className="dsh-stats">
            <div className="dsh-stat"><div className="dsh-label"><TipLabel text="Chance of success, as planned" id="chance" /></div><div className="dsh-fig dsh-md">{pctDown(S.base.rate)}%</div></div>
            <div className="dsh-stat"><div className="dsh-label"><TipLabel text="Stress tests it holds up in" id="stressHolds" /></div><div className="dsh-fig dsh-md">{S.held}<small>of {S.of}</small></div></div>
            <div className="dsh-stat"><div className="dsh-label"><TipLabel text="Middle market, as planned" id="stressMedian" /></div><div className="dsh-fig dsh-md">{S.base.mid.outAge != null ? S.base.mid.outAge : shortMoney(Math.round(S.base.mid.end / 1000) * 1000)}<small>{S.base.mid.outAge != null ? "runs out at this age" : "left at " + toAges(R).replace(/^ages? /, "")}</small></div></div>
          </div>
          <div className="dsh-st-table" role="table" aria-label="Your plan against each hard event">
            <div className="dsh-st-row dsh-st-head" role="row">
              <span role="columnheader">If this happens</span><span role="columnheader">When</span>
              <span role="columnheader" className="dsh-st-fig">Chance of success</span><span role="columnheader">Middle market</span><span role="columnheader" />
            </div>
            {S.tests.map((t) => <Row key={t.id} t={t} S={S} R={R} two={two} cover={cover} pct={pr.ss.pct} />)}
          </div>
          <CareFields />
        </div>
      ) : S === null ? <p className="dsh-cap">{R.gap ?? "Fills in once your plan runs."}</p> : null}
    </Fold>
  );
}

/** The tally for the Dashboard's Chance of success tile, linking here. */
export function StressLine({ pr, entries, R }: { pr: Profile; entries: Entry[]; R: Results }) {
  const S = useStress(pr, entries, R);
  if (!R.S || !S) return null;
  return <div className="dsh-cap dsh-mt6"><To href="/dashboard/summary#stress">{heldWords(S)}</To></div>;
}

