"use client";

/* If things go wrong, on the Plan summary: the plan against five hard
   events (a partner dying, a year without work, retiring into a bad
   market, long-term care, Social Security paying less), each with its
   chance of success and the middle market against the plan's own, and
   whether it holds up. The runs (stress-plan.ts) are worked out after the
   page draws and shared with the Dashboard's Chance of success tile. */

import { useEffect, useState } from "react";
import { UmbrellaIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { MoneyField, NumberField } from "@/components/fields/Field";
import { Fold, Empty, Tip, TipLabel, To } from "./ui";
import { txt, num } from "./fields";
import { money, pctDown, shortMoney } from "./format";
import { nameOf, toAges, type Results } from "./model";
import { type RunSet } from "./stress";
import { STRESS_NAMES, STRESS_TIPS, lifeCover, lifeCoverCached, olderOf, stressAssume, stressCached, stressTests, type Stress, type StressId, type StressTest } from "./stress-plan";
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

/** What a test assumes, in a few words: when it happens, or for Social
    Security, the share paid. The link that opens its assumptions. */
function whenWords(t: StressTest, two: boolean): string {
  if (t.id === "ss" && t.ss) return `${Math.round(t.ss.share * 100)}% of benefits paid`;
  if (t.year == null) return "";
  return `${t.year}, ${two || t.id === "work" ? t.who + " " : "age "}${t.age}`;
}

function Row({ t, S, R, two, cover, pct, onEdit }: { t: StressTest; S: Stress; R: Results; two: boolean; cover: number | null | undefined; pct?: number | null; onEdit: (id: StressId) => void }) {
  const name = STRESS_NAMES[t.id];
  const sub = t.id === "death" ? (cover === undefined ? "Life insurance that would cover it: working it out…" : cover == null ? "No one-time sum brings the chance back" : cover === 0 ? "No life insurance needed to keep your chance" : `Life insurance that would cover it: ${money(cover)}`)
    : t.id === "work" && t.work ? (two ? (t.work.whose === 2 ? "Both pays stop; " : `${t.who}'s pay stops; `) : "") + `${shortMoney(t.work.need)} of spending from savings` + (R.atRetire != null && t.work.atRetire != null && R.atRetire - t.work.atRetire >= 500 ? `, ${shortMoney(Math.round((R.atRetire - t.work.atRetire) / 1000) * 1000)} less at retirement` : "")
    : t.id === "care" && t.care ? `${money(t.care.amount)} per year for ${t.care.years} ${t.care.years === 1 ? "year" : "years"}`
    : t.id === "ss" && t.ss ? (t.ss.already ? `Your plan already counts ${pct ?? 100}% of each benefit` : `Every benefit ${100 - Math.round(t.ss.share * 100)}% lower`)
    : null;
  const when = whenWords(t, two);
  return (
    <div className="dsh-st-row" role="row">
      <div className="dsh-st-name" role="cell">
        <TipLabel text={name} id={STRESS_TIPS[t.id]} />
        {sub ? <span className="dsh-cap">{sub}{t.id === "death" && cover ? <> <Tip id="lifeCover" title="Life insurance that would cover it" /></> : null}</span> : null}
      </div>
      <div className="dsh-st-when" role="cell">{t.id === "market" ? when : <Button variant="link" size="inline" onClick={() => onEdit(t.id)} title="Change what this test assumes">{when || "Set it"}</Button>}</div>
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

export function StressTests({ pr, entries, R }: { pr: Profile; entries: Entry[]; R: Results }) {
  const S = useStress(pr, entries, R), cover = useCover(pr, entries, S);
  const [editing, setEditing] = useState<StressId | null>(null);
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
            {S.tests.map((t) => <Row key={t.id} t={t} S={S} R={R} two={two} cover={cover} pct={pr.ss.pct} onEdit={setEditing} />)}
          </div>
          {editing ? <AssumeDialog id={editing} onClose={() => setEditing(null)} /> : null}
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

/** A test's assumptions, in a small window: saved to the profile, and the
    tests run again with them. "Use the usual" goes back to the defaults. */
function AssumeDialog({ id, onClose }: { id: StressId; onClose: () => void }) {
  const { data, setProfile } = useDashboard();
  const pr = data.profile, A = stressAssume(pr), two = pr.who === "couple";
  const names: [string, string] = [nameOf(pr, 0), nameOf(pr, 1)];
  const [who, setWho] = useState<number>(id === "death" ? A.death.who : A.work.who);
  const [age, setAge] = useState(String(id === "death" ? A.death.age : id === "work" ? A.work.age : A.care.age));
  const [pct, setPct] = useState(String(Math.round((id === "death" ? A.death.spend : A.ss.share) * 100)));
  const [amount, setAmount] = useState(txt(A.care.amount));
  const [years, setYears] = useState(String(A.care.years));
  const n = (v: string, lo: number, hi: number) => { const x = num(v); return x == null ? null : Math.max(lo, Math.min(hi, Math.round(x))); };
  const put = (over: NonNullable<Profile["stress"]>) => { setProfile((p) => ({ ...p, stress: { ...p.stress, ...over } })); onClose(); };
  const save = () => {
    if (id === "death") put({ death: { who: who ? 1 : 0, age: n(age, 30, 110) ?? A.death.age, spend: n(pct, 0, 100) ?? Math.round(A.death.spend * 100) } });
    else if (id === "work") put({ work: { who: (two ? who : 0) as 0 | 1 | 2, age: n(age, 18, 90) ?? A.work.age } });
    else if (id === "care") put({ care: { amount: n(amount, 0, 1e7) ?? A.care.amount, years: n(years, 1, 20) ?? A.care.years, age: n(age, 50, 110) ?? A.care.age } });
    else if (id === "ss") put({ ss: { share: n(pct, 0, 100) ?? Math.round(A.ss.share * 100) } });
  };
  const reset = () => { setProfile((p) => { const s = { ...p.stress }; delete s[id as "death" | "work" | "care" | "ss"]; return { ...p, stress: s }; }); onClose(); };
  const whoAge = id === "work" ? (who === 1 ? names[1] : names[0]) : id === "death" ? names[who ? 1 : 0] : null;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent aria-labelledby="dshStTitle">
        <h2 id="dshStTitle" className="dsh-dlg-h">{STRESS_NAMES[id]}</h2>
        <form className="dsh-cellform" onSubmit={(e) => { e.preventDefault(); save(); }}>
          {(id === "death" || id === "work") && two ? (
            <Segmented aria-label={id === "death" ? "Who dies" : "Whose pay stops"}>
              <SegmentedItem pressed={who === 0} onPressedChange={() => setWho(0)}>{names[0]}</SegmentedItem>
              <SegmentedItem pressed={who === 1} onPressedChange={() => setWho(1)}>{names[1]}</SegmentedItem>
              {id === "work" ? <SegmentedItem pressed={who === 2} onPressedChange={() => setWho(2)}>Both</SegmentedItem> : null}
            </Segmented>
          ) : null}
          {id === "care" ? <MoneyField id="dshStAmt" label="Care, per year in today's dollars" value={amount} onValueChange={setAmount} /> : null}
          {id === "care" ? <NumberField id="dshStYears" label="For how many years" unit="years" step={1} max={20} value={years} onValueChange={setYears} /> : null}
          {id !== "ss" ? <NumberField id="dshStAge" label={id === "care" ? (two ? `From when ${nameOf(pr, olderOf(pr))} is` : "From age") : two && whoAge ? `When ${whoAge} is` : "At age"} unit="years old" step={1} value={age} onValueChange={setAge} /> : null}
          {id === "death" ? <NumberField id="dshStSpend" label="Spending after, as a share of what you spent together" unit="%" step={5} max={100} value={pct} onValueChange={setPct} /> : null}
          {id === "ss" ? <NumberField id="dshStShare" label="Share of each benefit paid" unit="%" step={1} max={100} value={pct} onValueChange={setPct} /> : null}
          <p className="dsh-cap">{id === "work" ? "Kept between next year and the last year of work." : id === "death" ? "Social Security pays only the larger of your two benefits from then." : id === "ss" ? "Every benefit in your plan at this share, for your whole retirement." : "On top of your strategy's spending, rising with prices."}</p>
          <div className="dsh-navbtns dsh-wrapbtns">
            <Button type="submit">Save</Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            {pr.stress?.[id as "death" | "work" | "care" | "ss"] ? <Button type="button" variant="link" onClick={reset}>Use the usual</Button> : null}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
