/* The full report's pages (REPORT_BRIEF.md, direction C): a black band on
   every page with the title, the RetCalc mark and the page number; the
   household's story up front; the advisor's appendix at the back. Each page
   is a fixed US Letter sheet. The words follow the plan: ahead or behind,
   one person or two, every start lasting or not. */

import { Html } from "@/components/common/Html";
import { fmtNum, money, pctStr } from "@/lib/format";
import { STATE_OPTIONS } from "@/lib/states";
import { opTacticsLine } from "@/tools/optimizer/words";
import { CARE_AREAS, careAreaOf, earlyCost, householdAtRetire } from "../schedule";
import { rounded } from "../words";
import {
  C, ClaimLadder, CollegeBars, CollegeTimeline, DebtLines, HistoryBars, StackBars, HomeStrip, IncomeBars, IncomeKey, LifeMap, LifetimeBars, NeedBars, OUT_COLOR, PHASE_COLOR,
  ReportMark, ScoreBar, Stairs, Trail, TwoPaths, YearBars, collegeColor, SOURCE_COLOR,
} from "./charts";
import type { PageInfo, ReportModel } from "./model";

const Brand = () => <span className="rp-brand"><ReportMark />RetCalc</span>;
const Est = ({ on, children }: { on?: boolean; children: React.ReactNode }) => (on ? <span className="rp-est">{children}</span> : <>{children}</>);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "a, b and c", safe for items with commas in them ("$21,000"). */
const and = (l: string[]) => (l.length < 2 ? l.join("") : l.slice(0, -1).join(", ") + " and " + l[l.length - 1]);
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const num = (n: number) => (n >= 0 && n <= 12 ? WORDS[n] : fmtNum(n));

/** A page after the cover: the slim band, the body and the footer. */
function Sheet({ M, p, foot, children }: { M: ReportModel; p: PageInfo; foot?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rp-page" aria-label={p.title}>
      <div className="rp-band slim"><div><h2>{p.title}</h2>{p.because ? <div className="rp-because">{p.because}</div> : null}</div>
        <div className="rp-band-r"><Brand /><span className="rp-pg">{p.n}</span></div></div>
      <div className="rp-in">{children}</div>
      <div className="rp-foot"><span>{M.who.title === "Your retirement plan" ? "Retirement plan" : M.who.title + " · Retirement plan"} · {M.date}</span>
        <span>{foot ?? <>Every figure in today&apos;s dollars. <span className="rp-est">Dashed</span> figures are estimated.</>}</span></div>
    </section>
  );
}
const Lead = ({ h, children }: { h: React.ReactNode; children: React.ReactNode }) => <div className="rp-lead"><h3>{h}</h3><p>{children}</p></div>;
const Sec = ({ children }: { children: React.ReactNode }) => <h4 className="rp-sech">{children}</h4>;
const Side = ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={"rp-side" + (className ? " " + className : "")}>{children}</div>;
const Stops = ({ M, years, cols }: { M: ReportModel; years?: boolean; cols?: boolean }) => (
  <ol className={"rp-poi" + (cols ? " cols" : "")}>{M.stops.map((s, i) => (
    <li key={i}><span className="rp-num">{i + 1}</span><span><b>{s.t}, {years ? M.year0 + (s.age - M.accum[0].age) : s.age}.</b> <Est on={s.est}>{s.d}</Est></span></li>
  ))}</ol>
);
const pageOf = (M: ReportModel, id: PageInfo["id"]) => M.pages.find((p) => p.id === id)?.n;
const shortOf = (M: ReportModel) => M.factors.filter((f) => (M.R.P[f.id]?.p ?? 1) < 0.999);
const lasted = (M: ReportModel) => (M.S.H.survived === M.S.H.total ? "every retirement since " + M.S.H.first : M.S.H.survived + " of " + M.S.H.total + " historical retirements");

/* ---------- 1. cover ---------- */
function Cover({ M }: { M: ReportModel }) {
  const weak = shortOf(M);
  return (
    <section className="rp-page" aria-label="Cover">
      <div className="rp-band"><div><h1>{M.who.title}</h1><div className="rp-sub">Retirement plan · Calculated {M.date} · Every figure in today&apos;s dollars</div></div>
        <div className="rp-band-r col"><Brand /><span>The complete retirement<br />planning toolkit</span></div></div>
      <div className="rp-map"><LifeMap M={M} h={M.stops.length > 7 ? 460 : 540} />
        <div className="rp-legend"><h5>Your savings, age {M.accum[0].age} to {M.end}</h5>
          <div><i className="line" style={{ "--sw": C.trail } as React.CSSProperties} />Your plan, through the middle of history</div>
          <div><i style={{ "--sw": C.woods } as React.CSSProperties} />8 in 10 historical retirements</div>
          <div><i style={{ "--sw": C.woodsLight } as React.CSSProperties} />Every retirement since {M.S.H.first}</div>
          <div className="rp-scale"><b />10 years</div></div></div>
      <div className="rp-cols">
        <div><h5>Points along the way</h5><Stops M={M} /></div>
        <div><h5>Will it last?</h5><div className="rp-fig">{M.S.H.survived} of {M.S.H.total}</div>
          <p>{M.S.H.survived === M.S.H.total ? "It lasted in every retirement since " + M.S.H.first + ". In the worst, starting in " + M.worst.y + ", " + rounded(M.worst.end) + " was still left at " + M.end + "."
            : "It lasted in " + pctStr(M.S.success, 0) + " of retirements since " + M.S.H.first + ". Page " + pageOf(M, "last") + " shows the ones that ran out."}</p>
          <h5 className="gap">Readiness</h5><div className="rp-fig">{M.R.score} / 100</div>
          <p>{M.rating.label}. {weak.length ? (weak.length === 1 ? "The " + weak[0].name.toLowerCase() + " is the one area short of full marks." : "Short of full marks: " + and(weak.map((f) => f.name.toLowerCase())) + ".") : "Full marks in every area."}</p></div>
        <div><h5>Your number</h5><div className="rp-fig">{money(M.S.fv)}</div>
          <p>On course for this at {M.retire}. A plan like yours needs {money(M.need)}{M.S.fv >= M.need ? ", so you have room to retire earlier or spend more." : ", so there's a gap to close: page " + pageOf(M, "stand") + " shows how."}</p>
          <h5 className="gap">Social Security</h5><div className="rp-fig"><Est on={M.why.estimated.some((e) => e.startsWith("Social"))}>{money(M.S.ss.total / 12)}</Est></div>
          <p>a month{M.who.married ? " together" : ""}, claiming at {M.S.ss.claim}{M.who.married && M.S.ss.claim2 !== M.S.ss.claim ? " and " + M.S.ss.claim2 : ""}.{M.why.estimated.some((e) => e.startsWith("Social")) ? " Estimated from income." : ""}</p></div>
      </div>
      <div className="rp-foot"><span>RetCalc · retcalc.app</span><span>An educational plan, not financial advice. Past returns don&apos;t predict future ones.</span></div>
    </section>
  );
}

/* ---------- 2. where you stand ---------- */
function Stand({ M, p }: { M: ReportModel; p: PageInfo }) {
  const times = M.need > 0 ? M.S.fv / M.need : 0, ahead = M.S.fv >= M.need;
  const timesWord = times >= 2.5 ? fmtNum(Math.floor(times * 10) / 10) + " times" : times >= 1.9 ? "about twice" : times >= 1.7 ? "nearly twice" : null;
  const toc = M.pages.filter((x) => x.id !== "cover" && !(x.id === "years" && x.title.endsWith("continued")));
  const story = pageOf(M, "moves")!, appx = pageOf(M, "sources")!, last = M.pages[M.pages.length - 1].n;
  const facts: [string, React.ReactNode][] = [
    ["Retire", M.who.married ? M.who.pair(M.retire) : "At " + M.retire],
    ["Saving until then", M.changes ? "From " + money(Math.min(...M.changes.sched.map((s) => s.monthly))) + " to " + money(Math.max(...M.changes.sched.map((s) => s.monthly))) + "/mo, page " + pageOf(M, "family") : money(M.S.monthly) + "/mo, with any match"],
    ...(M.college ? [["College", money(M.college.monthly) + "/mo, page " + pageOf(M, "college")] as [string, string]] : []),
    ["Spending in retirement", money(M.S.spend) + "/yr after tax"],
    ["Social Security", <span key="ss">{M.who.married ? (M.S.ss.claim2 === M.S.ss.claim ? "both at " + M.S.ss.claim : "at " + M.S.ss.claim + " and " + M.S.ss.claim2) + ", " : "at " + M.S.ss.claim + ", "}<Est on={!M.a.ssOwn}>{money(M.S.ss.total / 12)}</Est>/mo</span>],
    ...(M.S.pension ? [["Pension", money(M.S.pension / 12) + "/mo"] as [string, string]] : []),
    ["Withdrawals", M.S.tactics ? opTacticsLine(M.S.T, M.S.C) : "Brokerage, then traditional, then Roth"],
    ["Withdrawal approach", M.strategy],
    ["Stocks in retirement", M.S.mix + "%"],
    ["Income tax, typical year", "About " + money(M.S.taxYr)],
    ["Plan runs to", M.who.married ? M.who.pair(M.end) : String(M.end)],
  ];
  return (
    <Sheet M={M} p={p}>
      <Lead h={ahead ? <>You&apos;re on track: {timesWord ? timesWord + " what your plan needs" : "ahead of what your plan needs"}, and it lasted in {lasted(M)}.</>
        : <>You&apos;re {rounded(M.need - M.S.fv)} short of what your plan needs, and it lasted in {pctStr(M.S.success, 0)} of historical retirements.</>}>
        This report shows the plan the Guide built from your answers: what you&apos;ll have, how it holds up against history, where each year&apos;s money comes from, and what to do next. Every figure is in today&apos;s dollars, so {money(M.S.spend)} means what {money(M.S.spend)} buys now.
      </Lead>
      <div className="rp-g2 top">
        <div><Sec>Your number</Sec><NeedBars M={M} />
          <p className="rp-small">&ldquo;Needs&rdquo; is the smallest amount at {M.retire} that lasted in {pctStr(M.goal, 0)} of historical retirements with your spending, Social Security and taxes.</p></div>
        <div><Sec>{ahead ? "What the margin buys" : "What closes the gap"}</Sec>
          <p className="rp-body">{ahead ? "Any one of these still lasts in " + pctStr(M.goal, 0) + " of historical retirements:" : "Any one of these gets it to " + pctStr(M.goal, 0) + " of historical retirements:"}</p>
          <div className="rp-g3 tight">{M.levers3.map((l, i) => <Side key={i}><div className={"rp-fig" + (l.fig.length > 5 ? " sm" : "")}>{l.fig}</div>{l.label}</Side>)}</div>
          <p className="rp-body gap">{ahead ? "Or keep the margin. That's a fine choice too." : "A mix of smaller changes works too. Page " + pageOf(M, "moves") + " has the next moves."}</p></div>
      </div>
      <div className="rp-g2">
        <div><Sec>In this report</Sec>
          <ol className={"rp-toc" + (toc.length > 11 ? " long" : "")}>{toc.map((x) => <li key={x.n} className={x.because ? "cond" : ""}><b>{x.title}</b><span className="d" /><span className="pn">{x.n}</span></li>)}</ol></div>
        <div><Sec>The plan in one table</Sec>
          <dl className="rp-facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></div>
      </div>
      <Sec>How to use this report</Sec>
      <div className="rp-g3">
        <Side><h5>Read pages 2 to {story} together</h5>The plan, how it holds up and what to do, in plain words.</Side>
        <Side><h5>Hand pages {appx} to {last} to an advisor</h5>Every answer, estimate and default, the method, and each year of the plan.</Side>
        <Side><h5>Print a new one when life changes</h5>A raise, a move, a new child. Update the Guide and the whole report follows.</Side>
      </div>
    </Sheet>
  );
}

/* ---------- 3. the road from here ---------- */
function Road({ M, p }: { M: ReportModel; p: PageInfo }) {
  const saveYears = M.retire - M.accum[0].age, gap = M.firstClaim - M.retire, r0 = M.rows[0];
  const ssRow = M.rows.find((r) => r.age >= Math.max(M.firstClaim, M.claim2 ?? 0)), cover = ssRow ? ssRow.ss / Math.max(1, ssRow.spend) : 0;
  const fromSavings = r0.trad + r0.roth + r0.brok, surplus = M.rows.some((r) => r.surplus > 1);
  return (
    <Sheet M={M} p={p}>
      <Lead h={<>{cap(num(saveYears))} more {saveYears === 1 ? "year" : "years"} of saving, then {num(M.rows.length)} of retirement.</>}>
        {gap > 0 ? <>The steep part of the trail is the {num(gap)} {gap === 1 ? "year" : "years"} from retiring to Social Security. Savings carry everything then: the spending, the tax{M.retire < 65 ? " and health insurance until Medicare" : ""}. </>
          : <>Social Security starts as you retire, so savings fill the gap from the first year. </>}
        {cover > 0 ? <>From {Math.max(M.firstClaim, M.claim2 ?? 0)}, Social Security covers {cover >= 0.95 ? "nearly all" : cover >= 0.6 ? "most" : pctStr(cover, 0)} of what you spend.</> : null}
      </Lead>
      <Sec>The trail, by {M.who.axisIn}</Sec>
      <div className="rp-landbox"><Trail M={M} />
        <div className="rp-key">{M.phases.filter((x, i, all) => all.findIndex((y) => y.id === x.id) === i).map((x) => <span key={x.id}><i style={{ "--sw": PHASE_COLOR[x.id] } as React.CSSProperties} />{x.name}</span>)}</div></div>
      <div className="rp-wide">
        <div><Sec>Each year of retirement, by where the money comes from</Sec><IncomeBars M={M} h={280} /><IncomeKey M={M} /></div>
        <div><Sec>Year one</Sec>
          <Side><div className="rp-fig">{money(fromSavings)}</div>comes out of your savings: {money(r0.spend - r0.ss - r0.pension > 0 ? r0.spend - r0.ss - r0.pension : 0)} toward spending, {money(r0.tax + r0.irmaa)} in tax{r0.health > 0 ? " and " + money(r0.health) + " for health insurance" : ""}.
            {surplus ? <><h5 className="gap">From {M.rmdAge}</h5>Required withdrawals take out more than you spend. What&apos;s left after tax is reinvested in a brokerage account.</> : null}</Side></div>
      </div>
      <Sec>Points along the way</Sec>
      <Stops M={M} years cols />
    </Sheet>
  );
}

/* ---------- 4. saving as the family grows (Changes ahead) ---------- */
function Family({ M, p }: { M: ReportModel; p: PageInfo }) {
  const Ch = M.changes!, flat = Ch.flat!, cost = flat.fv - M.S.fv, paused = Ch.sched.filter((s) => s.monthly === 0);
  const pausedYears = paused.reduce((t, s) => t + s.to - s.from, 0), most = Math.max(...Ch.sched.map((s) => s.monthly));
  // Paused stages side by side read as one stretch: "from 41 to 51".
  const spans = paused.reduce<{ from: number; to: number }[]>((o, s) => { const l = o[o.length - 1]; if (l && l.to === s.from) l.to = s.to; else o.push({ from: s.from, to: s.to }); return o; }, []);
  const who = Ch.kids.length ? (Ch.planned > 1 ? "the new children cost" : Ch.planned ? "the new child costs" : "the children cost") : "these changes cost";
  return (
    <Sheet M={M} p={p}>
      <Lead h={pausedYears ? <>{Ch.planned ? (Ch.planned > 1 ? "New children put" : "A new child puts") : "Your changes put"} retirement saving on hold for {num(pausedYears)} years{most > Ch.monthly ? ", then it comes back stronger" : ""}.</>
        : <>Your saving moves between {money(Math.min(...Ch.sched.map((s) => s.monthly)))} and {money(most)} per month as things change.</>}>
        The Guide takes what {who} out of the {money(Ch.monthly)} per month you save now{pausedYears ? <>. From {and(spans.map((s) => s.from + " to " + s.to))}, that&apos;s more than you save, so saving pauses</> : null}.
        {most > Ch.monthly ? <> It rises to {money(most)} {Ch.kids.length ? "once the children are grown" : "later on"}.</> : null}
      </Lead>
      <Sec>Retirement saving each month, by {M.who.axisIn}</Sec>
      <Stairs M={M} />{Ch.house.some((h) => h.n !== Ch.house[0].n) ? <HomeStrip M={M} /> : null}
      <div className="rp-wide">
        <div><Sec>Savings at {M.retire}, with and without the changes</Sec><TwoPaths M={M} />
          <div className="rp-key"><span><i className="line" style={{ "--sw": C.trail } as React.CSSProperties} />Your plan</span><span><i className="dash" style={{ "--sw": C.gray } as React.CSSProperties} />Saving {money(Ch.monthly)} the whole way</span></div></div>
        <div><Sec>What the changes cost your retirement</Sec>
          <Side><div className="rp-fig">{money(Math.abs(cost))}</div>{cost >= 0 ? "less" : "more"} at {M.retire}. You&apos;re on course for {money(M.S.fv)} against the {money(M.need)} your plan needs, and it lasted in {lasted(M)}.
            {Ch.short.list.length ? <><h5 className="gap">The years your saving can&apos;t cover</h5>{cap(who)} up to <b>{money(Ch.short.most)} per month</b> more than you save, about <b>{rounded(Ch.short.total)}</b> in all. Saving can&apos;t go below $0, so that comes from your budget: trim spending then, or build savings outside retirement before it starts.</> : null}</Side></div>
      </div>
      {Ch.kids.length ? <>
        <Sec>What each child costs per month</Sec>
        {(() => {
          const a = M.a, care = a.childcare !== false, area = careAreaOf(a.careArea), L = Ch.cost.later;
          const pos = (v: unknown): v is number => typeof v === "number" && isFinite(v) && v > 0;
          const early = pos(a.childEarly) ? a.childEarly : earlyCost(care, area);
          const school = pos(a.childSchool) ? a.childSchool : Ch.cost.school, teen = pos(a.childTeen) ? a.childTeen : Ch.cost.teen;
          return (
            <table className="rp-t"><thead><tr><th>Age of the child</th><th>First child</th><th>Each one after</th><th className="l">Notes</th></tr></thead><tbody>
              <tr><td>Birth to 5</td><td>{money(early)}</td><td>{money(early * L)}</td><td className="l">{care ? "With childcare (" + CARE_AREAS.find((x) => x.id === area)!.name.toLowerCase() + "); " + money(Ch.cost.noCare) + " without" : "No paid childcare"}</td></tr>
              <tr><td>6 to 12</td><td>{money(school)}</td><td>{money(school * L)}</td><td className="l">Children you have now are already in today&apos;s spending</td></tr>
              <tr><td>13 to 18</td><td>{money(teen)}</td><td>{money(teen * L)}</td><td className="l">Teens cost a little more: food and getting around</td></tr>
              <tr><td>19 and up</td><td colSpan={2} className="c">{M.college ? "College, page " + pageOf(M, "college") : "Nothing in this schedule"}</td><td className="l">College is its own line</td></tr>
            </tbody></table>
          );
        })()}
        <p className="rp-small">Typical costs from {Ch.source}, unless you entered your own. A later child costs 20% less: they share a room, clothes and gear.</p></> : null}
    </Sheet>
  );
}

/* ---------- 5. college ---------- */
function College({ M, p }: { M: ReportModel; p: PageInfo }) {
  const K = M.college!, ov = M.list.find((m) => m.id === "college-overlap"), late = K.kids.filter((k) => k.to > M.retire && k.from < M.retire);
  const nth = ["first", "second", "third", "fourth"];
  return (
    <Sheet M={M} p={p} foot="College in today's dollars here; College Savings shows the year's dollars.">
      <Lead h={<>About {rounded(K.totalToday)} of college in today&apos;s dollars{late.length ? <>, and the {nth[K.kids.indexOf(late[0])] ?? "last"} child&apos;s runs past retirement</> : null}.</>}>
        From the College Savings tool: {money(K.costNow)} per year for each child at today&apos;s prices, college costs rising {pctStr(K.tuitionInfl, 0)} per year and savings earning {pctStr(K.investRet, 0)}.
        {" "}Setting aside a fixed {money(K.monthly)} per month until {K.saveUntil} pays for {K.kids.length > 1 ? (K.kids.length === 2 ? "both" : "all of them") : "it"}.
      </Lead>
      <Sec>The college years beside your own</Sec>
      <CollegeTimeline M={M} />
      <div className="rp-key"><span><i style={{ "--sw": C.water } as React.CSSProperties} />Saving for college</span>{K.kids.map((_, i) => <span key={i}><i style={{ "--sw": collegeColor(i) } as React.CSSProperties} />{K.kids.length > 1 ? cap(nth[i] ?? "another") + " child" : "Your child"}</span>)}
        {late.length ? <span><i className="hatch" />College after you retire</span> : null}</div>
      <div className="rp-wide">
        <div><Sec>Each year&apos;s college bill, in today&apos;s dollars</Sec><CollegeBars M={M} />
          <p className="rp-small">College costs rise faster than prices, so a year of college costs more than {money(K.costNow)} even in today&apos;s dollars.{late.length ? " Outlined bars fall after you retire." : ""}</p></div>
        <div><Sec>{ov || late.length ? "The overlap" : "Where the money comes from"}</Sec>
          <Side>{ov ? <><h5>{ov.t}</h5><Html as="span" html={ov.d} /><h5 className="gap">Where the money comes from</h5></>
            : late.length ? <><h5>College after you retire</h5>{cap(and(late.map((k) => "college from " + k.from + " to " + k.to)))} runs past the day you stop work at {M.retire}. Make sure that money is set aside before then, or plan for it from savings.<h5 className="gap">Where the money comes from</h5></> : null}
            This plan treats the {money(K.monthly)} per month as part of your budget, not your retirement saving. If it will come out of retirement contributions instead, add it in the Guide&apos;s Changes ahead.</Side></div>
      </div>
      <Sec>Each child</Sec>
      <table className="rp-t"><thead><tr><th>Child</th><th>College at {M.who.axisIn}</th><th>Years from now</th><th>In today&apos;s dollars</th><th>In the year&apos;s dollars</th></tr></thead><tbody>
        {K.kids.map((k, i) => <tr key={i}><td>{K.kids.length > 1 ? cap(nth[i] ?? "another") : "Your child"}</td><td>{k.from} to {k.to}</td><td>{fmtNum(k.yearsUntil)}</td><td>{money(k.totalToday)}</td><td>{money(k.total)}</td></tr>)}
        {K.kids.length > 1 ? <tr className="tot"><td>{K.kids.length === 2 ? "Both" : "All"}</td><td /><td /><td>{money(K.totalToday)}</td><td>{money(K.kids.reduce((t, k) => t + k.total, 0))}</td></tr> : null}
      </tbody></table>
    </Sheet>
  );
}

/* ---------- will it last? ---------- */
function Last({ M, p }: { M: ReportModel; p: PageInfo }) {
  const H = M.S.H, fails = M.runs.filter((r) => !r.ok), okRuns = M.runs.filter((r) => r.ok);
  const lows = (fails.length ? fails.slice().sort((x, y) => (x.outAge ?? 99) - (y.outAge ?? 99)) : okRuns.slice().sort((x, y) => x.low - y.low)).slice(0, 5);
  const lowest = okRuns.length ? okRuns.reduce((m, r) => (r.low < m.low ? r : m)) : null;
  return (
    <Sheet M={M} p={p} foot="Past returns don't predict future ones.">
      <Lead h={<>We ran your retirement through every starting year from {H.first} to {M.runs[M.runs.length - 1].y}. {fails.length ? <>It lasted in {H.survived} of {H.total}.</> : <>It lasted in all {H.total}.</>}</>}>
        Each run uses what really happened to stocks, bonds and inflation from that year on, with {M.S.mix}% in stocks, your spending rising with inflation, and each year&apos;s tax and health insurance paid on top. {(() => { const hard = [1929, 1937, 1966, 1973, 2000].filter((y) => M.runs.some((r) => r.y === y)); return hard.length > 1 ? <>Starts like {and(hard.map(String))} are the bad luck a plan has to survive.</> : null; })()}
      </Lead>
      <Sec>What was left at {M.end}, by the year retirement started</Sec>
      <HistoryBars M={M} />
      <div className="rp-key"><span><i style={{ "--sw": C.forest } as React.CSSProperties} />Left at the end</span>{okRuns.length ? <span><i style={{ "--sw": C.trail } as React.CSSProperties} />The least left, {M.worst.y}</span> : null}
        <span><i className="tick" />The lowest point along the way</span>{fails.length ? <span><i className="cross" />Ran out</span> : null}</div>
      <div className="rp-g3 gap">
        <Side><div className="rp-fig">{H.survived} of {H.total}</div>retirements lasted to {M.end}</Side>
        <Side><div className="rp-fig">{rounded(H.medianEnd)}</div>left in the middle of history</Side>
        <Side>{fails.length ? <><div className="rp-fig">{lows[0].outAge}</div>the earliest age the money ran out, starting {lows[0].y}</> : <><div className="rp-fig">{rounded(H.worstEnd)}</div>left in the worst, starting {M.worst.y}</>}</Side>
      </div>
      <div className="rp-g2">
        <div><Sec>{fails.length ? "The starts that ran out first" : "The five lowest points"}</Sec>
          <table className="rp-t"><thead><tr><th>Started</th>{fails.length ? <><th>Ran out at</th><th>Years it lasted</th></> : <><th>Lowest point</th><th>At age</th><th>Left at {M.end}</th></>}</tr></thead><tbody>
            {lows.map((r) => <tr key={r.y}><td>{r.y}</td>{fails.length ? <><td>{r.outAge}</td><td>{(r.outAge ?? M.retire) - M.retire}</td></> : <><td>{money(r.low)}</td><td>{r.lowAge}</td><td>{money(r.end)}</td></>}</tr>)}</tbody></table></div>
        <div><Sec>How to read this</Sec>
          <p className="rp-body">The lowest point is the one to watch: the balance in the worst year of that retirement, usually a few years after a crash.
            {lowest ? <> The lowest any lasting retirement fell was {money(lowest.low)}, starting in {lowest.y}, at {lowest.lowAge}: about {num(Math.floor(lowest.low / Math.max(1, M.S.spend)))} {Math.floor(lowest.low / Math.max(1, M.S.spend)) === 1 ? "year" : "years"} of spending.</> : null}</p>
          <p className="rp-body gap">History is not a forecast. It&apos;s the widest test there is of how a plan holds up when markets don&apos;t cooperate.</p></div>
      </div>
    </Sheet>
  );
}

/* ---------- where the money comes from ---------- */
function Money({ M, p }: { M: ReportModel; p: PageInfo }) {
  const tin = M.money.in.reduce((t, x) => t + x[1], 0), ss = M.money.in[0][1], surplus = M.money.out.find((x) => x[2] === "surplus")![1];
  const afterRmd = M.money.tax > 0 ? M.money.taxAfterRmd / M.money.tax : 0;
  return (
    <Sheet M={M} p={p}>
      <Lead h={<>Over {num(M.rows.length)} years, {rounded(tin)} comes in. Social Security is {pctStr(ss / Math.max(1, tin), 0)} of it.</>}>
        Withdrawals from traditional accounts are taxed as income; Roth withdrawals aren&apos;t; brokerage withdrawals are taxed only on their gains.
        {surplus > 1 ? <> Required withdrawals from {M.rmdAge} pull out more than you spend; after tax the rest is reinvested, which is why the balance can keep growing late in life.</> : null}
      </Lead>
      <Sec>Every dollar of retirement, in and out</Sec>
      <LifetimeBars M={M} />
      <div className="rp-key"><b>In</b>{M.money.in.filter((x) => x[1] >= 500).map(([t, v, k]) => <span key={k}><i style={{ "--sw": SOURCE_COLOR[k] } as React.CSSProperties} />{t} {rounded(v)}</span>)}</div>
      <div className="rp-key"><b>Out</b>{M.money.out.filter((x) => x[1] >= 500).map(([t, v, k]) => <span key={k}><i style={{ "--sw": OUT_COLOR[k] } as React.CSSProperties} />{t} {rounded(v)}</span>)}</div>
      <div className="rp-wide">
        <div><Sec>Income tax each year</Sec><YearBars M={M} f={(r) => r.tax + r.irmaa} color={C.trail} />
          <p className="rp-small">The Medicare surcharge, when there is one, is counted with the tax.</p></div>
        <div><Sec>Tax over the whole retirement</Sec>
          <Side><div className="rp-fig">{money(M.S.lifeTax)}</div>in the middle of history, about {money(M.S.taxYr)} in a typical year.
            {afterRmd > 0.3 ? <><h5 className="gap">Where to look</h5>On the average path, {pctStr(afterRmd, 0)} of the tax comes after {M.rmdAge}, from required withdrawals. Roth conversions in lower-tax years before then can move some of it earlier at a lower rate.</> : null}
            {!M.S.tactics ? <> The Plan Optimizer tests that, along with claiming ages and the order to draw accounts.</> : null}</Side></div>
      </div>
      <Sec>Each year of retirement, by source</Sec>
      <IncomeBars M={M} w={732} h={210} /><IncomeKey M={M} />
    </Sheet>
  );
}

/* ---------- health insurance before Medicare ---------- */
function Health({ M, p }: { M: ReportModel; p: PageInfo }) {
  const Hh = M.health!, r0 = M.rows[0], both = Math.max(Hh.med1, Hh.med2 ?? 0), house = householdAtRetire(M.a, M.retire), adults = M.who.married ? 2 : 1;
  const pre = Hh.rows.filter((r) => r.age < both), worst = pre.reduce((m, r) => (r.health > m.health ? r : m), pre[0] ?? r0), after = Hh.rows.find((r) => r.age >= both);
  return (
    <Sheet M={M} p={p}>
      <Lead h={<>{cap(num(both - M.retire))} {both - M.retire === 1 ? "year" : "years"} before {M.who.married ? "both of you reach" : "you reach"} Medicare: {money(Hh.before)} for marketplace coverage.</>}>
        Retiring at {M.retire} leaves {M.who.married ? <>{M.who.first} {num(65 - M.retire)} {65 - M.retire === 1 ? "year" : "years"} and {M.who.second} {num(both - M.retire)}</> : num(65 - M.retire) + " years"} before Medicare. The marketplace subsidy depends on income, and your income in those years is what you take out of your accounts, so the withdrawal plan and the health insurance bill move together.
        {house > adults ? <> Your household is {num(house)} at retirement, with a child still at home or in college, and the plan prices coverage for that.</> : null}
      </Lead>
      <div className="rp-wide">
        <div><Sec>Health insurance each year, by {M.who.axisIn}</Sec>
          <YearBars M={M} ages={(g) => g < both + 6} h={300} f={(r) => r.health} color={C.clay} stack={{ f: (r) => r.med, color: C.water }} />
          <div className="rp-key"><span><i style={{ "--sw": C.clay } as React.CSSProperties} />Marketplace, after the subsidy</span><span><i style={{ "--sw": C.water } as React.CSSProperties} />Medicare premiums</span></div></div>
        <div><Sec>The costly stretch</Sec>
          <Side><div className="rp-fig">{money(worst.health)}</div>a year at {worst.age}, the most of any year{M.who.married && worst.age >= 65 ? <>: {M.who.first} pays Medicare and {M.who.second}, alone on the marketplace, gets a smaller subsidy</> : null}.
            {after ? <><h5 className="gap">From {both}</h5>{M.who.married ? "Both on Medicare" : "On Medicare"}: {money(after.health)} per year in premiums.</> : null}</Side></div>
      </div>
      <div className="rp-g3 gap">
        <Side><div className="rp-fig">{money(r0.health)}</div>in the first year of retirement</Side>
        {r0.fplPct != null ? <Side><div className="rp-fig">{pctStr(r0.fplPct, 0)}</div>of the poverty line: your income for the subsidy in year one</Side> : null}
        <Side><div className="rp-fig">{money(Hh.avg)}</div>a year on average before Medicare</Side>
      </div>
      <Sec>What you can do</Sec>
      <ol className="rp-poi plain">
        <li><span><b>Get real quotes a year before you retire.</b> The figures here are estimates after the subsidy; real prices depend on your county and the plan you pick.</span></li>
        <li><span><b>Watch your income in these years.</b> Taking more out of traditional accounts, or converting to Roth, raises income and shrinks the subsidy. The Healthcare Cost Planner shows the trade.</span></li>
        {M.who.married && Hh.med2 !== Hh.med1 ? <li><span><b>Plan for the years one of you is on Medicare and the other isn&apos;t.</b> The household subsidy changes when the first of you moves to Medicare.</span></li> : null}
      </ol>
    </Sheet>
  );
}

/* ---------- your score ---------- */
function Score({ M, p }: { M: ReportModel; p: PageInfo }) {
  const weak = shortOf(M), byArea = (id: string) => M.list.find((m) => m.area === id);
  const fixes = weak.map((f) => byArea(f.id)).filter(Boolean);
  return (
    <Sheet M={M} p={p}>
      <Lead h={<>{M.R.score} out of 100: {M.rating.label.toLowerCase()}{weak.length ? <>, with {num(weak.length)} {weak.length === 1 ? "area" : "areas"} still to finish</> : null}.</>}>
        The readiness score adds up five areas, weighted by how much each matters to a retirement. The outlook, whether the plan lasts, counts for the most. Emergency savings and debt are smaller, but they&apos;re the ones that can derail a plan before it reaches retirement.
      </Lead>
      <Sec>Your {M.R.score} points, area by area</Sec>
      <ScoreBar M={M} />
      <div className="rp-scoregrid">
        <div>{M.factors.map((f) => {
          const P = M.R.P[f.id];
          if (!P) return null;
          const pts = Math.round(P.p * f.w), m = byArea(f.id);
          return <div key={f.id} className="rp-area"><div><h5>{f.name}</h5><div className="w">worth {f.w} points</div></div>
            <div className="txt">{cap(P.txt)}. {P.p >= 0.999 ? "Full marks." : m ? "Next: " + m.t.charAt(0).toLowerCase() + m.t.slice(1) + "." : ""}</div>
            <div className="pts">{pts}<small> / {f.w}</small></div></div>;
        })}</div>
        <div>{M.R.score < 100 && fixes.length ? <Side><h5>The next {100 - M.R.score} points</h5>{cap(and(fixes.map((m) => m!.t.charAt(0).toLowerCase() + m!.t.slice(1))))}. {fixes.length > 1 ? "They're" : "It's"} on page {pageOf(M, "moves")}.</Side>
          : <Side><h5>Full marks</h5>Every area is where it should be. Keep it there as life changes.</Side>}</div>
      </div>
      <Sec>What the score means</Sec>
      <table className="rp-t"><thead><tr><th>Score</th><th className="l">Rating</th><th className="l">What it says</th></tr></thead><tbody>
        {RATINGS.map(([lo, hi, n, d]) => { const on = M.R.score >= lo && M.R.score <= hi;
          return <tr key={n} className={on ? "hl" : undefined}><td>{hi >= 100 ? lo + " and up" : lo + " to " + hi}</td><td className="l"><b>{n}</b>{on ? <> &middot; your plan, {M.R.score}</> : null}</td><td className="l">{d}</td></tr>; })}
      </tbody></table>
      <p className="rp-small">The score never rewards taking more risk: it moves only with what you save, spend, owe and keep in reserve.</p>
    </Sheet>
  );
}

const RATINGS: [number, number, string, string][] = [
  [85, 100, "On track", "The plan lasts in at least 90% of history and the basics are in place."],
  [70, 84, "Nearly there", "A strong plan with one or two areas to finish."],
  [50, 69, "Getting there", "The foundations are there; the plan needs more saving or a later date."],
  [30, 49, "Needs work", "Several areas need attention before the plan holds up."],
  [0, 29, "Needs attention", "Start with the first move on the list: it does the most."],
];

/* ---------- next moves ---------- */
const WHEN: [string, string][] = [["This month", "Quick ones"], ["This year", "The ones that move the score"], ["When you're ready", "Before you retire"]];
function Moves({ M, p }: { M: ReportModel; p: PageInfo }) {
  const order = WHEN.flatMap(([w]) => M.list.filter((m) => m.when === w)), nOf = (id: string) => order.findIndex((m) => m.id === id) + 1;
  const tool = (b?: string) => (b && b.startsWith("Open ") ? b.slice(5).replace(/^the /, "") : b ? "In the Guide" : "");
  return (
    <Sheet M={M} p={p}>
      <Lead h={<>{cap(num(M.list.length))} {M.list.length === 1 ? "move" : "moves"}, in the order the Guide would take them.</>}>
        The ones that fix an area of the score come first. The rest are decisions for the years before you retire, each with the RetCalc tool that works it out.
      </Lead>
      <div className="gap">{WHEN.map(([w, lbl]) => {
        const ms = M.list.filter((m) => m.when === w);
        if (!ms.length) return null;
        return <div key={w} className="rp-when"><div><h5>{w}</h5><div className="lbl">{lbl}</div></div>
          <div>{ms.map((m) => { return <div key={m.id} className="rp-mv"><span className="rp-num">{nOf(m.id)}</span><div><h6>{m.t}</h6><p><Html as="span" html={m.d} /></p>{tool(m.btn) ? <span className="rp-tool">{tool(m.btn)}</span> : null}</div></div>; })}</div></div>;
      })}</div>
      {M.kit.length ? <><Sec>Your toolkit</Sec>
        <div className="rp-kit">{M.kit.map((t) => <div key={t.id}><h6>{t.name}</h6><div className="y">{t.why}</div><div>{t.q}{/[?.]$/.test(t.q) ? "" : "."}</div></div>)}</div></> : null}
    </Sheet>
  );
}

/* ---------- assumptions and sources ---------- */
function Sources({ M, p }: { M: ReportModel; p: PageInfo }) {
  const a = M.a0, st = STATE_OPTIONS.find((s) => s.code === a.state)?.name;
  const rows: [string, React.ReactNode][] = [];
  const put = (k: string, v: React.ReactNode, on = true) => { if (on && v != null && v !== "") rows.push([k, v]); };
  put("Household", M.who.married ? "Married, " + M.who.first + " " + a.age + " and " + M.who.second + " " + a.spouseAge : "Single, " + a.age);
  put("State", st);
  put("Income", a.income2 ? money(a.income ?? 0) + " and " + money(a.income2) : money(a.income ?? 0), a.income != null);
  put("Take-home pay", money(a.takehome ?? 0) + "/mo", a.takehome != null);
  put("Spending today", money(a.spend ?? 0) + "/mo", a.spend != null);
  put("Emergency fund", money(a.cash ?? 0), a.cash != null);
  put("Debt, excluding mortgage", a.debtHas === "yes" ? money(a.debtTotal ?? 0) + (a.debtHi ? ", " + money(a.debtHi) + " at 8%+" : "") : "None", a.debtHas != null);
  put("Home", a.home === "mortgage" ? "Mortgage" + (a.housePay ? ", " + money(a.housePay) + "/mo" : "") : a.home === "rent" ? "Renting" + (a.housePay ? ", " + money(a.housePay) + "/mo" : "") : a.home === "own" ? "Owned outright" : null);
  if (M.changes?.kids.length) put("Children", cap([...(a.kidsNow?.length ? [(a.kidsNow.length === 1 ? "one, " : num(a.kidsNow.length) + ", ") + and(a.kidsNow.map(String))] : []),
    ...(M.changes.planned ? [num(M.changes.planned) + " planned"] : [])].join("; ")));
  put("College", M.college ? (M.college.kids.length > 1 ? M.college.kids.length + " children, " : "") + money(M.college.monthly) + "/mo" : null);
  put("Retirement savings", money(a.saved ?? 0) + (a.rothNow ? ", " + money(a.rothNow) + " Roth" : "") + (a.brokNow ? ", " + money(a.brokNow) + " brokerage" : ""), a.saved != null);
  put("Saving", money(a.contrib ?? 0) + "/mo" + (a.employer ? " + " + money(a.employer) + " match" : ""), a.contrib != null);
  put("Retire at", String(a.retire));
  put("Spending in retirement", money(M.S.spend) + "/yr");
  put("Social Security", a.ssOwn ? money(a.ssOwn) + (a.ssOwn2 ? " and " + money(a.ssOwn2) : "") + "/mo" : <Est on>{money(M.S.ss.total / 12)}/mo together</Est>);
  put("Pension", a.pension ? money(a.pension) + "/mo" + (a.pensionAge ? " from " + a.pensionAge : "") : null);
  return (
    <Sheet M={M} p={p} foot="Calculated in your browser. retcalc.app">
      <Lead h="What this plan is built on.">Everything you entered in the Guide, and where the Guide filled a gap with an estimate or a default. Replace an estimate with the real figure and the plan updates. For an advisor: the method is on the right, and every year of the plan follows.</Lead>
      <div className="rp-g2 top">
        <div><Sec>Your answers</Sec><dl className="rp-facts">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          {M.why.estimated.length || M.why.defaults.length ? <dl className="rp-facts gap">
            {M.why.estimated.length ? <div><dt><span className="rp-tag e">estimated</span></dt><dd className="l">{cap(and(M.why.estimated))}</dd></div> : null}
            {M.why.defaults.length ? <div><dt><span className="rp-tag d">default</span></dt><dd className="l">{cap(and(M.why.defaults))}</dd></div> : null}</dl> : null}</div>
        <div><Sec>Method</Sec>
          <p className="rp-body sm"><b>Saving.</b> Savings grow {pctStr(M.S.real, 2)} per year after inflation, the historical return of your mix, with contributions rising with inflation until {M.retire}.</p>
          <p className="rp-body sm"><b>Retirement.</b> Tested against every starting year since {M.S.H.first} with enough history to run the full {M.rows.length} years: {M.S.H.total} retirements, {M.S.mix}% in stocks. Spending is a fixed amount that rises with inflation.</p>
          <p className="rp-body sm"><b>Tax and health.</b> Each year&apos;s federal{st ? " and " + st : ""} income tax, the Medicare surcharge and marketplace premiums before 65 are worked out from where that year&apos;s money comes from, and paid on top of spending.</p>
          <p className="rp-body sm"><b>Needs.</b> The smallest balance at {M.retire} that lasted in {pctStr(M.goal, 0)} of historical retirements.</p>
          <Sec>Fine print</Sec>
          <p className="rp-small">RetCalc is an educational tool, not financial, tax or legal advice. Past returns don&apos;t predict future ones. Tax rules are those of {M.year0}, held in today&apos;s dollars. Everything was calculated in your browser; nothing you entered was sent anywhere to make this report.</p></div>
      </div>
      <Sec>Words used in this report</Sec>
      <dl className="rp-gloss">
        <div><dt>Today&apos;s dollars</dt><dd>Every future amount shrunk by inflation, so it means what it would buy now.</dd></div>
        <div><dt>Lasted</dt><dd>Money left at the end of the plan in a given historical retirement.</dd></div>
        <div><dt>Required withdrawals</dt><dd>The minimum the IRS makes you take from traditional accounts each year from {M.rmdAge} (RMDs).</dd></div>
        <div><dt>Marketplace subsidy</dt><dd>The tax credit that lowers health insurance bought on healthcare.gov before Medicare; it shrinks as income rises.</dd></div>
        <div><dt>Roth conversion</dt><dd>Moving money from a traditional account to a Roth and paying the tax now, to pay less later.</dd></div>
      </dl>
    </Sheet>
  );
}

/* ---------- year by year ---------- */
function Years({ M, p, part }: { M: ReportModel; p: PageInfo; part: number }) {
  const rows = M.rows.slice(part * M.perPage, (part + 1) * M.perPage), lastPart = (part + 1) * M.perPage >= M.rows.length;
  const hl = new Set([M.retire, 65, M.firstClaim, M.claim2 ?? -1, M.rmdAge]), sum = (f: (r: ReportModel["rows"][number]) => number) => M.rows.reduce((t, r) => t + f(r), 0);
  const d = (v: number) => (v >= 1 ? money(v) : "–");
  // A total of a few dollars is rounding left over, not money: shown as none.
  const tot = (f: (r: ReportModel["rows"][number]) => number) => { const v = sum(f); return v >= 100 ? rounded(v) : "–"; };
  return (
    <Sheet M={M} p={p} foot="Shaded rows: retiring, Medicare, each Social Security claim, required withdrawals.">
      {part === 0 ? <p className="rp-body sm">Every year of retirement at a steady {pctStr(M.S.real, 2)} after inflation, the historical average for your mix. Real years swing around it; page {pageOf(M, "last")} shows how far. Withdrawals cover spending, tax and health insurance.</p> : null}
      <table className="rp-t yy"><thead><tr><th>Year</th><th>{M.who.married ? M.who.first === "you" ? "You" : M.who.first : "Age"}</th>{M.who.married ? <th>{M.who.second === "your spouse" ? "Spouse" : M.who.second}</th> : null}
        <th>Social Security</th>{M.S.pension ? <th>Pension</th> : null}<th>Traditional</th><th>Roth / brokerage</th><th>Income tax</th><th>Health</th><th>Reinvested</th><th>Balance at year end</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.age} className={hl.has(r.age) ? "hl" : undefined}><td>{M.year0 + (r.age - M.accum[0].age)}</td><td>{r.age}</td>{M.who.married ? <td>{Math.round(r.age - (M.a.age! - M.a.spouseAge!))}</td> : null}
          <td>{d(r.ss)}</td>{M.S.pension ? <td>{d(r.pension)}</td> : null}<td>{d(r.trad)}</td><td>{d(r.roth + r.brok)}</td><td>{d(r.tax + r.irmaa)}</td><td>{d(r.health)}</td><td>{d(r.surplus)}</td><td>{money(r.end)}</td></tr>)}
          {lastPart ? <tr className="tot"><td>Total</td><td />{M.who.married ? <td /> : null}<td>{tot((r) => r.ss)}</td>{M.S.pension ? <td>{tot((r) => r.pension)}</td> : null}<td>{tot((r) => r.trad)}</td>
            <td>{tot((r) => r.roth + r.brok)}</td><td>{tot((r) => r.tax + r.irmaa)}</td><td>{tot((r) => r.health)}</td><td>{tot((r) => r.surplus)}</td><td /></tr> : null}</tbody></table>
    </Sheet>
  );
}

/* ---------- getting to 59½ (retiring before it) ---------- */
function Bridge({ M, p }: { M: ReportModel; p: PageInfo }) {
  const B = M.bridge!, out = B.out.trad + B.out.roth + B.out.brok;
  const order = M.S.tactics ? lowerFirst(opTacticsLine(M.S.T, M.S.C)) : "brokerage first, then traditional, then Roth";
  return (
    <Sheet M={M} p={p}>
      <Lead h={<>{cap(num(B.years))} {B.years === 1 ? "year" : "years"} to bridge before 59½, about {rounded(out)} from your savings.</>}>
        Money taken out of a 401(k) or IRA before 59½ usually costs a 10% penalty on top of income tax.
        {B.rule55 ? <> Retiring at {M.retire}, the rule of 55 lets you take money from the 401(k) at the job you leave without it.</> : null}
        {" "}On the average path the plan draws {order}, {B.pen > 1 ? <>paying about <b>{money(B.pen)}</b> in penalties on the way.</> : <>with no penalty on the way.</>}
      </Lead>
      <Sec>Your accounts at {M.retire}</Sec>
      <div className="rp-g3">
        <Side><h5>Traditional 401(k)s and IRAs</h5><div className="rp-fig">{rounded(B.at.trad)}</div>Penalty before 59½ unless the rule of 55 or 72(t) payments apply. Taxed as income.</Side>
        <Side><h5>Roth</h5><div className="rp-fig">{rounded(B.at.roth)}</div>{B.at.rothBasis > 0 ? <>About {rounded(B.at.rothBasis)} of it is what you put in, which comes out any time. Growth waits for 59½.</> : "What you put in comes out any time; growth waits for 59½."}</Side>
        <Side><h5>Brokerage</h5><div className="rp-fig">{rounded(B.at.brok)}</div>Comes out any time. Only the gains are taxed, at the lower capital-gains rates.</Side>
      </div>
      <div className="rp-wide">
        <div><Sec>Each year before 59½, by account</Sec>
          <StackBars rows={B.rows} h={230} parts={[{ f: (r) => r.trad - r.pen, color: C.forest }, { f: (r) => r.roth, color: C.woods }, { f: (r) => r.brok, color: C.sand }, { f: (r) => r.pen, color: C.ember }]} />
          <div className="rp-key">{B.out.trad >= 100 ? <span><i style={{ "--sw": C.forest } as React.CSSProperties} />Traditional</span> : null}{B.out.roth >= 100 ? <span><i style={{ "--sw": C.woods } as React.CSSProperties} />Roth</span> : null}
            {B.out.brok >= 100 ? <span><i style={{ "--sw": C.sand } as React.CSSProperties} />Brokerage</span> : null}{B.pen > 1 ? <span><i style={{ "--sw": C.ember } as React.CSSProperties} />Penalty</span> : null}</div></div>
        <div><Sec>{B.tool ? "From the Early Retirement Bridge" : "Find your best way across"}</Sec>
          <Side>{B.tool ? <><h5>{B.tool.phrase}</h5>{B.tool.hold != null ? <>Gets you to 59½ penalty-free in <b>{B.tool.hold}%</b> of historical markets</> : "Your chosen bridge"}{B.tool.left != null ? <>, with about <b>{rounded(B.tool.left)}</b> left at 59½.</> : "."}</>
            : B.move ? <><h5>{B.move.t}</h5><Html as="span" html={B.move.d} /></> : <>The Early Retirement Bridge compares the ways to reach your savings before 59½ through every market since {M.S.H.first}.</>}</Side></div>
      </div>
      <Sec>The ways to reach the money early</Sec>
      <ol className="rp-poi plain">
        {M.retire >= 55 ? <li><span><b>The rule of 55.</b> Leave the job in or after the year you turn 55 and that employer&apos;s 401(k) pays out without the penalty. Other accounts don&apos;t qualify.</span></li> : null}
        <li><span><b>72(t) payments.</b> Equal yearly payments from an IRA, set by IRS formula, for five years or to 59½, whichever is longer. Change them and the penalty comes back.</span></li>
        <li><span><b>A Roth ladder.</b> Convert some traditional money to Roth each year; each conversion can come out penalty-free five years later.</span></li>
        <li><span><b>Live off the brokerage account and Roth contributions</b> first, and leave the traditional accounts to grow until 59½.</span></li>
      </ol>
    </Sheet>
  );
}

/* ---------- Social Security for a couple ---------- */
function Social({ M, p }: { M: ReportModel; p: PageInfo }) {
  const Q = M.social!, total = Q.a1 + Q.a2, ssRows = M.rows.filter((r) => r.age >= M.firstClaim);
  const ladderMax = Math.max(...Q.ladder1.map((x) => x.v), ...Q.ladder2.map((x) => x.v));
  const one = (n: 1 | 2) => {
    const name = cap(n === 1 ? M.who.first : M.who.second), a = n === 1 ? Q.a1 : Q.a2, pia = n === 1 ? Q.pia1 : Q.pia2, c = n === 1 ? Q.claim1 : Q.claim2, own = n === 1 ? Q.own1 : Q.own2;
    return <div><Sec>{name === "You" ? "Your benefit" : name}</Sec>
      <div className="rp-g2 tight"><Side><div className="rp-fig"><Est on={!own}>{money(a / 12)}</Est></div>a month, claiming at {c}</Side>
        <Side><div className="rp-fig"><Est on={!own}>{money(pia)}</Est></div>a month at full retirement age, 67</Side></div>
      <p className="rp-small">{own ? "From your Social Security statement." : "Estimated from income. Your statement at ssa.gov/myaccount has the real figure."}</p>
      <h6 className="rp-mini">Claiming at each age from 62 to 70</h6>
      <ClaimLadder list={n === 1 ? Q.ladder1 : Q.ladder2} pick={c} max={ladderMax} /></div>;
  };
  return (
    <Sheet M={M} p={p}>
      <Lead h={<>{money(total / 12)} per month together, {Q.claim1 === Q.claim2 ? "each claiming at " + Q.claim1 : "claiming at " + Q.claim1 + " and " + Q.claim2}.</>}>
        Each of you gets a benefit from your own work record, or up to half the other&apos;s full benefit if that&apos;s more{Q.spousal ? ", which your plan uses" : ""}. Claiming before 67 shrinks a benefit for life; each year of waiting past 67 raises it 8%, up to 70.
      </Lead>
      <div className="rp-g2">{one(1)}{one(2)}</div>
      <div className="rp-wide">
        <div><Sec>Social Security each year, by {M.who.axisIn}</Sec>
          <StackBars rows={ssRows} h={190} parts={[{ f: (r) => r.ss, color: C.water }]} line={{ f: (r) => (r.ss > 0 ? Q.survivor : 0), color: C.trail }} />
          <div className="rp-key"><span><i style={{ "--sw": C.water } as React.CSSProperties} />Both of you, to {M.end}</span><span><i className="dash" style={{ "--sw": C.trail } as React.CSSProperties} />What one of you keeps, alone</span></div></div>
        <div><Sec>When one of you dies</Sec>
          <Side><div className="rp-fig">{money(Q.survivor / 12)}</div>a month for the survivor: the larger of the two benefits carries on and the smaller one stops, so the household&apos;s Social Security falls from {money(total / 12)}.
            <h5 className="gap">Why it matters</h5>The higher earner&apos;s claiming age sets the survivor&apos;s benefit too, which is why waiting often pays off for couples. The Plan Optimizer tries every pair of claiming ages.</Side></div>
      </div>
    </Sheet>
  );
}

/* ---------- a pension ---------- */
function Pension({ M, p }: { M: ReportModel; p: PageInfo }) {
  const Pn = M.pension!, both = Pn.withSS ? (Pn.withSS.pension + Pn.withSS.ss) / Math.max(1, Pn.withSS.spend) : 0;
  return (
    <Sheet M={M} p={p}>
      <Lead h={<>{money(Pn.monthly)} per month from {Pn.from}, {Pn.cola ? "rising with inflation" : "a fixed amount"}.</>}>
        It covers {pctStr(Pn.share, 0)} of what you spend in its first year{both > 0 ? <>, and with Social Security, {both >= 1 ? "all" : pctStr(both, 0)} of it once {M.who.married ? "you both claim" : "you claim"}</> : null}.
        {" "}{Pn.cola ? "With a cost-of-living raise it keeps its value for life." : <>Without a cost-of-living raise it buys less each year: by {M.end} it&apos;s worth about {money(Pn.lastYear / 12)} per month in today&apos;s dollars.</>}
      </Lead>
      <Sec>Guaranteed income each year, against what you spend</Sec>
      <StackBars rows={M.rows} w={732} h={230} parts={[{ f: (r) => r.pension, color: C.dusk }, { f: (r) => r.ss, color: C.water }]} line={{ f: (r) => r.spend, color: C.trail }} />
      <div className="rp-key"><span><i style={{ "--sw": C.dusk } as React.CSSProperties} />Pension</span><span><i style={{ "--sw": C.water } as React.CSSProperties} />Social Security</span>
        <span><i className="dash" style={{ "--sw": C.trail } as React.CSSProperties} />{money(M.S.spend)} you spend</span></div>
      <div className="rp-g3 gap">
        <Side><div className="rp-fig">{money(Pn.firstYear)}</div>in its first year, in today&apos;s dollars</Side>
        <Side><div className="rp-fig">{rounded(Pn.total)}</div>over the whole retirement</Side>
        <Side><div className="rp-fig">{pctStr(Pn.share, 0)}</div>of your spending, from the first year</Side>
      </div>
      <Sec>Every five years, in today&apos;s dollars</Sec>
      <table className="rp-t"><thead><tr><th>{M.who.axis}</th><th>Pension a month</th><th>Social Security a month</th><th>Share of spending</th></tr></thead><tbody>
        {M.rows.filter((r) => r.pension > 0 && (r.age - Pn.from) % 5 === 0).map((r) => <tr key={r.age}><td>{r.age}</td><td>{money(r.pension / 12)}</td><td>{r.ss >= 1 ? money(r.ss / 12) : "–"}</td><td>{pctStr((r.pension + r.ss) / Math.max(1, r.spend), 0)}</td></tr>)}
      </tbody></table>
      <Sec>Worth checking with the plan</Sec>
      <ol className="rp-poi plain">
        <li><span><b>{Pn.cola ? "How the raise is set." : "Whether there's any raise at all."}</b> {Pn.cola ? "Some plans cap the yearly raise; a cap below inflation shrinks it slowly." : "Some plans add one now and then; the plan here assumes none."}</span></li>
        {M.who.married ? <li><span><b>Whether it continues for {M.who.second}.</b> A joint-and-survivor option keeps paying after the first death, for a smaller check now. The plan assumes it pays as entered, for life.</span></li> : null}
        <li><span><b>Lump sum or monthly.</b> If you&apos;re offered a lump sum, compare it with what the monthly payments would cost to buy; the Drawdown Simulator can test both.</span></li>
      </ol>
    </Sheet>
  );
}

/* ---------- the Plan Optimizer's roadmap (when applied) ---------- */
function Roadmap({ M, p }: { M: ReportModel; p: PageInfo }) {
  const Rm = M.roadmap!, B = Rm.base, conv = M.rows.filter((r) => r.age < (Rm.until ?? M.rmdAge) + 1);
  return (
    <Sheet M={M} p={p}>
      <Lead h={<>The Plan Optimizer&apos;s plan for &ldquo;{Rm.goal.toLowerCase()}&rdquo;, applied to yours.</>}>
        {Rm.goalDesc}. It claims Social Security at {Rm.claims} and draws {lowerFirst(Rm.line)}. The rest of this report already uses it.
      </Lead>
      <Sec>With and without the roadmap</Sec>
      <table className="rp-t"><thead><tr><th>In the middle of history</th><th>Without it</th><th>With it</th></tr></thead><tbody>
        <tr><td>Social Security claimed at</td><td>{B ? (M.who.married ? B.claim + " & " + B.claim2 : B.claim) : "–"}</td><td>{Rm.claimsShort}</td></tr>
        <tr><td>Income tax over retirement</td><td>{B ? money(B.tax) : "–"}</td><td>{money(Rm.now.tax)}</td></tr>
        <tr><td>Lasted in</td><td>{B ? pctStr(B.success, 0) : "–"}</td><td>{pctStr(Rm.now.success, 0)}</td></tr>
        <tr><td>Left at the end, after tax</td><td>{B ? money(B.legacy) : "–"}</td><td>{money(Rm.now.legacy)}</td></tr>
      </tbody></table>
      <div className="rp-wide">
        <div><Sec>Roth conversions each year</Sec>
          {Rm.convTotal > 1 ? <StackBars rows={conv} h={230} parts={[{ f: (r) => r.conv, color: C.dusk }]} /> : <p className="rp-body">No Roth conversions: the roadmap changes the claiming ages and the order of withdrawals.</p>}</div>
        <div><Sec>What it adds up to</Sec>
          <Side>{Rm.convTotal > 1 ? <><div className="rp-fig">{rounded(Rm.convTotal)}</div>converted to Roth{Rm.until ? " by " + Rm.until : ""}, paying the tax in lower-tax years so required withdrawals are smaller later.</> : <h5>Claiming and withdrawals only</h5>}
            {B ? <><h5 className="gap">Tax</h5>{B.tax - Rm.now.tax >= 0 ? money(B.tax - Rm.now.tax) + " less" : money(Rm.now.tax - B.tax) + " more"} income tax over retirement than without the roadmap.</> : null}</Side></div>
      </div>
      {Rm.convTotal > 1 ? <><Sec>The conversion years</Sec>
        <table className="rp-t"><thead><tr><th>Year</th><th>{M.who.axis.replace("'s age", "")}</th><th>Converted to Roth</th><th>From traditional</th><th>Social Security</th><th>Income tax</th></tr></thead><tbody>
          {conv.filter((r) => r.conv > 0).map((r) => <tr key={r.age}><td>{M.year0 + (r.age - M.accum[0].age)}</td><td>{r.age}</td><td>{money(r.conv)}</td><td>{money(r.trad)}</td><td>{r.ss >= 1 ? money(r.ss) : "–"}</td><td>{money(r.tax + r.irmaa)}</td></tr>)}
        </tbody></table></> : null}
      <p className="rp-small gap">Run the Plan Optimizer again after a big change in the Guide: a new retirement age, spending or savings changes the best roadmap.</p>
    </Sheet>
  );
}

/* ---------- debt ---------- */
function Debt({ M, p }: { M: ReportModel; p: PageInfo }) {
  const D = M.debt!, P = D.plan, area = M.R.P.debt;
  return (
    <Sheet M={M} p={p}>
      {P ? <Lead h={<>Debt-free {D.free ? "by " + D.free : "once the plan clears"}, paying {money(P.interest)} in interest.</>}>
          From the Debt Payoff tool: the highest rate first, with {money(D.extra)} per month on top of the minimums. That&apos;s {money(P.saved)} less interest{P.minMonths > P.months ? " and " + yrsMo(P.minMonths - P.months) + " sooner" : ""} than paying the minimums alone.
        </Lead>
        : <Lead h={<>{money(D.total)} owed besides the mortgage{D.hi > 0 ? <>, {money(D.hi)} of it at 8% or more</> : null}.</>}>
          Paying off high-rate debt is the surest return there is: every dollar there saves 8% or more a year, more than investing is likely to earn. The Debt Payoff tool puts your debts in order and dates each payoff; bring it back to the Guide and this page shows the plan.
        </Lead>}
      {P ? <><Sec>When each debt is paid off</Sec><DebtLines order={P.order} months={P.months} />
        <div className="rp-key"><span><i style={{ "--sw": C.trail } as React.CSSProperties} />8% or more</span><span><i style={{ "--sw": C.clay } as React.CSSProperties} />Under 8%</span></div>
        <Sec>Each debt</Sec>
        <table className="rp-t"><thead><tr><th>Debt</th><th>Rate</th><th>Balance today</th><th>Interest it costs</th><th>Paid off in</th></tr></thead><tbody>
          {P.order.map((d, i) => <tr key={i}><td>{d.desc}</td><td>{d.apr.toFixed(1)}%</td><td>{money(d.start)}</td><td>{money(d.interest)}</td><td>{yrsMo(d.month)}</td></tr>)}
          <tr className="tot"><td>All</td><td /><td>{money(P.order.reduce((t, d) => t + d.start, 0))}</td><td>{money(P.interest)}</td><td>{yrsMo(P.months)}</td></tr></tbody></table>
        <div className="rp-g3 gap">
          <Side><div className="rp-fig">{money(P.interest)}</div>in interest with this plan</Side>
          <Side><div className="rp-fig">{money(P.minInterest)}</div>paying only the minimums</Side>
          <Side><div className="rp-fig">{P.minMonths > P.months ? yrsMo(P.minMonths - P.months) : "–"}</div>{P.minMonths > P.months ? "sooner debt-free than minimums alone" : "no sooner than minimums alone"}</Side></div>
        {P.warn.length ? <p className="rp-small">The minimum on {and(P.warn)} doesn&apos;t cover its interest, so that balance grows until the extra reaches it.</p> : null}</>
        : <div className="rp-g3 gap">
          <Side><div className="rp-fig">{money(D.total)}</div>owed, not counting the mortgage</Side>
          <Side><div className="rp-fig">{money(D.hi)}</div>of it at 8% or more</Side>
          <Side><div className="rp-fig">{D.min ? money(D.min) : "–"}</div>{D.min ? "per month in minimum payments" : "minimum payments not entered"}</Side></div>}
      {area ? <><Sec>Debt in your score</Sec>
        <div className="rp-wide"><div><p className="rp-body">{cap(area.txt)}: {Math.round(area.p * 15)} of 15 points.{area.p < 0.999 ? " Clearing the high-rate debt earns the rest." : ""}</p></div><div /></div></> : null}
      {D.moves.length ? <><Sec>The moves</Sec><ol className="rp-poi plain">{D.moves.map((m) => <li key={m.id}><span><b>{m.t}.</b> <Html as="span" html={m.d} /></span></li>)}</ol></> : null}
    </Sheet>
  );
}
const yrsMo = (m: number) => (m < 12 ? m + (m === 1 ? " month" : " months") : (Math.round((m / 12) * 10) / 10) + " years");
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Every page of the report, in order. */
export function ReportPages({ M }: { M: ReportModel }) {
  return <>{M.pages.map((p, i) => {
    const part = M.pages.slice(0, i).filter((x) => x.id === "years").length;
    switch (p.id) {
      case "cover": return <Cover key={p.n} M={M} />;
      case "stand": return <Stand key={p.n} M={M} p={p} />;
      case "road": return <Road key={p.n} M={M} p={p} />;
      case "family": return <Family key={p.n} M={M} p={p} />;
      case "college": return <College key={p.n} M={M} p={p} />;
      case "bridge": return <Bridge key={p.n} M={M} p={p} />;
      case "social": return <Social key={p.n} M={M} p={p} />;
      case "pension": return <Pension key={p.n} M={M} p={p} />;
      case "roadmap": return <Roadmap key={p.n} M={M} p={p} />;
      case "debt": return <Debt key={p.n} M={M} p={p} />;
      case "last": return <Last key={p.n} M={M} p={p} />;
      case "money": return <Money key={p.n} M={M} p={p} />;
      case "health": return <Health key={p.n} M={M} p={p} />;
      case "score": return <Score key={p.n} M={M} p={p} />;
      case "moves": return <Moves key={p.n} M={M} p={p} />;
      case "sources": return <Sources key={p.n} M={M} p={p} />;
      case "years": return <Years key={p.n} M={M} p={p} part={part} />;
    }
  })}</>;
}
