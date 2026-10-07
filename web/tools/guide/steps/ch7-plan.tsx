"use client";

/* Chapter 7 · Your plan and toolkit (doc 2, "The plan and the hand-off"):
   the number beside the score, the next moves as a checklist whose ticks
   persist, what's going well, the tools that matter for this plan, the
   plan in rows with its sources, and the snapshot that finishing keeps.
   Welcome back (doc 2) greets a returning visitor with the last snapshot
   and what has moved since. Everything here reads the plan the worker ran. */

import { useState } from "react";
import Link from "next/link";
import { opTacticsLine } from "@/tools/optimizer/words";
import { fmtNum, money, pctStr } from "@/lib/format";
import { Html } from "@/components/common/Html";
import { KV } from "@/components/common/Readout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDownIcon } from "lucide-react";
import { useToast } from "@/components/shell/Toast";
import { FACTORS, coastNow, minSpend, ok, rating, riskLabel, stratName, withGuess, type OptSet, type Sim } from "../calc";
import { planLists, type Move, type PlanFacts } from "../moves";
import { Ring } from "../Ring";
import { confidence, confidenceLine, headroom, planSources } from "../score";
import { keep, snapshotOf, whatMoved, type Moved } from "../snapshot";
import { SourceBadge } from "../SourceBadge";
import { stamp } from "../sources";
import { setGuide, type AnswerKey, type Answers, type GuideState, type Snapshot } from "../store";
import { tuneState } from "../tune";
import { BackNote, Callout, H3, MoneyF, Q, useGuideView } from "../ui";
import { usePlanJob } from "../usePlan";
import { and, rounded } from "../words";

interface OptionsWire { goal: number; ahead: boolean; S: Sim; list: { id: string; set: OptSet; T: Sim | null }[] }

/** The plan, what it needs and its solved options, from the worker; the
    moves, the wins and the toolkit worked out from them. */
export function usePlanFacts(a: Answers, src: GuideState["src"]) {
  const wa = withGuess(a);
  const simJ = usePlanJob<Sim>("sim", wa), needJ = usePlanJob<number>("need", wa);
  const optJ = usePlanJob<OptionsWire>("options", wa, { args: { levers: tuneState().levers }, prio: 3 });
  const F: PlanFacts = { S: simJ.res ?? null, need: needJ.res ?? null, O: optJ.res ? { ahead: optJ.res.ahead, list: optJ.res.list } : null };
  const ready = simJ.res !== undefined && needJ.res !== undefined && (simJ.res === null || optJ.res !== undefined);
  return { F, ready, stale: simJ.stale || needJ.stale || optJ.stale, L: ready ? planLists(a, src, F) : null };
}

const when = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const signed = (m: Moved) => {
  const s = m.d > 0 ? "+" : "−", x = Math.abs(m.d);
  if (m.kind === "money") return s + money(x);
  if (m.kind === "pct") return s + pctStr(x, 0).replace("%", " points");
  if (m.kind === "pts") return s + x + (x === 1 ? " point" : " points");
  if (m.kind === "age") return s + fmtNum(x) + (x === 1 ? " year" : " years");
  return s + x;
};
const at = (m: Moved, v: number) => (m.kind === "money" ? rounded(v) : m.kind === "pct" ? pctStr(v, 0) : fmtNum(v));

/** What moved since a snapshot: only what changed, signed. */
export function MovedList({ list, since }: { list: Moved[]; since: Snapshot }) {
  if (!list.length) return <p className="gd-means-empty" data-moved="none">Nothing has moved since {when(since.at)}.</p>;
  return (
    <ul className="gd-moved" data-moved="">
      {list.map((m) => <li key={m.k}><span>{m.label}</span><b>{signed(m)}</b><em>{at(m, m.from)} to {at(m, m.to)}</em></li>)}
    </ul>
  );
}

/** The next moves, as a checklist; a tick is kept with the date. */
function Moves({ list, g }: { list: Move[]; g: GuideState }) {
  const G = useGuideView();
  const tick = (id: string, on: boolean) => { setGuide((x) => { x.moves = { ...x.moves, [id]: { done: on, at: stamp() } }; }); G.redraw(); };
  return (
    <ol className="gd-moves">
      {list.map((m) => {
        const done = !!g.moves[m.id]?.done;
        return (
          <li key={m.id} className={"gd-move" + (done ? " done" : "")} data-move={m.id}>
            <Checkbox id={"gdmv-" + m.id} checked={done} onCheckedChange={(on) => tick(m.id, !!on)} aria-describedby={"gdmv-" + m.id + "-d"} />
            <div className="b">
              <label htmlFor={"gdmv-" + m.id} className="t">{m.t}</label>
              <Html as="p" id={"gdmv-" + m.id + "-d"} html={m.d} />
              <div className="meta"><span className="when">{m.when}</span>{m.pts ? <span className="pts">Up to {m.pts} {m.pts === 1 ? "point" : "points"}</span> : null}
                {m.trip ? <Button variant="outline" size="sm" data-trip={m.trip} data-from="plan" onClick={() => G.trip(m.trip!, "plan")}>{m.btn}<i className="arw" aria-hidden="true"></i></Button> : null}
                {m.go ? <Button variant="outline" size="sm" data-go={m.go} onClick={() => G.go(m.go!)}>{m.btn}</Button> : null}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const LABELS: Partial<Record<AnswerKey, string>> = {
  age: "Your age", spouseAge: "Spouse's age", retire: "Retire at", income: "Income", income2: "Spouse's income", takehome: "Take-home", spend: "Spending",
  cash: "Cash savings", debtTotal: "Debt, besides a mortgage", saved: "Saved for retirement", contrib: "You contribute", employer: "Employer adds",
  risk: "How it's invested", rothNow: "In Roth", brokNow: "In brokerage", retSpend: "Spending in retirement", ssOwn: "Your Social Security", ssOwn2: "Spouse's Social Security",
  pension: "Pension",
};
function answerText(k: AnswerKey, a: Answers): string {
  const v = a[k];
  if (k === "risk") return riskLabel(v as number);
  if (["age", "spouseAge", "retire"].includes(k)) return fmtNum(v as number);
  const per = ["takehome", "spend", "contrib", "employer", "ssOwn", "ssOwn2", "pension"].includes(k) ? "/mo" : ["income", "income2", "retSpend"].includes(k) ? "/yr" : "";
  return money(v as number) + per;
}

/* ---------- Card 12 · Your plan ---------- */
export function PlanCard() {
  const G = useGuideView(), { a, g } = G, toast = useToast();
  const { F, ready, stale, L } = usePlanFacts(a, g.src);
  const S = F.S;
  if (!ready || !L) return <><Q>Your plan</Q><p className="gd-means-empty">Working it out…</p></>;
  const R = L.R, rt = rating(R.score);
  if (R.score == null || !S) return (
    <>
      <Q>Your plan</Q>
      <BackNote step="plan" />
      <Callout cls="warn">There isn&apos;t enough to score yet. Answer the questions before this one and your plan will appear here.</Callout>
      <Button size="lg" data-gd="resume" onClick={() => G.act("resume")}>Go to the next open question</Button>
    </>
  );
  const have = FACTORS.filter((f) => R.P[f.id]);
  const full = have.filter((f) => R.P[f.id]!.p >= 0.995).map((f) => f.name.toLowerCase());
  const worst = have.map((f) => ({ f, h: headroom(f.id, R.P[f.id], a) })).filter((x) => x.h).sort((x, y) => y.h!.pts - x.h!.pts)[0];
  const last = g.snapshots[g.snapshots.length - 1];
  const now = F.need != null ? snapshotOf(g, S, F.need, R, L.list.map((m) => m.id), stamp()) : null;
  const src = planSources(a, g.src);
  const save = () => {
    if (!now) return;
    setGuide((x) => { keep(x, now); x.finishedAt = now.at; });
    G.redraw();
    toast("Snapshot saved. Next time, the guide opens with what's moved since.");
  };
  const savedToday = !!last && !!now && last.at.slice(0, 10) === now.at.slice(0, 10) && !whatMoved(last, now).length;
  return (
    <>
      <Q>Your plan</Q>
      <BackNote step="plan" />
      <div className="gd-hero2" aria-busy={stale || undefined}>
        <section className="gd-box" aria-labelledby="gdHeroNum">
          <h3 id="gdHeroNum" className="k">Your number</h3>
          <div className="v key" id="gdProjected">{rounded(S.fv)}</div>
          <p>On course at {fmtNum(S.retire)}{F.need != null ? <>, against about <b id="gdNeeded">{rounded(F.need)}</b> a plan like it needs</> : null}.</p>
          <p>Lasted in <b id="gdLasted">{pctStr(S.success, 0)}</b> of historical retirements since {S.H.first}.</p>
        </section>
        <section className="gd-box" aria-labelledby="gdHeroScore">
          <h3 id="gdHeroScore" className="k">Readiness score</h3>
          <div className="gd-box-score"><Ring score={R.score} size={84} /><div>
            <div className="r text-(color:--ink)" style={{ "--ink": rt.color } as React.CSSProperties} id="gdScoreNum" data-score={R.score}>{rt.label}</div>
            <div className="n">{confidenceLine(confidence(a, g.src, have.map((f) => f.id)))}</div></div></div>
          <p>{full.length ? <>Full marks for {and(full)}.</> : null}{worst ? <> {worst.f.name} has the most to give: up to {worst.h!.pts} points.</> : null}</p>
        </section>
      </div>
      {last && now ? <div className="gd-since"><H3>Since your snapshot of {when(last.at)}</H3><MovedList list={whatMoved(last, now)} since={last} /></div> : null}
      {L.list.length ? <><H3>Your next moves, in order</H3><Moves list={L.list} g={g} /></> : null}
      {L.wins.length ? <><H3>What&apos;s going well</H3><div className="gd-wins">{L.wins.map((f) => <Badge key={f.id} variant="positive">{f.name}: {R.P[f.id]!.txt}</Badge>)}</div></> : null}
      <H3>Your toolkit</H3>
      <div className="gd-kit">{L.kit.map((k) => (
        <div key={k.id} className="gd-kit-card" data-kit={k.id}>
          <b>{k.name}</b><span className="why">{k.why}</span><p>{k.q}</p>
          {k.trip ? <Button variant="outline" size="sm" data-trip={k.trip} data-from="plan" onClick={() => G.trip(k.trip!, "plan")}>Open it with your numbers<i className="arw" aria-hidden="true"></i></Button>
            : <Button variant="outline" size="sm" data-go={k.go} onClick={() => G.go(k.go!)}>Open it on your plan</Button>}
        </div>
      ))}</div>
      <p className="gd-kit-all"><Link href="/tools">All 20 tools, by what they answer</Link></p>
      <div className="gd-more-detail gd-summary"><Collapsible>
        <CollapsibleTrigger data-more="summary">Plan summary, sources and method<ChevronDownIcon aria-hidden="true" /></CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid gap-x-8 md:grid-cols-2">
            <div className="min-w-0"><H3>The plan</H3><div className="gd-kvs">
              <KV k="Retire at" v={fmtNum(S.retire)} />
              <KV k="Saving" v={S.stop != null ? (S.stop <= a.age! ? "Coasting: no new savings" : money(S.monthly) + "/mo until " + fmtNum(S.stop) + ", then coasting") : money(S.monthly) + "/mo until you retire"} />
              <KV k="Spending in retirement" v={money(S.spend) + " a year"} />
              <KV k="Social Security" v={S.ss.a2 > 0 ? money(S.ss.a1 / 12) + "/mo from " + S.ss.claim + ", spouse " + money(S.ss.a2 / 12) + "/mo from " + S.ss.claim2 : money(S.ss.total / 12) + "/mo from " + S.ss.claim} />
              {S.pension ? <KV k="Pension" v={money(S.pension / 12) + "/mo"} /> : null}
              <KV k="Withdrawals" v={S.tactics ? opTacticsLine(S.T, S.C) : "Brokerage, then traditional, then Roth"} />
              <KV k="Income tax" v={"About " + money(S.taxYr) + " a year, " + money(S.lifeTax) + " in all"} />
              <KV k="Approach" v={stratName(a.strategy || "fixed")} />
              {minSpend(a) ? <KV k="Minimum spending" v={money(minSpend(a)) + " a year"} /> : null}
              <KV k="Stocks in retirement" v={S.mix + "%"} />
            </div></div>
            <div className="min-w-0"><H3>Your numbers, and where they came from</H3><div className="gd-kvs">
              {(Object.keys(LABELS) as AnswerKey[]).filter((k) => ok(a[k])).map((k) => (
                <KV key={k} k={LABELS[k]} v={<>{k === "contrib" && coastNow(a) ? "Nothing new: coasting" : answerText(k, a)} <SourceBadge s={g.src[k]} kind={g.src[k] ? undefined : "entered"} /></>} />
              ))}
            </div></div>
          </div>
          <p className="hint">Everything is in today&apos;s dollars. Savings grow at the {riskLabel(S.real)} mix&apos;s {pctStr(S.real, 1)} a year after inflation, with saving rising with prices.
            {" "}Retirement is replayed through every historical retirement since {S.H.first}, spending a fixed amount that rises with inflation, with each year&apos;s income tax,
            {" "}Medicare surcharge and health insurance before 65 paid on top.{src.estimated.length ? " Estimated: " + and(src.estimated) + "." : ""}
            {src.defaults.length ? " Defaults: " + and(src.defaults) + "." : ""} A rule-of-thumb check, not financial advice; it leaves out home equity.</p>
        </CollapsibleContent>
      </Collapsible></div>
      <div className="gd-share">
        <Button size="lg" data-gd="snapshot" disabled={!now || savedToday} onClick={save}>{savedToday ? "Snapshot saved" : "Save a snapshot and finish"}</Button>
        <Button variant="outline" data-gd="print" onClick={() => G.act("print")}>Print or save as PDF</Button>
        <Button variant="outline" data-gd="share" onClick={() => G.act("share")}>Copy a link to this plan</Button>
        <span className="hint">The link carries your answers, so share it only with people you&apos;d show your finances to.</span></div>
      {g.pace === "quick" ? <Callout>The Quick check is done. The Full walkthrough adds the deeper cards and the trips into the tools, and keeps every answer.{" "}
        <Button variant="quiet" size="inline" data-gd="pace:full" onClick={() => G.act("pace:full")}>Switch to the Full walkthrough</Button></Callout> : null}
    </>
  );
}

export function PlanFoot() {
  const G = useGuideView();
  return (
    <>
      <Button variant="outline" size="lg" data-gd="prev" onClick={() => G.act("prev")}><i className="arw back" aria-hidden="true"></i>Back</Button><span className="sp"></span>
      <Button variant="outline" size="lg" data-gd="restart" onClick={() => G.act("restart")}>Start over</Button>
      <Button variant="outline" size="lg" className="max-sm:flex-auto" data-go="about" onClick={() => G.go("about")}>Review my answers</Button>
    </>
  );
}

/* ---------- Welcome back ---------- */
export function WelcomeBack({ done }: { done: () => void }) {
  const G = useGuideView(), { a, g } = G;
  const [seen, setSeen] = useState(false);
  const { F, ready, L } = usePlanFacts(a, g.src);
  const last = g.snapshots[g.snapshots.length - 1];
  const now = ready && L && F.S && F.need != null ? snapshotOf(g, F.S, F.need, L.R, L.list.map((m) => m.id), stamp()) : null;
  return (
    <>
      <Q>Welcome back</Q>
      <p className="gd-lead">Your last snapshot, from {when(last.at)}: on course for <b>{rounded(last.fv)}</b> at {fmtNum(last.retire)} against about {rounded(last.need)} needed,
        {" "}lasting in {pctStr(last.success, 0)} of history, with a score of <b>{last.score ?? "—"}</b>.</p>
      <H3>Anything changed? Bring these up to date</H3>
      <div className="gd-fields">
        <MoneyF k="saved" label="Saved for retirement" />
        <MoneyF k="contrib" label="You contribute" per="/mo" />
        <MoneyF k="cash" label="Cash savings" />
      </div>
      {seen ? (now ? <div className="gd-since"><H3>What moved since {when(last.at)}</H3><MovedList list={whatMoved(last, now)} since={last} /></div>
        : <p className="gd-means-empty">Working it out…</p>) : null}
      {L && L.list.length ? <><H3>Your moves</H3><Moves list={L.list} g={g} /></> : null}
      <div className="gd-share">
        <Button size="lg" data-gd="moved" onClick={() => setSeen(true)} disabled={seen}>See what changed</Button>
        <Button variant="outline" data-go="plan" onClick={() => { done(); G.go("plan"); }}>Open my plan</Button>
        <Button variant="outline" data-go="about" onClick={() => { done(); G.go("about"); }}>Review every answer</Button>
      </div>
    </>
  );
}
