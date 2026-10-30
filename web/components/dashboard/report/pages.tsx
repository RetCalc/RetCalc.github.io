/* The Dashboard report's pages, in the Guide report's direction C (a black
   band on every sheet with the title, the RetCalc mark and the page number,
   the NPS map palette, Public Sans; .impeccable/surfaces/guide-report.md):
   the household's whole picture up front (net worth, pay, spending, saving,
   the home, the children), then the retirement plan, the score and what to
   do, and the advisor's appendix at the back. Each page is a fixed US
   Letter sheet. The words follow the household: one person or two, owning
   or renting, retiring early, abroad, every history lasting or not. */

import { fmtNum, money, pctStr } from "@/lib/format";
import { STATE_OPTIONS } from "@/lib/states";
import { fraLabel } from "@/tools/social/model";
import {
  C, ClaimLadder, HistoryBars, IncomeBars, IncomeKey, LifetimeBars, OUT_COLOR, PHASE_COLOR, ReportMark, SOURCE_COLOR, ScoreBar, StackBars, Trail, YearBars,
} from "@/tools/guide/report/charts";
import { axis } from "@/tools/guide/report/charts";
import { rounded } from "@/tools/guide/words";
import { pctDown } from "../format";
import { AgeStack, Climb, Fan, HBars, Lanes, Lines, OwedBars, SplitBar, WorthLine, WorthMap, kidColor } from "./charts";
import type { DashReport, PageInfo } from "./model";

type M_ = DashReport;
const Brand = () => <span className="rp-brand"><ReportMark />RetCalc</span>;
const Est = ({ on, children }: { on?: boolean; children: React.ReactNode }) => (on ? <span className="rp-est">{children}</span> : <>{children}</>);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const low = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
/** "a, b and c", safe for items with commas in them ("$21,000"). */
const and = (l: string[]) => (l.length < 2 ? l.join("") : l.slice(0, -1).join(", ") + " and " + l[l.length - 1]);
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const num = (n: number) => (n >= 0 && n <= 12 ? WORDS[n] : fmtNum(n));
const yrs = (n: number) => num(n) + (n === 1 ? " year" : " years");
const pageOf = (M: M_, id: PageInfo["id"]) => M.pages.find((p) => p.id === id)?.n;
const pct = (v: number) => pctDown(v) + "%";
/** How often it lasted, in words: "every past retirement since 1926", or the count. */
const lastedIn = (M: M_) => (M.hist.ok === M.hist.of ? "every past retirement since " + M.hist.first : fmtNum(M.hist.ok) + " of " + fmtNum(M.hist.of) + " past retirements");
const longDate = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

/** A page after the cover: the slim band, the body and the footer. */
function Sheet({ M, p, foot, children }: { M: M_; p: PageInfo; foot?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rp-page" aria-label={p.title}>
      <div className="rp-band slim"><div><h2>{p.title}</h2>{p.because ? <div className="rp-because">{p.because}</div> : null}</div>
        <div className="rp-band-r"><Brand /><span className="rp-pg">{p.n}</span></div></div>
      <div className="rp-in">{children}</div>
      <div className="rp-foot"><span>{M.who.title === "Your financial plan" ? "Financial plan" : M.who.title + " · Financial plan"} · {M.date}</span>
        <span>{foot ?? <>Every figure in today&apos;s dollars. <span className="rp-est">Dashed</span> figures are estimated.</>}</span></div>
    </section>
  );
}
const Lead = ({ h, children }: { h: React.ReactNode; children: React.ReactNode }) => <div className="rp-lead"><h3>{h}</h3><p>{children}</p></div>;
const Sec = ({ children }: { children: React.ReactNode }) => <h4 className="rp-sech">{children}</h4>;
const Side = ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={"rp-side" + (className ? " " + className : "")}>{children}</div>;
const Fig = ({ v, children, sm }: { v: React.ReactNode; children: React.ReactNode; sm?: boolean }) => <Side><div className={"rp-fig" + (sm ? " sm" : "")}>{v}</div>{children}</Side>;
const Stops = ({ M, years, cols }: { M: M_; years?: boolean; cols?: boolean }) => (
  <ol className={"rp-poi" + (cols ? " cols" : "")}>{M.stops.map((s, i) => (
    <li key={i}><span className="rp-num">{i + 1}</span><span><b>{s.t}, {years ? M.yearOf(s.age) : s.age}.</b> <Est on={s.est}>{s.d}</Est></span></li>
  ))}</ol>
);
const Facts = ({ list }: { list: [string, React.ReactNode][] }) => <dl className="rp-facts">{list.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;

const TAB: [RegExp, string][] = [[/\/accounts/, "Net worth"], [/\/income/, "Income"], [/\/spending/, "Spending"], [/\/savings/, "Taxes & Savings"], [/\/retirement/, "Retirement"],
  [/\/calculator/, "Calculator"], [/\/profile/, "Profile"], [/\/home/, "Your home"], [/\/setup/, "Setup"], [/\/tools/, "Tools"], [/^\/dashboard(#|$)/, "Dashboard"]];
const tabOf = (href: string) => TAB.find(([r]) => r.test(href))?.[1] ?? "Dashboard";
/* ---------- cover ---------- */
function Cover({ M }: { M: M_ }) {
  const s = M.R.success ?? 0, ssEst = !M.pr.ss.checked;
  return (
    <section className="rp-page" aria-label="Cover">
      <div className="rp-band"><div><h1>{M.who.title}</h1><div className="rp-sub">Financial plan · Calculated {M.date} · Every figure in today&apos;s dollars</div></div>
        <div className="rp-band-r col"><Brand /><span>The complete retirement<br />planning toolkit</span></div></div>
      <div className="rp-map"><WorthMap M={M} h={M.stops.length > 8 ? 450 : 520} />
        <div className={"rp-legend" + (M.legendRight ? " right" : "")}><h5>Your net worth, age {M.mapFrom} to {M.end}</h5>
          {M.worth.history.length > 1 ? <div><i className="line" style={{ "--sw": C.band } as React.CSSProperties} />So far, from your balance updates</div> : null}
          <div><i className="line" style={{ "--sw": C.trail } as React.CSSProperties} />Your plan, through the middle of history</div>
          <div><i style={{ "--sw": C.woods } as React.CSSProperties} />Half of historical retirements</div>
          <div><i style={{ "--sw": C.woodsLight } as React.CSSProperties} />8 in 10 historical retirements</div>
          <div className="rp-scale"><b />10 years</div></div></div>
      <div className="rp-cols">
        <div><h5>Points along the way</h5><Stops M={M} years /></div>
        <div><h5>Will it last?</h5><div className="rp-fig">{pct(s)}</div>
          <p>{M.hist.ok === M.hist.of ? "It lasted to " + M.end + " in every retirement since " + M.hist.first + "." : "It lasted to " + M.end + " in " + fmtNum(M.hist.ok) + " of " + fmtNum(M.hist.of) + " past retirements."}
            {M.hist.strat ? " Drawing down with " + M.hist.strat.name + "." : " Spending a fixed amount that rises with prices."}</p>
          <h5 className="gap">Readiness</h5><div className="rp-fig">{M.score != null ? M.score + " / 100" : "Not scored"}</div>
          <p>{M.score != null ? M.rating.label + "." : "It needs at least two of its five areas."} Page {pageOf(M, "score")} shows each area.</p></div>
        <div><h5>Net worth today</h5><div className="rp-fig">{money(M.worth.net)}</div>
          <p>{money(M.worth.assets)} in assets{M.worth.debts > 0 ? ", " + money(M.worth.debts) + " owed" : ", nothing owed"}{M.worth.date ? ", as of " + longDate(M.worth.date) : ""}.</p>
          <h5 className="gap">At retirement</h5><div className="rp-fig">{rounded(M.S.fv)}</div>
          <p>in savings at {M.retire}, in {M.R.retireYear}.{!M.abroad && M.R.ss ? <> Social Security adds <Est on={ssEst}>{money(M.R.ss)}</Est> per month{M.who.two ? " together" : ""}.</> : null}</p></div>
      </div>
      <div className="rp-foot"><span>RetCalc · retcalc.app</span><span>An educational plan, not financial advice. Past returns don&apos;t predict future ones.</span></div>
    </section>
  );
}

/* ---------- where you stand ---------- */
function Stand({ M, p }: { M: M_; p: PageInfo }) {
  const s = M.R.success ?? 0, onTrack = s >= M.goal, F = M.F;
  const toc = M.pages.filter((x) => x.id !== "cover" && !x.title.endsWith("continued"));
  const story = pageOf(M, "next")!, appx = pageOf(M, "sources")!, last = M.pages[M.pages.length - 1].n;
  const facts: [string, React.ReactNode][] = [
    ["Household", M.who.two ? M.who.pair(M.age0) : "Age " + M.age0],
    ["Retire", M.who.two ? (M.r2 != null && M.r2 !== M.retire ? M.who.First + " at " + M.pr.p1.retire + ", " + M.who.second + " at " + M.pr.p2.retire : "Both in " + M.R.retireYear) : "At " + M.retire + ", in " + M.R.retireYear],
    ["Net worth today", money(M.worth.net)],
    ["Saving", money(F.invested + F.match) + " per month" + (F.match > 0 ? ", match included" : "")],
    ["Spending today", money(M.spend.month) + " per month"],
    ["Spending once retired", money(M.R.spend ?? M.spend.month) + " per month" + (M.abroad ? ", before taxes" : ", after taxes")],
    ...(!M.abroad ? [["Social Security", <span key="ss">{M.social && M.who.two && M.social.claim2 !== M.social.claim1 ? "at " + M.social.claim1 + " and " + M.social.claim2 : "at " + M.S.ss.claim}, <Est on={!M.pr.ss.checked}>{money(M.R.ss ?? 0)}</Est> per month</span>] as [string, React.ReactNode]] : []),
    ["Withdrawal strategy", M.hist.strat ? M.hist.strat.name : "Not chosen: a fixed amount"],
    ["Mix once retired", cap(M.mixWords.split(", gliding")[0])],
    ...(!M.abroad ? [["Taxes, typical retired year", "About " + money(M.S.taxYr)] as [string, string]] : []),
    ["Plan runs to", M.who.two ? M.who.pair(M.end) : "Age " + M.end],
  ];
  return (
    <Sheet M={M} p={p}>
      <Lead h={onTrack ? <>You&apos;re on track: the plan lasted in {lastedIn(M)}.</> : <>The plan lasted in {pct(s)} of past retirements. It aims for {pctStr(M.goal, 0)}.</>}>
        This report is your Dashboard on paper: what you have and owe, where each month&apos;s pay goes, what you save, then the retirement it builds toward, how that holds up against every market since {M.hist.first}, your readiness score and the next steps. Every figure is in today&apos;s dollars, so {money(M.spend.month)} means what {money(M.spend.month)} buys now.
      </Lead>
      <div className="rp-g4 gap">
        <Fig v={money(M.worth.net)}>net worth today</Fig>
        <Fig v={rounded(M.S.fv)}>in savings at {M.retire}</Fig>
        <Fig v={pct(s)}>of past retirements lasted</Fig>
        <Fig v={M.score != null ? String(M.score) : "–"}>{M.score != null ? "readiness, out of 100" : "readiness: not scored yet"}</Fig>
      </div>
      <div className="rp-g2">
        <div><Sec>The plan in one table</Sec><Facts list={facts} /></div>
        <div><Sec>In this report</Sec>
          <ol className={"rp-toc" + (toc.length > 13 ? " long" : "")}>{toc.map((x) => <li key={x.n} className={x.because ? "cond" : ""}><b>{x.title}</b><span className="d" /><span className="pn">{x.n}</span></li>)}</ol></div>
      </div>
      <Sec>How to use this report</Sec>
      <div className="rp-g3">
        <Side><h5>Read pages 2 to {story} together</h5>Your money today, the plan, how it holds up and what to do next, in plain words.</Side>
        <Side><h5>Hand pages {appx} to {last} to an advisor</h5>The assumptions, the method, and every year of the plan in a table.</Side>
        <Side><h5>Print a new one after each update</h5>Update your balances on the Dashboard every month or so, and the whole report follows.</Side>
      </div>
      {M.steps.some((x) => !x.done) ? <><Sec>Where to start</Sec>
        <div className="rp-g3">{M.steps.filter((x) => !x.done).slice(0, 3).map((x, i) => <Side key={x.id}><h5><span className="rp-num inl">{i + 1}</span>{x.title}</h5>{x.why}. <span className="rp-tool">On {tabOf(x.href)}</span></Side>)}</div>
</> : null}
    </Sheet>
  );
}

/* ---------- net worth ---------- */
const GROUP_COLOR: Record<string, string> = { ret: C.forest, inv: C.sand, cash: C.water, home: C.clay, oth: C.dusk, mort: C.trail, loan: C.rose, card: C.ember };
function Worth({ M, p }: { M: M_; p: PageInfo }) {
  const W = M.worth, two = M.who.two, H = W.history, since = W.yearAgo ?? (H.length > 1 ? W.first : null);
  const cut = (l: ReturnType<typeof flat>, n: number) => (l.length > n ? [...l.slice(0, n - 1), { ...l[n - 1], more: l.length - n + 1, rest: l.slice(n - 1).reduce((t, x) => t + x.value, 0) }] : l);
  const flat = (gs: typeof W.assetGroups) => gs.flatMap((g) => g.items.map((it, i) => ({ ...it, group: i === 0 ? g.name : "", gid: g.id, more: 0, rest: 0 })));
  const assets = cut(flat(W.assetGroups), W.history.length > 1 ? 13 : 17), debts = cut(flat(W.debtGroups), 7);
  const dw = W.assets > 0 ? Math.max(140, Math.min(708, (708 * W.debts) / W.assets)) : 708;
  return (
    <Sheet M={M} p={p}>
      <Lead h={<>{money(W.net)} today: {money(W.assets)} you have{W.debts > 0 ? <>, {money(W.debts)} you owe</> : <> and nothing owed</>}.</>}>
        {W.accounts ? <>From your balances{W.date ? <> of {longDate(W.date)}</> : null}. {since ? <>Since {longDate(since.date)}, net worth has {W.net >= since.nw ? "grown" : "fallen"} by <b>{money(Math.abs(W.net - since.nw))}</b>. </> : null}
          Retirement accounts, the brokerage and cash feed the plan; the home counts in net worth{M.home && M.home.own ? " and the mortgage is paid from your budget" : ""}.</>
          : <>From the figures you gave in setup. Split your savings into accounts on the Dashboard&apos;s Net worth tab, with cash and debts, and this page lists each one, with the emergency fund and debt scored.</>}
      </Lead>
      <Sec>What you have and what you owe</Sec>
      <SplitBar label="Assets" parts={W.assetGroups.map((g) => ({ t: g.name, v: g.total, color: GROUP_COLOR[g.id] ?? C.gray, ink: g.id === "inv" ? C.ink : undefined }))} />
      {W.debts > 0 ? <div className="rp-part" style={{ "--w": dw + "px" } as React.CSSProperties}><SplitBar w={dw} label="Debts" parts={W.debtGroups.map((g) => ({ t: g.name, v: g.total, color: GROUP_COLOR[g.id] ?? C.gray }))} /></div> : null}
      <div className={H.length > 1 ? "rp-wide" : ""}>
        <div><Sec>Assets</Sec>
          <table className="rp-t"><thead><tr><th>Account</th><th className="l">Kind</th>{two ? <th className="l">Whose</th> : null}<th>Balance</th><th>Notes</th></tr></thead><tbody>
            {assets.map((it, i) => it.more ? <tr key={i}><td>{it.more} more</td><td className="l" />{two ? <td className="l" /> : null}<td>{money(it.rest)}</td><td /></tr>
              : <tr key={i}><td>{it.name}</td><td className="l">{it.kind}</td>{two ? <td className="l">{it.whose ?? "Shared"}</td> : null}<td>{money(it.value)}</td>
                <td>{it.gain != null ? (it.gain >= 0 ? "+" : "−") + money(Math.abs(it.gain)) + " gain" : it.basis != null ? money(it.basis) + " contributed" : ""}</td></tr>)}
            <tr className="tot"><td>All assets</td><td className="l" />{two ? <td className="l" /> : null}<td>{money(W.assets)}</td><td /></tr></tbody></table></div>
        {H.length > 1 ? <div><Sec>Net worth at each update</Sec><WorthLine M={M} w={300} h={190} />
          <div className="rp-g2 tight gap"><Fig sm v={fmtNum(H.length)}>balance updates since {new Date(H[0].date + "T12:00:00").getFullYear()}</Fig>
            {W.prev ? <Fig sm v={(W.net >= W.prev.nw ? "+" : "−") + money(Math.abs(W.net - W.prev.nw))}>since the update before, {longDate(W.prev.date)}</Fig> : null}</div></div> : null}
      </div>
      {debts.length ? <><Sec>Debts</Sec>
        <table className="rp-t"><thead><tr><th>Debt</th><th className="l">Kind</th>{two ? <th className="l">Whose</th> : null}<th>Rate</th><th>Owed</th></tr></thead><tbody>
          {debts.map((it, i) => it.more ? <tr key={i}><td>{it.more} more</td><td className="l" />{two ? <td className="l" /> : null}<td /><td>{money(it.rest)}</td></tr>
            : <tr key={i} className={(it.rate ?? 0) >= 0.08 ? "hl" : undefined}><td>{it.name}</td><td className="l">{it.kind}</td>{two ? <td className="l">{it.whose ?? "Shared"}</td> : null}<td>{it.rate != null ? (it.rate * 100).toFixed(2).replace(/\.?0+$/, "") + "%" : "–"}</td><td>{money(it.value)}</td></tr>)}
          <tr className="tot"><td>All debts</td><td className="l" />{two ? <td className="l" /> : null}<td /><td>{money(W.debts)}</td></tr></tbody></table>
        {W.debtsHigh > 0 ? <p className="rp-small">Shaded: {money(W.debtsHigh)} at 8% or more, which costs more than most saving earns. Paying it down first is a sure return.</p> : null}</> : null}
    </Sheet>
  );
}

/* ---------- income and taxes ---------- */
function Income({ M, p }: { M: M_; p: PageInfo }) {
  const F = M.F, T = F.tax, two = M.who.two, left = F.left, paySum = M.pay.reduce((t, x) => t + x.year, 0);
  const parts = [
    ...(!M.abroad ? [{ t: "Taxes", v: F.taxes, color: C.trail }] : []),
    ...(F.health > 0 ? [{ t: "Health premiums", v: F.health, color: C.clay }] : []),
    { t: "Saving", v: F.invested, color: C.forest }, ...(F.ef > 0 ? [{ t: "Emergency fund", v: F.ef, color: C.water }] : []),
    { t: "Spending", v: F.spendPaid, color: C.slate }, ...(left > 0 ? [{ t: "Left over", v: left, color: C.sand, ink: C.ink }] : []),
  ];
  return (
    <Sheet M={M} p={p}>
      <Lead h={M.abroad ? <>{money(F.afterTax)} per month comes in{two ? " for the two of you" : ""}.</> : <>{money(F.gross)} per month before taxes, {money(F.afterTax)} after.</>}>
        {M.abroad ? <>You live outside the US, so pay is entered after taxes and the plan counts no US taxes or Social Security. Retirement figures in this report are before any taxes where you live.</>
          : <>Taxes here are this year&apos;s, worked out by the Dashboard&apos;s paycheck calculator with your filing status, {M.pr.state ? STATE_OPTIONS.find((s) => s.code === M.pr.state)?.name ?? "your state" : "your state"}, your deductions and what goes in before tax. {F.match > 0 ? <>Your employer adds <b>{money(F.match)}</b> per month on top.</> : null}</>}
      </Lead>
      <Sec>Where each month&apos;s pay goes</Sec>
      <SplitBar parts={parts} h={58} />
      {left < -1 ? <p className="rp-small"><b>{money(-left)} per month more goes out than comes in.</b> The plan counts what you save; the budget has to find the rest.</p> : null}
      <div className="rp-wide">
        <div><Sec>Pay</Sec>
          <table className="rp-t"><thead><tr><th>Who</th><th>{M.abroad ? "Pay per year, after taxes" : "Pay per year"}</th><th className="l">Entered as</th><th>Retires at</th></tr></thead><tbody>
            {M.pay.map((x) => <tr key={x.name}><td>{x.name}</td><td>{money(x.year)}</td><td className="l">{x.entered != null ? money(x.entered) + " " + x.per + (x.after ? ", after taxes" : "") : "Not entered"}</td><td>{x.retire ?? "–"}</td></tr>)}
            {two ? <tr className="tot"><td>Together</td><td>{money(paySum)}</td><td className="l" /><td /></tr> : null}
            {M.other.map((o) => <tr key={o.id}><td>{o.name || "Other income"}</td><td>{money((o.amount ?? 0) * 12)}</td><td className="l">{money(o.amount ?? 0)} per month, after taxes</td><td /></tr>)}
          </tbody></table>
          {!M.abroad && T ? <><Sec>Taxes this year</Sec>
            <table className="rp-t"><thead><tr><th>Tax</th><th>Per year</th><th>Per month</th><th>Share of pay</th></tr></thead><tbody>
              {([["Federal income tax", T.federal], ["State income tax", T.state], ...(T.local > 0 ? [["Local income tax", T.local] as [string, number]] : []), ["Social Security and Medicare", T.fica]] as [string, number][])
                .map(([k, v]) => <tr key={k}><td>{k}</td><td>{money(v)}</td><td>{money(v / 12)}</td><td>{paySum > 0 ? pctStr(v / paySum, 1) : "–"}</td></tr>)}
              <tr className="tot"><td>All taxes</td><td>{money(T.total)}</td><td>{money(T.total / 12)}</td><td>{paySum > 0 ? pctStr(T.total / paySum, 1) : "–"}</td></tr></tbody></table></> : null}
        </div>
        <div><Sec>Each month</Sec>
          <Side><div className="rp-fig">{money(F.afterTax)}</div>after taxes{F.health > 0 ? " and health premiums" : ""}.
            <h5 className="gap">{left >= 0 ? "Left over" : "Short"}</h5>{left >= 0 ? <><b>{money(left)}</b> per month isn&apos;t assigned to saving or spending. {left > 50 ? "Putting it to work is one of your next steps." : "Nearly every dollar has a job."}</>
              : <>Spending and saving come to <b>{money(-left)}</b> more than comes in.</>}
            {!M.abroad && T && paySum > 0 ? <><h5 className="gap">Your tax rate</h5>{pctStr(T.total / paySum, 1)} of pay goes to taxes of every kind, {pctStr(T.federal / paySum, 1)} of it federal income tax.</> : null}</Side></div>
      </div>
      <Sec>The month in full</Sec>
      <table className="rp-t"><thead><tr><th>{M.abroad ? "Coming in" : "From pay before taxes"}</th><th>Per month</th><th>Per year</th><th>Share</th></tr></thead><tbody>
        {([...(M.abroad ? [["Pay after taxes", F.afterTax]] : [["Pay before taxes", F.gross], ["Taxes", -F.taxes]]), ...(F.health > 0 ? [["Health premiums from pay", -F.health]] : []),
          ["Saving and investing", -F.invested], ...(F.ef > 0 ? [["Emergency fund", -F.ef]] : []), ["Spending", -F.spendPaid]] as [string, number][])
          .map(([k, v]) => <tr key={k}><td>{k}</td><td>{v < 0 ? "−" + money(-v) : money(v)}</td><td>{v < 0 ? "−" + money(-v * 12) : money(v * 12)}</td><td>{(M.abroad ? F.afterTax : F.gross) > 0 ? pctStr(Math.abs(v) / (M.abroad ? F.afterTax : F.gross), 0) : "–"}</td></tr>)}
        <tr className="tot"><td>{left >= 0 ? "Left over" : "Short"}</td><td>{money(Math.abs(left))}</td><td>{money(Math.abs(left) * 12)}</td><td>{(M.abroad ? F.afterTax : F.gross) > 0 ? pctStr(Math.abs(left) / (M.abroad ? F.afterTax : F.gross), 0) : "–"}</td></tr>
        {F.match > 0 ? <tr><td>Plus your employer&apos;s match</td><td>{money(F.match)}</td><td>{money(F.match * 12)}</td><td /></tr> : null}</tbody></table>
    </Sheet>
  );
}

/* ---------- spending ---------- */
function Spending({ M, p }: { M: M_; p: PageInfo }) {
  const Sp = M.spend, cushion = Sp.cushion, top = Sp.lines.slice(0, 8);
  return (
    <Sheet M={M} p={p}>
      <Lead h={<>{money(Sp.month)} per month, {money(Sp.month * 12)} per year.</>}>
        {Sp.detailed ? <>From your budget on the Dashboard&apos;s Spending tab: {num(Sp.lines.length)} {Sp.lines.length === 1 ? "line" : "lines"} in {num(Sp.groups.length)} {Sp.groups.length === 1 ? "group" : "groups"}{Sp.college > 0 ? <>, plus {money(Sp.college)} per month saved for college</> : null}.</>
          : <>Spending is one number for now. Build the budget on the Dashboard&apos;s Spending tab and this page shows where each month goes.</>}
        {" "}Once retired, the plan spends <b>{money(Sp.planSpend ?? Sp.month)}</b> per month{Sp.own ? ", set by the starting rate on Retirement" : Sp.goal != null && Math.abs((Sp.goal ?? 0) - Sp.month) > 5 ? ", the goal you set" : ", the same as today"}.
      </Lead>
      {Sp.groups.length > 1 ? <div className="rp-wide gap">
        <div><Sec>By group, per month</Sec><HBars list={Sp.groups.map((g) => ({ t: g.group, v: g.month }))} w={420} color={C.slate} lw={140} /></div>
        <div><Sec>The biggest lines</Sec>
          <table className="rp-t"><tbody>{top.map((l, i) => <tr key={i}><td>{l.desc}</td><td>{money(l.month)}</td></tr>)}</tbody></table>
          {Sp.lines.length > top.length ? <p className="rp-small">And {num(Sp.lines.length - top.length)} more, {money(Sp.lines.slice(top.length).reduce((t, l) => t + l.month, 0))} per month{Sp.lines.length + Sp.groups.length <= 16 ? ", all listed below" : ""}.</p> : null}</div>
      </div> : null}
      <Sec>Emergency fund</Sec>
      <div className="rp-g3">
        <Fig v={money(Sp.efTarget)}>your goal: {num(Sp.efMonths)} months of the spending it&apos;s sized on</Fig>
        <Fig v={Sp.cash != null ? money(Sp.cash) : "–"}>{Sp.cash != null ? "in checking and savings today" : "cash not entered yet"}</Fig>
        <Fig v={cushion != null ? cushion.toFixed(1) : "–"}>{cushion != null ? (cushion >= Sp.efMonths ? "months set aside: the goal is met" : "months set aside, " + money(Math.max(0, Sp.efTarget - (Sp.cash ?? 0))) + " to go") : "months set aside"}</Fig>
      </div>
      <Sec>Spending once retired</Sec>
      <div className="rp-g3 sp">
        <Fig v={money(Sp.planSpend ?? Sp.month)}>per month the plan spends once retired{M.abroad ? ", before taxes" : ", taxes paid on top"}</Fig>
        {!M.abroad ? <Fig v={money(M.S.taxYr / 12)}>per month in taxes in a typical retired year</Fig> : <Fig v={money((Sp.planSpend ?? Sp.month) * 12)}>per year</Fig>}
        {Sp.drop ? <Fig v={money(Sp.drop.monthly)}>less per month once the mortgage is paid off in {Math.floor(Sp.drop.year)}{M.pr.retSpend == null ? ": the plan takes it off retirement spending from then" : ""}</Fig>
          : <Fig v={money(Sp.month)}>per month you spend today, for comparison</Fig>}
      </div>
      {Sp.detailed && Sp.lines.length > top.length && Sp.lines.length + Sp.groups.length <= 16 ? <><Sec>The whole budget, per month</Sec>
        <div className="rp-cols2">{Sp.groups.map((g) => <table key={g.group} className="rp-t"><thead><tr><th>{g.group}</th><th>{money(g.month)}</th></tr></thead>
          <tbody>{Sp.lines.filter((l) => l.group === g.group).map((l, i) => <tr key={i}><td>{l.desc}</td><td>{money(l.month)}</td></tr>)}</tbody></table>)}</div></> : null}
      {!Sp.detailed || Sp.lines.length <= 2 ? <><Sec>Make it a budget</Sec>
        <p className="rp-body">One number is enough for the plan, but a budget shows where each month goes and what to cut first. Add lines on the Dashboard&apos;s Spending tab (groceries, transportation, insurance, subscriptions) and the next report lists them by group, with the biggest first.</p></> : null}
    </Sheet>
  );
}

/* ---------- saving and investing ---------- */
function Saving({ M, p }: { M: M_; p: PageInfo }) {
  const Sv = M.save, F = Sv.F, two = M.who.two, A = Sv.atRetire, tot = A.trad + A.roth + A.brok;
  const ys = Sv.years, peak = ys.length ? Math.max(...ys.map((y) => y.t + y.r + y.b)) : 0, lowY = ys.length ? Math.min(...ys.map((y) => y.t + y.r + y.b)) : 0;
  return (
    <Sheet M={M} p={p}>
      <Lead h={<>{money(F.invested + F.match)} per month into savings{Sv.rate != null ? <>, {pctStr(Sv.rate, 0)} of pay</> : null}.</>}>
        {F.match > 0 ? <>That&apos;s {money(F.invested)} of your own and {money(F.match)} from {two ? "employers" : "your employer"}{F.fullMatch === false ? <>, short of the full match</> : F.fullMatch ? ", the whole match" : ""}. </> : null}
        Each line grows as you set it on Taxes &amp; Savings and stops at its legal limit. At {M.retire} the plan has <b>{rounded(M.S.fv)}</b>, growing {pctStr((1 + M.pr.assume.growth) / (1 + M.pr.assume.inflation) - 1, 1)} per year after inflation.
      </Lead>
      <div className="rp-wide gap">
        <div><Sec>Each line, per month today</Sec>
          <table className="rp-t"><thead><tr><th>Line</th><th>Per month</th><th>Limit per month</th><th className="l">Grows</th></tr></thead><tbody>
            {Sv.lines.map((l) => <tr key={l.id}><td>{l.name}</td><td>{money(l.amount)}</td><td>{isFinite(l.cap) ? money(l.cap) : "None"}</td>
              <td className="l">{l.capped ? "At the limit" : l.growth > 0 ? pctStr(l.growth, 0) + " per year" + (l.years != null ? ", at the limit in " + yrs(l.years) : "") : "Stays the same"}</td></tr>)}
            {F.match > 0 ? <tr><td>Employer match</td><td>{money(F.match)}</td><td /><td className="l">Follows the first line</td></tr> : null}
            <tr className="tot"><td>All saving</td><td>{money(F.invested + F.match)}</td><td /><td className="l" /></tr></tbody></table>
          {two ? <><Sec>Each of you, per month</Sec>
            <table className="rp-t"><thead><tr><th>Who</th><th>Traditional</th><th>Roth and HSA</th><th>Of it, the match</th></tr></thead><tbody>
              {Sv.per.map((x) => <tr key={x.name}><td>{x.name}</td><td>{money(x.t)}</td><td>{money(x.r)}</td><td>{money(x.match)}</td></tr>)}
              {F.brok > 0 ? <tr><td>Household brokerage</td><td /><td /><td /></tr> : null}</tbody></table>
            {F.brok > 0 ? <p className="rp-small">Plus {money(F.brok)} per month into the household&apos;s brokerage account.</p> : null}</> : null}</div>
        <div><Sec>By tax treatment, per month</Sec>
          <Side><div className="rp-fig">{money(F.trad + F.match)}</div>traditional: taxed when it comes out.
            <h5 className="gap">{money(F.roth)}</h5>Roth and HSA: no tax on the way out.
            {F.brok > 0 ? <><h5 className="gap">{money(F.brok)}</h5>brokerage: gains taxed when sold.</> : null}
            <p className="rp-small">Traditional includes the match, which is always pre-tax.</p></Side></div>
      </div>
      {ys.length > 1 ? <div className="rp-wide">
        <div><Sec>Saving each month, year by year to {M.retire}</Sec>
          <AgeStack rows={ys} h={230} parts={[{ f: (r) => r.t, color: C.forest }, { f: (r) => r.r, color: C.woods }, { f: (r) => r.b, color: C.sand }]} />
          <div className="rp-key"><span><i style={{ "--sw": C.forest } as React.CSSProperties} />Traditional</span><span><i style={{ "--sw": C.woods } as React.CSSProperties} />Roth and HSA</span><span><i style={{ "--sw": C.sand } as React.CSSProperties} />Brokerage</span></div>
          {peak - lowY > 50 ? <p className="rp-small">From {money(lowY)} to {money(peak)} per month as lines grow{M.family ? ", children's costs come and go" : ""}{M.changes ? " and your changes ahead apply" : ""}.</p> : null}</div>
        <div><Sec>Savings at {M.retire}, by account</Sec>
          <Climb pts={Sv.path} w={300} h={170} />
          <div className="rp-g3 tight">{([["Traditional", A.trad], ["Roth", A.roth], ["Brokerage", A.brok]] as [string, number][]).map(([k, v]) => <Side key={k}><div className="rp-fig sm">{axis(v)}</div>{k}{tot > 0 ? ", " + pctStr(v / tot, 0) : ""}</Side>)}</div></div>
      </div> : null}
    </Sheet>
  );
}

/* ---------- your home ---------- */
function Home({ M, p }: { M: M_; p: PageInfo }) {
  const Hm = M.home!;
  if (!Hm.own) {
    return (
      <Sheet M={M} p={p}>
        <Lead h={<>{money(Hm.rent + Hm.ins)} per month to rent{Hm.ins > 0 ? ", insurance included" : ""}.</>}>
          Rent is part of your budget, and the plan carries it into retirement with the rest of your spending, rising with prices. Renting leaves the savings that a down payment would take invested, and no mortgage to pay off before you retire.
        </Lead>
        <div className="rp-g3 gap">
          <Fig v={money(Hm.rent)}>rent per month</Fig>
          <Fig v={money(Hm.ins)}>renter&apos;s insurance per month</Fig>
          <Fig v={money((Hm.rent + Hm.ins) * 12)}>per year, {M.spend.month > 0 ? pctStr((Hm.rent + Hm.ins) / M.spend.month, 0) + " of your spending" : ""}</Fig>
        </div>
        <Sec>Thinking of buying?</Sec>
        <p className="rp-body">The Rent vs. Buy calculator on the Dashboard&apos;s Home tab starts from your rent and compares the two over the years you&apos;d stay: the down payment&apos;s lost growth, interest, taxes, upkeep and the home&apos;s own growth.</p>
      </Sheet>
    );
  }
  const Mg = Hm.M, c = Hm.costs, own = c ? c.tax + c.ins + c.pmi + c.hoa + c.maint + c.util : 0;
  const payoff = Mg.payoff != null ? Math.floor(Mg.payoff) : null, payoffAge = payoff != null ? payoff - (M.yearOf(0)) : null;
  return (
    <Sheet M={M} p={p}>
      <Lead h={<>{money(Hm.equity)} of your home is yours: worth {money(Hm.value)}{Hm.owed > 0 ? <>, {money(Hm.owed)} left to pay</> : <>, owned outright</>}.</>}>
        {Hm.owed > 0 && Mg.pay ? <>At {money(Mg.pay)} per month{Mg.rate != null ? <> and {pctStr(Mg.rate, 2)}</> : null}, the mortgage is paid off {payoff != null ? <>in <b>{payoff}</b>{payoffAge != null ? <>, when {M.who.first === "you" ? "you're" : M.who.first + " is"} {payoffAge}</> : null}{payoffAge == null ? "" : payoffAge < M.retire ? ", before retirement" : payoffAge === M.retire ? ", the year of retirement" : ", after retirement"}</> : "once the payment covers its interest"}. </>
          : Hm.owed > 0 ? <>Add the mortgage&apos;s rate and payment on the Dashboard&apos;s Home tab to see when it&apos;s paid off. </> : null}
        The home counts in your net worth but not in the savings the plan draws from in retirement.
      </Lead>
      {Hm.owed > 0 && Hm.bal.length > 1 ? <div className="rp-wide gap">
        <div><Sec>What&apos;s owed each year, at today&apos;s payment</Sec><OwedBars bal={Hm.bal} /></div>
        <div><Sec>The mortgage</Sec>
          <Side><div className="rp-fig">{payoff ?? "–"}</div>{payoff != null ? "the year it's paid off" : "no payoff year yet"}
            {Mg.interest != null ? <><h5 className="gap">{money(Mg.interest)}</h5>of interest still to pay</> : null}
            {Hm.drop ? <><h5 className="gap">{money(Hm.drop.monthly)} per month</h5>comes off retirement spending once it&apos;s paid{M.pr.retSpend == null ? " (the plan does this for you)" : ", if you lower your goal on Profile"}.</> : null}</Side></div>
      </div> : null}
      <Sec>What owning costs per month</Sec>
      {c ? <table className="rp-t"><thead><tr><th>Cost</th><th>Per month</th><th>Per year</th></tr></thead><tbody>
        {Mg.pay ? <tr><td>Mortgage payment</td><td>{money(Mg.pay)}</td><td>{money(Mg.pay * 12)}</td></tr> : null}
        {([["Property tax", c.tax], ["Home insurance", c.ins], ["Mortgage insurance (PMI)", c.pmi], ["HOA", c.hoa], ["Maintenance", c.maint], ["Utilities", c.util]] as [string, number][])
          .filter(([, v]) => v > 0).map(([k, v]) => <tr key={k}><td>{k}</td><td>{money(v)}</td><td>{money(v * 12)}</td></tr>)}
        <tr className="tot"><td>All of it</td><td>{money(own + (Mg.pay ?? 0))}</td><td>{money((own + (Mg.pay ?? 0)) * 12)}</td></tr></tbody></table>
        : <p className="rp-body">Set what owning costs (property tax, insurance, upkeep, utilities) in the Mortgage Calculator on the Dashboard&apos;s Home tab, and those lines join your budget and this page.</p>}
      {Hm.bal.length > 2 ? <><Sec>The loan, year by year</Sec>
        <div className="rp-cols2">{[0, 1].map((half) => { const yrsL = Hm.bal.slice(0, -1), n = Math.ceil(yrsL.length / 2), part = yrsL.slice(half * n, (half + 1) * n);
          return part.length ? <table key={half} className="rp-t"><thead><tr><th>Year</th><th>Owed at the start</th><th>Interest</th><th>Paid down</th></tr></thead>
            <tbody>{part.map((b) => <tr key={b.year}><td>{Math.floor(b.year)}</td><td>{money(b.owed)}</td><td>{money(b.interest)}</td><td>{money(b.principal)}</td></tr>)}</tbody></table> : null; })}</div></> : null}
    </Sheet>
  );
}

/* ---------- children ---------- */
function Family({ M, p }: { M: M_; p: PageInfo }) {
  const Fm = M.family!, now = M.year0, y1 = M.yearOf(M.end);
  const people2 = [M.pr.p1, ...(M.who.two ? [M.pr.p2] : [])];
  type Span = { from: number; to: number; color: string; label?: string; hatch?: boolean };
  const lanes: { name: string; spans: Span[]; marks?: { at: number; label: string }[] }[] = [
    ...people2.map((x, i) => ({ name: i ? M.who.Second : M.who.First, spans: x.by && x.retire ? [{ from: now, to: x.by + x.retire, color: C.forest, label: "Working" }, { from: x.by + x.retire, to: y1, color: C.water, label: "Retired" }] : [] })),
    ...Fm.kids.map((k, i) => {
      const born = k.by ?? now + k.bornIn, spans: Span[] = [];
      if (Fm.childcare && born + 5 > now) spans.push({ from: born, to: born + 5, color: kidColor(i), label: "Childcare" });
      spans.push({ from: Math.max(born + (Fm.childcare ? 5 : 0), born), to: born + 18, color: C.woodsLight, label: "At home" });
      if (k.college) spans.push({ from: k.college.from, to: k.college.from + k.college.years, color: kidColor(i), label: "College", hatch: k.college.from + k.college.years > M.yearOf(M.retire) });
      return { name: k.name, spans, marks: k.planned ? [{ at: born, label: "Born" }] : [] };
    }),
  ];
  const last = Math.max(now + 25, ...lanes.flatMap((l) => l.spans.map((s) => s.to)).filter((t) => t < y1 + 1));
  const helpWord = Fm.help === "all" ? "all of college" : Fm.help === "part" ? "part of college" : "no college costs";
  return (
    <Sheet M={M} p={p}>
      <Lead h={<>{cap(num(Fm.kids.length))} {Fm.kids.length === 1 ? "child" : "children"} in the plan{Fm.kids.some((k) => k.planned) ? ", some still to come" : ""}, and {helpWord} from you.</>}>
        Children you have now are already in today&apos;s spending. What changes as they grow (childcare, the teen years, the day they leave home) comes out of your saving in the years it happens, so the plan&apos;s saving moves with them.
        {Fm.need > 0 ? <> College takes <b>{money(Fm.need)}</b> per month saved ahead; you set aside {money(Fm.saving)} now.</> : null}
      </Lead>
      <Sec>Your household along the years</Sec>
      <Lanes lanes={lanes} from={now} to={Math.min(last + 2, y1)} now={now} />
      <div className="rp-key"><span><i style={{ "--sw": C.forest } as React.CSSProperties} />Working</span><span><i style={{ "--sw": C.water } as React.CSSProperties} />Retired</span><span><i style={{ "--sw": C.woodsLight } as React.CSSProperties} />At home</span>
        {Fm.childcare ? <span><i style={{ "--sw": kidColor(0) } as React.CSSProperties} />Childcare and college</span> : <span><i style={{ "--sw": kidColor(0) } as React.CSSProperties} />College</span>}
        {lanes.some((l) => l.spans.some((s) => s.hatch)) ? <span><i className="hatch" />College after you retire</span> : null}</div>
      <Sec>Each child</Sec>
      <table className="rp-t"><thead><tr><th>Child</th><th>Born</th><th className="l">Today</th><th>College</th><th>Per year of college</th></tr></thead><tbody>
        {Fm.kids.map((k, i) => <tr key={i}><td>{k.name}</td><td>{k.by ?? "About " + (now + k.bornIn)}</td><td className="l">{k.planned ? "Planned" : "Age " + k.age}</td>
          <td>{k.college ? k.college.from + " to " + (k.college.from + k.college.years) : "–"}</td><td>{k.college ? money(k.college.cost) : "–"}</td></tr>)}</tbody></table>
      {Fm.kids.some((k) => k.college) ? <div className="rp-g3 gap">
        <Fig v={rounded(Fm.kids.reduce((t, k) => t + (k.college ? k.college.cost * k.college.years : 0), 0))}>of college from you, in today&apos;s dollars</Fig>
        <Fig v={money(Fm.need)}>per month to save ahead for it</Fig>
        <Fig v={money(Fm.saving)}>per month set aside today{Fm.saving >= Fm.need - 25 ? ": on pace" : ""}</Fig></div> : null}
      {Fm.sched && Fm.sched.length > 1 ? (() => { const shorts = Fm.sched.some((s) => (s.short ?? 0) > 0); return <><Sec>Saving through the stages, per month with the match</Sec>
        <table className="rp-t"><thead><tr><th>{M.who.axis}</th><th className="l">Stage</th><th>Saving per month</th>{shorts ? <th>Short of costs</th> : null}</tr></thead><tbody>
          {Fm.sched.slice(0, 10).map((s) => <tr key={s.from} className={s.monthly === 0 ? "hl" : undefined}><td>{s.from} to {s.to}</td><td className="l">{s.label}</td><td>{money(s.monthly)}</td>{shorts ? <td>{s.short ? money(s.short) : "–"}</td> : null}</tr>)}</tbody></table>
        {shorts || Fm.sched.some((s) => s.monthly === 0) ? <p className="rp-small">Shaded: saving paused, when the children cost more than you&apos;d save. The short column is what the budget has to find.</p> : null}</>; })() : null}
    </Sheet>
  );
}

/* ---------- changes ahead (the Calculator's scenarios) ---------- */
function Changes({ M, p }: { M: M_; p: PageInfo }) {
  const Ch = M.changes!, diff = Ch.without != null ? M.S.fv - Ch.without : null;
  return (
    <Sheet M={M} p={p}>
      <Lead h={<>{cap(num(Ch.list.length))} {Ch.list.length === 1 ? "change" : "changes"} ahead{diff != null ? <>, {diff >= 0 ? "adding" : "taking"} {rounded(Math.abs(diff))} {diff >= 0 ? "to" : "from"} your savings at {M.retire}</> : null}.</>}>
        From the Dashboard&apos;s Calculator. Each change is in the whole plan: savings at retirement, the chance of success and the score all count it. Turn one off in the Calculator to see the plan without it.
      </Lead>
      <Sec>The changes</Sec>
      <ol className="rp-poi plain">{Ch.list.map((c, i) => <li key={i}><span><b>{i + 1}. {c.name}.</b> {c.sentence}</span></li>)}</ol>
      <Sec>With and without them</Sec>
      <table className="rp-t"><thead><tr><th />{["Without the changes", "With them"].map((t) => <th key={t}>{t}</th>)}</tr></thead><tbody>
        <tr><td>Savings at {M.retire}</td><td>{Ch.without != null ? money(Ch.without) : "–"}</td><td>{money(M.S.fv)}</td></tr>
        <tr><td>Past retirements that lasted</td><td>{Ch.success != null ? pct(Ch.success) : "–"}</td><td>{pct(M.R.success ?? 0)}</td></tr></tbody></table>
      {Ch.path.length > 1 ? <div className="rp-g2">
        <div><Sec>Savings to {M.retire}, by {M.who.axisIn}</Sec>
          <Lines series={[{ pts: Ch.path0, color: C.gray, dash: true }, { pts: Ch.path, color: C.trail }]} w={330} h={220} />
          <div className="rp-key"><span><i className="line" style={{ "--sw": C.trail } as React.CSSProperties} />With the changes</span><span><i className="dash" style={{ "--sw": C.gray } as React.CSSProperties} />Without</span></div></div>
        <div><Sec>Saving each month, with the match</Sec>
          <Lines series={[{ pts: Ch.saving.map((x) => ({ age: x.age, v: x.v0 })), color: C.gray, dash: true, label: false }, { pts: Ch.saving.map((x) => ({ age: x.age, v: x.v })), color: C.forest, label: false }]} w={330} h={220} fmt={money} />
          <div className="rp-key"><span><i className="line" style={{ "--sw": C.forest } as React.CSSProperties} />With the changes</span><span><i className="dash" style={{ "--sw": C.gray } as React.CSSProperties} />Without</span></div>
          <p className="rp-small">A lump sum isn&apos;t saving, so it shows as a step in the savings, not here.</p></div>
      </div> : null}
    </Sheet>
  );
}

/* ---------- the road from here ---------- */
function Road({ M, p }: { M: M_; p: PageInfo }) {
  const saveYears = M.retire - M.age0, gap = M.firstClaim - M.retire, r0 = M.rows[0];
  const ssRow = M.rows.find((r) => r.age >= Math.max(M.firstClaim, M.claim2 ?? 0)), cover = ssRow ? ssRow.ss / Math.max(1, ssRow.spend) : 0;
  const fromSavings = r0.trad + r0.roth + r0.brok, surplus = M.rows.some((r) => r.surplus > 1), work = M.rows.some((r) => (r.work ?? 0) > 0);
  return (
    <Sheet M={M} p={p}>
      <Lead h={<>{cap(yrs(saveYears))} more of saving, then {yrs(M.rows.length)} of retirement.</>}>
        {M.abroad ? <>Savings carry the whole retirement here: the plan counts no Social Security outside the US. </>
          : gap > 0 ? <>The steep part of the trail is the {yrs(gap)} from retiring to Social Security. Savings carry everything then: the spending, the tax{M.retire < 65 ? " and health insurance until Medicare" : ""}. </>
            : <>Social Security starts as you retire, so savings only fill the gap from the first year. </>}
        {cover > 0 ? <>From {Math.max(M.firstClaim, M.claim2 ?? 0)}, Social Security covers {cover >= 0.95 ? "nearly all" : cover >= 0.6 ? "most" : pctStr(cover, 0)} of what you spend.</> : null}
        {work ? <> {cap(M.who.second)} keeps working for a while after {M.who.first === "you" ? "you retire" : M.who.first + " retires"}, and that pay comes first.</> : null}
      </Lead>
      <Sec>The trail, by {M.who.axisIn}</Sec>
      <div className="rp-landbox"><Trail M={M} />
        <div className="rp-key">{M.phases.filter((x, i, all) => all.findIndex((y) => y.id === x.id) === i).map((x) => <span key={x.id}><i style={{ "--sw": PHASE_COLOR[x.id] } as React.CSSProperties} />{x.name}</span>)}</div></div>
      <div className="rp-wide">
        <div><Sec>Each year of retirement, by where the money comes from</Sec><IncomeBars M={M} h={270} /><IncomeKey M={M} /></div>
        <div><Sec>Year one, at {M.retire}</Sec>
          <Side><div className="rp-fig">{money(fromSavings)}</div>comes out of your savings: {money(Math.max(0, r0.spend - r0.ss - r0.pension - (r0.work ?? 0)))} toward spending{!M.abroad ? ", " + money(r0.tax + r0.irmaa) + " in tax" : ""}{r0.health > 0 ? " and " + money(r0.health) + " for health insurance" : ""}.
            {surplus ? <><h5 className="gap">From {M.rmdAge}</h5>Required withdrawals take out more than you spend. What&apos;s left after tax is reinvested in a brokerage account.</> : null}</Side></div>
      </div>
      <Sec>Points along the way</Sec>
      <Stops M={M} years cols />
    </Sheet>
  );
}

/* ---------- will it last? ---------- */
function Last({ M, p }: { M: M_; p: PageInfo }) {
  const Hs = M.hist, fails = M.runs.filter((r) => !r.ok), okRuns = M.runs.filter((r) => r.ok);
  const lows = (fails.length ? fails.slice().sort((x, y) => (x.outAge ?? 99) - (y.outAge ?? 99)) : okRuns.slice().sort((x, y) => x.low - y.low)).slice(0, Hs.adapts ? 3 : 5);
  const endAge = M.retire + Hs.years;
  const sp = Hs.spendBand, minSpend = sp.length ? Math.min(...sp.map((b) => b.lo)) : 0;
  return (
    <Sheet M={M} p={p} foot="Past returns don't predict future ones.">
      <Lead h={<>Every starting month from {Hs.first} to {Hs.lastStart}: it lasted in {Hs.ok === Hs.of ? <>all {fmtNum(Hs.of)}</> : <>{fmtNum(Hs.ok)} of {fmtNum(Hs.of)}</>}.</>}>
        The Retirement tab&apos;s simulator runs your savings at {M.retire} through what really happened to stocks, bonds and inflation from each month on, {Hs.strat ? <>drawing down with <b>{Hs.strat.name}</b>: {low(Hs.strat.blurb)}</> : <>spending a fixed amount that rises with prices, the way the 4% rule works.</>} The mix: {M.mixWords}.
      </Lead>
      <Sec>Savings each year of retirement, across history</Sec>
      <Fan M={M} h={Hs.adapts ? 170 : 230} />
      <div className="rp-key"><span><i className="line" style={{ "--sw": C.trail } as React.CSSProperties} />The middle of history</span><span><i style={{ "--sw": C.woods } as React.CSSProperties} />Half of retirements</span><span><i style={{ "--sw": C.woodsLight } as React.CSSProperties} />8 in 10</span></div>
      {Hs.adapts ? <div className="rp-wide">
        <div><Sec>Spending each year, across history</Sec><Fan M={M} spend w={430} h={150} />
          <div className="rp-key"><span><i className="line" style={{ "--sw": C.trail } as React.CSSProperties} />The middle</span><span><i style={{ "--sw": C.woodsLight } as React.CSSProperties} />8 in 10</span><span><i className="dash" style={{ "--sw": C.ink } as React.CSSProperties} />{money(Hs.firstSpend)} in year one</span></div></div>
        <div><Sec>Your strategy moves spending</Sec>
          <Side>{Hs.strat!.name} spends more after good years and less after bad ones, which is why it lasts more often. In the leanest tenth of history, spending fell to about <b>{money(minSpend)}</b> per year at its lowest, against {money(Hs.firstSpend)} in year one.</Side></div>
      </div> : null}
      <Sec>What was left at {endAge}, by the January retirement started</Sec>
      <HistoryBars M={M} h={Hs.adapts ? 140 : 200} />
      <div className="rp-key"><span><i style={{ "--sw": C.forest } as React.CSSProperties} />Left at the end</span>{okRuns.length ? <span><i style={{ "--sw": C.trail } as React.CSSProperties} />The least left, {M.worst.y}</span> : null}
        <span><i className="tick" />The lowest point along the way</span>{fails.length ? <span><i className="cross" />Ran out</span> : null}</div>
      <div className="rp-g2">
        <div className="rp-g2 tight gap"><Fig v={pct(M.R.success ?? 0)}>of starting months lasted to {endAge}</Fig>
          <Fig v={rounded(Hs.medianEnd)}>left at {endAge} in the middle of history</Fig></div>
        <div><table className="rp-t gap"><thead><tr><th>{fails.length ? "Ran out first" : "Lowest points"}</th>{fails.length ? <><th>Ran out at</th><th>Years it lasted</th></> : <><th>Lowest</th><th>At age</th><th>Left at {endAge}</th></>}</tr></thead><tbody>
          {lows.map((r) => <tr key={r.y}><td>Started {r.y}</td>{fails.length ? <><td>{r.outAge}</td><td>{(r.outAge ?? M.retire) - M.retire}</td></> : <><td>{money(r.low)}</td><td>{r.lowAge}</td><td>{money(r.end)}</td></>}</tr>)}</tbody></table></div>
      </div>
    </Sheet>
  );
}

/* ---------- getting to 59½ ---------- */
function Bridge({ M, p }: { M: M_; p: PageInfo }) {
  const B = M.bridge!, out = B.out.trad + B.out.roth + B.out.brok, E = B.early, years = E.years % 1 ? E.years.toFixed(1) : String(E.years);
  return (
    <Sheet M={M} p={p}>
      <Lead h={<>{years} years to bridge before 59½{B.plan ? <>, planned with {low(B.plan.plan)}</> : <>, not planned yet</>}.</>}>
        Money taken out of a 401(k) or IRA before 59½ usually costs a 10% penalty on top of income tax. {B.plan ? <>Your bridge plan from the Early Retirement Bridge, on the plan&apos;s own figures: {B.plan.phrase}.</>
          : <>The Early Retirement Bridge on the Dashboard&apos;s Retirement tab tries each way across: the brokerage first, Roth contributions, the rule of 55, 72(t) payments and a Roth ladder.{B.dock > 0 ? <> Until it&apos;s planned, {B.dock} {B.dock === 1 ? "point" : "points"} of the readiness score {B.dock === 1 ? "is" : "are"} held back.</> : null}</>}
      </Lead>
      {B.plan ? <div className="rp-g4 gap">
        <Fig v={pct(B.plan.hold)}>of past markets reached 59½</Fig>
        <Fig v={money(B.plan.tax + B.plan.pen + B.plan.health)}>taxes, penalties and health cover over the bridge</Fig>
        <Fig v={rounded(B.plan.left)}>left at 59½</Fig>
        <Fig v={money(B.plan.spend)}>spent per year on the way</Fig>
      </div> : null}
      <Sec>Your accounts at {M.retire}</Sec>
      <div className="rp-g3">
        <Side><h5>Traditional 401(k)s and IRAs</h5><div className="rp-fig">{rounded(B.at.trad)}</div>Penalty before 59½ unless the rule of 55, a 457(b) or 72(t) payments apply. Taxed as income.</Side>
        <Side><h5>Roth</h5><div className="rp-fig">{rounded(B.at.roth)}</div>{B.at.rothBasis > 0 ? <>About {rounded(Math.min(B.at.roth, B.at.rothBasis))} of it is what you put in, which comes out any time.</> : "What you put in comes out any time; growth waits for 59½."}</Side>
        <Side><h5>Brokerage</h5><div className="rp-fig">{rounded(B.at.brok)}</div>Comes out any time. Only the gains are taxed, at the lower capital-gains rates.</Side>
      </div>
      {B.rows.length ? <><Sec>Each year before 59½, by account, on the plan&apos;s steady path</Sec>
        <StackBars rows={B.rows} w={732} h={220} parts={[{ f: (r) => r.trad - r.pen, color: C.forest }, { f: (r) => r.roth, color: C.woods }, { f: (r) => r.brok, color: C.sand }, { f: (r) => r.pen, color: C.ember }]} />
        <div className="rp-key">{B.out.trad >= 100 ? <span><i style={{ "--sw": C.forest } as React.CSSProperties} />Traditional</span> : null}{B.out.roth >= 100 ? <span><i style={{ "--sw": C.woods } as React.CSSProperties} />Roth</span> : null}
          {B.out.brok >= 100 ? <span><i style={{ "--sw": C.sand } as React.CSSProperties} />Brokerage</span> : null}{B.pen > 1 ? <span><i style={{ "--sw": C.ember } as React.CSSProperties} />Penalty</span> : null}</div>
        <p className="rp-small">About {rounded(out)} comes out of savings before 59½{B.pen > 1 ? <>, {money(B.pen)} of it in penalties</> : ", with no penalty"}. The bridge plan can do better than this steady path: it picks the cheapest way across.</p></> : null}
    </Sheet>
  );
}

/* ---------- Social Security ---------- */
function Social({ M, p }: { M: M_; p: PageInfo }) {
  const Q = M.social!, two = Q.two, total = Q.a1 + Q.a2, ssRows = M.rows.filter((r) => r.age >= M.firstClaim);
  const ladderMax = Math.max(...Q.ladder1.map((x) => x.v), ...Q.ladder2.map((x) => x.v));
  const one = (n: 1 | 2) => {
    const name = n === 1 ? M.who.First : M.who.Second, a = n === 1 ? Q.a1 : Q.a2, pia = n === 1 ? Q.pia1 : Q.pia2, c = n === 1 ? Q.claim1 : Q.claim2, own = n === 1 ? Q.own1 : Q.own2, fra = n === 1 ? Q.fra1 : Q.fra2;
    return <div key={n}><Sec>{name === "You" ? "Your benefit" : name}</Sec>
      <div className="rp-g2 tight"><Fig v={<Est on={!own}>{money(a / 12)}</Est>}>per month, claiming at {c}</Fig>
        <Fig v={<Est on={!own}>{money(pia)}</Est>}>per month at full retirement age, {fraLabel(fra)}</Fig></div>
      <p className="rp-small">{own ? "From your Social Security statement." : Q.checked ? "From your pay history." : "Estimated from pay. Your statement at ssa.gov/myaccount has the real figure."}</p>
      <h6 className="rp-mini">Claiming at each age from 62 to 70</h6>
      <ClaimLadder list={n === 1 ? Q.ladder1 : Q.ladder2} pick={c} max={ladderMax} w={two ? 330 : 420} h={two ? 170 : 200} /></div>;
  };
  return (
    <Sheet M={M} p={p}>
      <Lead h={<>{money(total / 12)} per month{two ? " together" : ""}, {two ? (Q.claim1 === Q.claim2 ? "each claiming at " + Q.claim1 : "claiming at " + Q.claim1 + " and " + Q.claim2) : "claiming at " + Q.claim1}.</>}>
        {two ? <>Each of you gets a benefit from your own work record, or up to half the other&apos;s full benefit if that&apos;s more{Q.spousal ? ", which your plan uses" : ""}. </> : null}
        Claiming before full retirement age shrinks a benefit for life. Each year of waiting past it raises the benefit 8%, up to 70.{Q.pct < 100 ? <> The plan counts <b>{Q.pct}%</b> of every benefit, in case the trust fund runs short.</> : null}
      </Lead>
      {two ? <div className="rp-g2">{one(1)}{one(2)}</div> : <div className="rp-wide">{one(1)}<div><Sec>Why the age matters</Sec>
        <Side>Social Security is income that rises with prices for life, and the biggest check comes from waiting. Claiming at 62 pays the most years; claiming at 70 pays the most per month, which matters most if you live long.</Side></div></div>}
      <div className="rp-wide">
        <div><Sec>Social Security each year, by {M.who.axisIn}</Sec>
          <StackBars rows={ssRows} h={170} parts={[{ f: (r) => r.ss, color: C.water }]} line={two ? { f: (r) => (r.ss > 0 ? Q.survivor : 0), color: C.trail } : undefined} />
          <div className="rp-key"><span><i style={{ "--sw": C.water } as React.CSSProperties} />{two ? "Both of you" : "Your benefit"}, to {M.end}</span>{two ? <span><i className="dash" style={{ "--sw": C.trail } as React.CSSProperties} />What one of you keeps, alone</span> : null}</div></div>
        <div><Sec>{two ? "When one of you dies" : "What it covers"}</Sec>
          {two ? <Side><div className="rp-fig">{money(Q.survivor / 12)}</div>per month for the survivor: the larger of the two benefits carries on and the smaller one stops.
            <h5 className="gap">Why it matters</h5>The higher earner&apos;s claiming age sets the survivor&apos;s benefit too, which is why waiting often pays off for couples.</Side>
            : <Side><div className="rp-fig">{pctStr(Q.a1 / Math.max(1, M.S.spend), 0)}</div>of what the plan spends in a year, from the year you claim.</Side>}</div>
      </div>
    </Sheet>
  );
}

/* ---------- health cover before Medicare ---------- */
function Health({ M, p }: { M: M_; p: PageInfo }) {
  const Hh = M.health!, G = Hh.gap, r0 = M.rows[0], both = Math.max(65, M.med2 ?? 0);
  const firstAca = Hh.rows.find((r) => r.health - r.med > 0) ?? r0;
  const pre = Hh.rows.filter((r) => r.age < both), worst = pre.reduce((m, r) => (r.health > m.health ? r : m), pre[0] ?? r0), after = Hh.rows.find((r) => r.age >= both);
  return (
    <Sheet M={M} p={p}>
      <Lead h={<>{cap(yrs(G.years))} of health cover to buy, {G.from} to {G.to}: about {money(Hh.before)} in all.</>}>
        {M.who.two ? <>You both stop work by {G.from}. </> : <>You stop work in {G.from}. </>}{and(G.who.map((w) => (w.name === "You" ? "you reach" : w.name + " reaches") + " Medicare in " + w.medicare)).replace(/^./, (c) => c.toUpperCase())}.
        {" "}Until then, cover is a marketplace plan, and its subsidy depends on income: what you take out of your accounts. The withdrawal plan and the health bill move together.
      </Lead>
      <div className="rp-wide gap">
        <div><Sec>Health insurance each year, by {M.who.axisIn}</Sec>
          <YearBars M={M} ages={(g) => g < both + 6} h={280} f={(r) => r.health} color={C.clay} stack={{ f: (r) => r.med, color: C.water }} />
          <div className="rp-key"><span><i style={{ "--sw": C.clay } as React.CSSProperties} />Marketplace, after the subsidy</span><span><i style={{ "--sw": C.water } as React.CSSProperties} />Medicare premiums</span></div></div>
        <div><Sec>The costly stretch</Sec>
          <Side><div className="rp-fig">{money(worst.health)}</div>per year at {worst.age}, the most of any year.
            {after ? <><h5 className="gap">From {both}</h5>{M.who.two ? "Both on Medicare" : "On Medicare"}: {money(after.health)} per year in premiums.</> : null}</Side></div>
      </div>
      <div className="rp-g3 gap">
        <Fig v={money(firstAca.health)}>in {M.yearOf(firstAca.age)}, the first year on the marketplace</Fig>
        {firstAca.fplPct != null ? <Fig v={pctStr(firstAca.fplPct, 0)}>of the poverty line: your income for the subsidy that year</Fig> : <Fig v={num(Hh.years)}>years the plan pays for marketplace cover</Fig>}
        <Fig v={money(Hh.avg)}>per year on average before Medicare</Fig>
      </div>
      <Sec>What you can do</Sec>
      <ol className="rp-poi plain">
        <li><span><b>Get real quotes a year before you retire.</b> The figures here are estimates after the subsidy. Real prices depend on your county and the plan you pick.</span></li>
        <li><span><b>Watch your income in these years.</b> Taking more out of traditional accounts, or converting to Roth, raises income and shrinks the subsidy. Health cover on the Retirement tab shows the trade.</span></li>
        {G.who.length > 1 ? <li><span><b>Plan for the years one of you is on Medicare and the other isn&apos;t.</b> The household subsidy changes when the first of you moves to Medicare.</span></li> : null}
      </ol>
    </Sheet>
  );
}

/* ---------- where the money comes from ---------- */
function Money({ M, p }: { M: M_; p: PageInfo }) {
  const tin = M.money.in.reduce((t, x) => t + x[1], 0), ss = M.money.in[0][1], surplus = M.money.out.find((x) => x[2] === "surplus")![1];
  const afterRmd = M.money.tax > 0 ? M.money.taxAfterRmd / M.money.tax : 0;
  return (
    <Sheet M={M} p={p}>
      <Lead h={<>Over {yrs(M.rows.length)}, {rounded(tin)} comes in.{ss > 0 ? <> Social Security is {pctStr(ss / Math.max(1, tin), 0)} of it.</> : null}</>}>
        Withdrawals from traditional accounts are taxed as income, Roth withdrawals aren&apos;t, and brokerage withdrawals are taxed only on their gains. The order the plan draws them in is brokerage, then traditional, then Roth.
        {surplus > 1 ? <> Required withdrawals from {M.rmdAge} pull out more than you spend. After tax the rest is reinvested.</> : null}
      </Lead>
      <Sec>Every dollar of retirement, in and out</Sec>
      <LifetimeBars M={M} />
      <div className="rp-key"><b>In</b>{M.money.in.filter((x) => x[1] >= 500).map(([t, v, k]) => <span key={k}><i style={{ "--sw": SOURCE_COLOR[k] } as React.CSSProperties} />{t} {rounded(v)}</span>)}</div>
      <div className="rp-key"><b>Out</b>{M.money.out.filter((x) => x[1] >= 500).map(([t, v, k]) => <span key={k}><i style={{ "--sw": OUT_COLOR[k] } as React.CSSProperties} />{t} {rounded(v)}</span>)}</div>
      {!M.abroad ? <div className="rp-wide">
        <div><Sec>Income tax each year</Sec><YearBars M={M} f={(r) => r.tax + r.irmaa} color={C.trail} />
          <p className="rp-small">The Medicare surcharge, when there is one, is counted with the tax.</p></div>
        <div><Sec>Tax over the whole retirement</Sec>
          <Side><div className="rp-fig">{money(M.money.tax)}</div>on the plan&apos;s steady path, about {money(M.S.taxYr)} in a typical year.
            {afterRmd > 0.3 ? <><h5 className="gap">Where to look</h5>{pctStr(afterRmd, 0)} of it comes after {M.rmdAge}, from required withdrawals. Roth conversions in lower-tax years before then can move some of it earlier at a lower rate; the Retirement Plan Optimizer in Tools tests that.</> : null}</Side></div>
      </div> : null}
      <Sec>Each year of retirement, by source</Sec>
      <IncomeBars M={M} w={732} h={200} /><IncomeKey M={M} />
    </Sheet>
  );
}

/* ---------- readiness score ---------- */
const RATINGS: [number, number, string, string][] = [
  [85, 100, "On track", "The plan holds up well against history and the basics are in place."],
  [70, 84, "Nearly there", "A strong plan with one or two areas to finish."],
  [50, 69, "Getting there", "The foundations are there. The plan needs more saving or a later date."],
  [30, 49, "Needs work", "Several areas need attention before the plan holds up."],
  [0, 29, "Needs attention", "Start with the first step on the list: it does the most."],
];
function Score({ M, p }: { M: M_; p: PageInfo }) {
  const sc = M.score, missing = M.areas.filter((x) => !x.part), short = M.areas.filter((x) => x.part && x.part.p < 0.999);
  return (
    <Sheet M={M} p={p}>
      <Lead h={sc == null ? <>Not scored yet: it needs at least two of its five areas.</> : <>{sc} out of 100: {M.rating.label.toLowerCase()}{short.length ? <>, with {num(short.length)} {short.length === 1 ? "area" : "areas"} still to finish</> : null}.</>}>
        The readiness score adds up five areas, weighted by how much each matters. The retirement outlook, whether the plan lasts, counts most at 40 points. Emergency savings and debt are worth 15 each: they can derail a plan before it reaches retirement.
        {missing.length ? <> {cap(and(missing.map((x) => x.name.toLowerCase())))} {missing.length === 1 ? "isn't" : "aren't"} scored yet, so the score counts the rest.</> : null}
      </Lead>
      {sc != null ? <><Sec>Your {sc} points, area by area</Sec><ScoreBar M={{ factors: M.factors, R: M.Rg }} /></> : null}
      <div className="gap">{M.areas.map((x) => {
        const pts = x.part ? Math.round(x.part.p * x.w) : null;
        return <div key={x.id} className="rp-area wide"><div><h5>{x.name}</h5><div className="w">worth {x.w} points</div></div>
          <div className="txt">{x.why.why}{x.why.how.length && (x.part?.p ?? 0) < 0.999 ? <ul>{x.why.how.map((h, i) => <li key={i}>{h}.</li>)}</ul> : null}</div>
          <div className="pts">{pts != null ? <>{pts}<small> / {x.w}</small></> : <small>Not scored</small>}</div></div>;
      })}</div>
      <Sec>What the score means</Sec>
      <table className="rp-t"><thead><tr><th>Score</th><th className="l">Rating</th><th className="l">What it says</th></tr></thead><tbody>
        {RATINGS.map(([lo, hi, n, d]) => { const on = sc != null && sc >= lo && sc <= hi;
          return <tr key={n} className={on ? "hl" : undefined}><td>{hi >= 100 ? lo + " and up" : lo + " to " + hi}</td><td className="l"><b>{n}</b>{on ? <> &middot; yours, {sc}</> : null}</td><td className="l">{d}</td></tr>; })}
      </tbody></table>
    </Sheet>
  );
}

/* ---------- next steps ---------- */
function Next({ M, p }: { M: M_; p: PageInfo }) {
  const open = M.steps.filter((s) => !s.done), done = M.steps.filter((s) => s.done);
  const first = open.slice(0, 4), rest = open.slice(4, done.length > 6 ? 8 : 9), more = open.length - first.length - rest.length;
  return (
    <Sheet M={M} p={p}>
      <Lead h={open.length ? <>{cap(num(open.length))} {open.length === 1 ? "step" : "steps"} to take, the ones that do the most first.</> : <>Every step is done. Keep the plan current.</>}>
        Each step names the Dashboard tab where it&apos;s done. The ones that raise your readiness score the most come first; the rest sharpen the plan&apos;s figures.
      </Lead>
      {first.length ? <div className="rp-when gap"><div><h5>Start here</h5><div className="lbl">The steps that do the most</div></div>
        <div>{first.map((s, i) => <div key={s.id} className="rp-mv"><span className="rp-num">{i + 1}</span><div><h6>{s.title}</h6><p>{s.why}.</p><span className="rp-tool">On {tabOf(s.href)}</span></div></div>)}</div></div> : null}
      {rest.length ? <div className="rp-when"><div><h5>Then</h5><div className="lbl">Sharper figures</div></div>
        <div>{rest.map((s, i) => <div key={s.id} className="rp-mv"><span className="rp-num">{first.length + i + 1}</span><div><h6>{s.title}</h6><p>{s.why}.</p><span className="rp-tool">On {tabOf(s.href)}</span></div></div>)}</div></div> : null}
      {more > 0 ? <p className="rp-small">And {num(more)} more on the Dashboard&apos;s Next steps.</p> : null}
      {done.length ? <><Sec>Already done</Sec><ul className="rp-done">{done.map((s) => <li key={s.id}>{s.title}</li>)}</ul></> : null}
    </Sheet>
  );
}

/* ---------- assumptions and method ---------- */
function Sources({ M, p }: { M: M_; p: PageInfo }) {
  const pr = M.pr, st = STATE_OPTIONS.find((s) => s.code === pr.state)?.name, real = (1 + pr.assume.growth) / (1 + pr.assume.inflation) - 1;
  const rows: [string, React.ReactNode][] = [];
  const put = (k: string, v: React.ReactNode, on = true) => { if (on && v != null && v !== "") rows.push([k, v]); };
  put("Household", M.who.two ? "Couple, " + M.who.pair(M.age0) : "Single, " + M.age0);
  put("Children", M.family ? M.family.kids.map((k) => k.name + (k.planned ? " (planned)" : ", " + k.age)).join("; ") : "None");
  put("Where taxes are figured", M.abroad ? "Outside the US" : st ?? "Not given (Illinois used)");
  put("Retire", M.who.two ? M.who.First + " at " + pr.p1.retire + ", " + M.who.second + " at " + pr.p2.retire : "At " + pr.p1.retire);
  put("Growth before retirement", pctStr(pr.assume.growth, 1) + " per year, " + pctStr(real, 1) + " after inflation");
  put("Inflation", pctStr(pr.assume.inflation, 1) + " per year");
  put("Mix once retired", cap(M.mixWords));
  put("Withdrawal strategy", M.hist.strat ? M.hist.strat.name : "None chosen: a fixed amount");
  put("Years in retirement", M.hist.years + ", to " + (M.who.two ? "ages " + M.R.endAges.join(" and ") : "age " + (M.R.endAges[0] ?? M.end)));
  put("Social Security", M.abroad ? "None counted" : pr.ss.checked ? "Checked" + (pr.ss.own1 ? ", from a statement" : ", from pay history") : <Est on>Estimated from pay</Est>);
  put("Share of benefits counted", (pr.ss.pct ?? 100) + "%", !M.abroad);
  put("Balances", M.worth.accounts ? "By account, " + (M.worth.date ? longDate(M.worth.date) : "") : <Est on>Setup&apos;s one total, counted as a 401(k)</Est>);
  put("Spending", M.spend.detailed ? "From the budget" : "One number");
  return (
    <Sheet M={M} p={p} foot="Calculated in your browser. retcalc.app">
      <Lead h="What this plan is built on.">Everything on your Dashboard that feeds the figures, and how they&apos;re worked out. Change any of it on the Dashboard and print a new report. For an advisor: the method is on the right, and the plan&apos;s years follow.</Lead>
      <div className="rp-g2 top">
        <div><Sec>Your figures</Sec><Facts list={rows} /></div>
        <div><Sec>Method</Sec>
          <p className="rp-body sm"><b>Saving.</b> Today&apos;s balances grow at {pctStr(real, 2)} per year after inflation, account by account, with each saving line growing as you set it and stopping at its legal limit{M.family ? ", children's costs taken out in the years they come" : ""}{M.changes ? ", and your changes ahead applied" : ""}.</p>
          <p className="rp-body sm"><b>Retirement.</b> The Drawdown Simulator runs the savings at {M.retire} through every starting month since {M.hist.first} with {M.hist.years} years of history after it: {fmtNum(M.hist.of)} retirements{M.hist.strat ? ", with " + M.hist.strat.name : ", spending a fixed amount that rises with inflation"}. The share that lasted is the chance of success.</p>
          {!M.abroad ? <p className="rp-body sm"><b>Tax and health.</b> Each year&apos;s federal{st ? " and " + st : ""} income tax, the Medicare surcharge and marketplace premiums before 65 are worked out on the plan&apos;s steady path from where that year&apos;s money comes from, and paid on top of spending.</p> : null}
          <p className="rp-body sm"><b>Readiness.</b> Five areas: the retirement outlook (40 points), savings rate (20), emergency fund (15), debt (15) and cash flow (10).</p>
          <Sec>Fine print</Sec>
          <p className="rp-small">RetCalc is an educational tool, not financial, tax or legal advice. Past returns don&apos;t predict future ones. Tax rules are this year&apos;s, held in today&apos;s dollars. Everything was calculated in your browser.</p></div>
      </div>
      <Sec>Words used in this report</Sec>
      <dl className="rp-gloss">
        <div><dt>Today&apos;s dollars</dt><dd>Every future amount shrunk by inflation, so it means what it would buy now.</dd></div>
        <div><dt>Net worth</dt><dd>Everything you have, the home included, less everything you owe.</dd></div>
        <div><dt>Chance of success</dt><dd>The share of historical retirements, one per starting month, in which the money lasted to the plan&apos;s end.</dd></div>
        <div><dt>Steady path</dt><dd>The plan at its average return every year, used for the year-by-year tables and taxes.</dd></div>
        <div><dt>Required withdrawals</dt><dd>The minimum the IRS makes you take from traditional accounts each year from {M.rmdAge} (RMDs).</dd></div>
        <div><dt>Marketplace subsidy</dt><dd>The tax credit that lowers health insurance bought on healthcare.gov before Medicare; it shrinks as income rises.</dd></div>
      </dl>
    </Sheet>
  );
}

/* ---------- saving year by year ---------- */
function SaveYears({ M, p, part }: { M: M_; p: PageInfo; part: number }) {
  const all = M.save.years, list = all.slice(part * M.perSave, (part + 1) * M.perSave), lastPart = (part + 1) * M.perSave >= all.length, two = M.who.two;
  const short = all.some((y) => y.short > 0.5), d = (v: number) => (v >= 1 ? money(v) : "–");
  return (
    <Sheet M={M} p={p} foot="Per month figures include the employer match. Balances on the steady path.">
      {part === 0 ? <p className="rp-body sm">Each year to {M.retire} at a steady {pctStr((1 + M.pr.assume.growth) / (1 + M.pr.assume.inflation) - 1, 2)} after inflation: what goes in each month by account, and the savings at the year&apos;s end. Real years swing around it.</p> : null}
      <table className="rp-t yy dash"><thead><tr><th>Year</th><th>{two ? M.who.First : "Age"}</th>{two ? <th>{M.who.Second}</th> : null}<th>Traditional</th><th>Roth and HSA</th><th>Brokerage</th><th>Per month</th><th>Per year</th>{short ? <th>Budget short</th> : null}<th>Savings at year end</th></tr></thead>
        <tbody>{list.map((y) => { const k = y.age - M.age0, tot = y.t + y.r + y.b;
          return <tr key={y.age}><td>{M.yearOf(y.age)}</td><td>{y.age}</td>{two ? <td>{Math.round(y.age - (M.a.age! - (M.a.spouseAge ?? M.a.age!)))}</td> : null}
            <td>{d(y.t)}</td><td>{d(y.r)}</td><td>{d(y.b)}</td><td>{d(tot)}</td><td>{d(tot * 12)}</td>{short ? <td>{d(y.short)}</td> : null}<td>{money(M.S.path[k + 1] ?? M.S.fv)}</td></tr>; })}
          {lastPart ? <tr className="tot"><td>Total</td><td />{two ? <td /> : null}<td /><td /><td /><td /><td>{rounded(all.reduce((t, y) => t + (y.t + y.r + y.b) * 12, 0))}</td>{short ? <td /> : null}<td>{money(M.S.fv)}</td></tr> : null}</tbody></table>
    </Sheet>
  );
}

/* ---------- retirement year by year ---------- */
function Years({ M, p, part }: { M: M_; p: PageInfo; part: number }) {
  const rows = M.rows.slice(part * M.perYears, (part + 1) * M.perYears), lastPart = (part + 1) * M.perYears >= M.rows.length, two = M.who.two;
  const hl = new Set([M.retire, 65, M.firstClaim, M.claim2 ?? -1, M.rmdAge]), sum = (f: (r: M_["rows"][number]) => number) => M.rows.reduce((t, r) => t + f(r), 0);
  const d = (v: number) => (v >= 1 ? money(v) : "–"), tot = (f: (r: M_["rows"][number]) => number) => { const v = sum(f); return v >= 100 ? rounded(v) : "–"; };
  const work = M.rows.some((r) => (r.work ?? 0) > 0), pens = M.S.pension > 0;
  return (
    <Sheet M={M} p={p} foot="Shaded rows: retiring, Medicare, each Social Security claim, required withdrawals.">
      {part === 0 ? <p className="rp-body sm">Every year of retirement on the plan&apos;s steady path, the average return for your mix. Real years swing around it; page {pageOf(M, "last")} shows how far. Withdrawals cover spending, tax and health insurance.</p> : null}
      <table className="rp-t yy dash"><thead><tr><th>Year</th><th>{two ? M.who.First : "Age"}</th>{two ? <th>{M.who.Second}</th> : null}
        {work ? <th>Partner&apos;s pay</th> : null}{!M.abroad ? <th>Social Security</th> : null}{pens ? <th>Pension</th> : null}<th>Traditional</th><th>Roth / brokerage</th>{!M.abroad ? <th>Income tax</th> : null}<th>Health</th><th>Reinvested</th><th>Balance at year end</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.age} className={hl.has(r.age) ? "hl" : undefined}><td>{M.yearOf(r.age)}</td><td>{r.age}</td>{two ? <td>{Math.round(r.age - (M.a.age! - (M.a.spouseAge ?? M.a.age!)))}</td> : null}
          {work ? <td>{d(r.work ?? 0)}</td> : null}{!M.abroad ? <td>{d(r.ss)}</td> : null}{pens ? <td>{d(r.pension)}</td> : null}<td>{d(r.trad)}</td><td>{d(r.roth + r.brok)}</td>{!M.abroad ? <td>{d(r.tax + r.irmaa)}</td> : null}<td>{d(r.health)}</td><td>{d(r.surplus)}</td><td>{money(r.end)}</td></tr>)}
          {lastPart ? <tr className="tot"><td>Total</td><td />{two ? <td /> : null}{work ? <td>{tot((r) => r.work ?? 0)}</td> : null}{!M.abroad ? <td>{tot((r) => r.ss)}</td> : null}{pens ? <td>{tot((r) => r.pension)}</td> : null}<td>{tot((r) => r.trad)}</td>
            <td>{tot((r) => r.roth + r.brok)}</td>{!M.abroad ? <td>{tot((r) => r.tax + r.irmaa)}</td> : null}<td>{tot((r) => r.health)}</td><td>{tot((r) => r.surplus)}</td><td /></tr> : null}</tbody></table>
    </Sheet>
  );
}

/** Every page of the report, in order. */
export function DashPages({ M }: { M: M_ }) {
  return <>{M.pages.map((p, i) => {
    const part = M.pages.slice(0, i).filter((x) => x.id === p.id).length;
    switch (p.id) {
      case "cover": return <Cover key={p.n} M={M} />;
      case "stand": return <Stand key={p.n} M={M} p={p} />;
      case "worth": return <Worth key={p.n} M={M} p={p} />;
      case "income": return <Income key={p.n} M={M} p={p} />;
      case "spending": return <Spending key={p.n} M={M} p={p} />;
      case "saving": return <Saving key={p.n} M={M} p={p} />;
      case "home": return <Home key={p.n} M={M} p={p} />;
      case "family": return <Family key={p.n} M={M} p={p} />;
      case "changes": return <Changes key={p.n} M={M} p={p} />;
      case "road": return <Road key={p.n} M={M} p={p} />;
      case "last": return <Last key={p.n} M={M} p={p} />;
      case "bridge": return <Bridge key={p.n} M={M} p={p} />;
      case "social": return <Social key={p.n} M={M} p={p} />;
      case "health": return <Health key={p.n} M={M} p={p} />;
      case "money": return <Money key={p.n} M={M} p={p} />;
      case "score": return <Score key={p.n} M={M} p={p} />;
      case "next": return <Next key={p.n} M={M} p={p} />;
      case "sources": return <Sources key={p.n} M={M} p={p} />;
      case "saveyears": return <SaveYears key={p.n} M={M} p={p} part={part} />;
      case "years": return <Years key={p.n} M={M} p={p} part={part} />;
    }
  })}</>;
}
