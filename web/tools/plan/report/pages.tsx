/* The Paycheck to Retirement report's pages: the Guide report's system
   (black band, Public Sans, US Letter sheets, 17-report.css) telling this
   walkthrough's story in order: the cover, the paycheck, the spending, the
   saving, the road to retirement, the stages your changes ahead make (when there are any),
   and the assumptions behind it all. */

import { money, pctStr } from "@/lib/format";
import { C, ReportMark } from "@/tools/guide/report/charts";
import { CHILD_COST } from "@/tools/guide/schedule";
import { ageSpan } from "../kids";
import { COVER_ORDER } from "../model";
import { ACCT_NAMES, type Acct, type PlanSummary } from "../results";
import { ACCT_PRINT, ClimbChart, GroupBars, KidBars, PAY_PRINT, PayBar, StageStrip } from "./charts";

export interface PlanReport { S: PlanSummary; title: string; date: string }
interface Page { id: string; title: string; because?: string; n: number }

const Brand = () => <span className="rp-brand"><ReportMark />RetCalc</span>;
const Lead = ({ h, children }: { h: React.ReactNode; children: React.ReactNode }) => <div className="rp-lead"><h3>{h}</h3><p>{children}</p></div>;
const Sec = ({ children }: { children: React.ReactNode }) => <h4 className="rp-sech">{children}</h4>;
const ACCTS: Acct[] = ["trad", "roth", "brok", "hsa"];
const WORDS = ["None", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];
const used = (S: PlanSummary) => ACCTS.filter((a) => S.climb.some((r) => r[a] > 1));
const per = (S: PlanSummary) => (S.per === "check" ? "per paycheck" : "per month");

function Sheet({ R, p, children }: { R: PlanReport; p: Page; children: React.ReactNode }) {
  return (
    <section className="rp-page" aria-label={p.title}>
      <div className="rp-band slim"><div><h2>{p.title}</h2>{p.because ? <div className="rp-because">{p.because}</div> : null}</div>
        <div className="rp-band-r"><Brand /><span className="rp-pg">{p.n}</span></div></div>
      <div className="rp-in">{children}</div>
      <div className="rp-foot"><span>{R.title} · {R.date}</span><span>Figures for retirement are in today&apos;s dollars. Pay and spending are this year&apos;s.</span></div>
    </section>
  );
}

/* ---------- 1. cover ---------- */
function Cover({ R, pages }: { R: PlanReport; pages: Page[] }) {
  const S = R.S, A = S.atRetire, saved = (S.inflow.trad + S.inflow.roth + S.inflow.brok + S.inflow.hsa) * S.p;
  return (
    <section className="rp-page" aria-label="Cover">
      <div className="rp-band"><div><h1>{R.title}</h1><div className="rp-sub">Paycheck to Retirement · Calculated {R.date} · Retirement figures in today&apos;s dollars</div></div>
        <div className="rp-band-r col"><Brand /><span>The complete retirement<br />planning toolkit</span></div></div>
      <div className="rp-map"><ClimbChart S={S} h={S.stages ? 470 : 450} />
        <div className="rp-legend low"><h5>Your savings, age {S.age} to {S.retire}</h5>
          {ACCTS.filter((a) => S.climb.some((r) => r[a] > 1)).map((a) => <div key={a}><i style={{ "--sw": ACCT_PRINT[a] } as React.CSSProperties} />{ACCT_NAMES[a]}</div>)}
          <div><i className="line" style={{ "--sw": C.trail } as React.CSSProperties} />Everything together</div>
          {S.stages ? <div><span className="rp-num">1</span>Each stage, numbered</div> : null}</div></div>
      <div className="rp-cols">
        <div><h5>Your pay</h5><div className="rp-fig">{money(S.pay.takeHome * S.p)}</div>
          <p>per year reaches your bank from {money(S.pay.gross * S.p)} of pay: {money(S.pay.takeHome)} {per(S)}, after {money(S.pay.taxes * S.p)} in taxes and what goes into accounts before it.</p>
          <h5 className="gap">Contents</h5>
          <ol className="rp-toc">{pages.slice(1).filter((p) => !p.title.endsWith("continued")).map((p) => <li key={p.id}><b>{p.title}</b><span className="d" /><span className="pn">{p.n}</span></li>)}</ol></div>
        <div><h5>Your saving</h5><div className="rp-fig">{money(saved)}</div>
          <p>per year, {pctStr(saved / Math.max(1, S.pay.gross * S.p), 0)} of your pay{S.inflow.match > 0 ? ", " + money(S.inflow.match * S.p) + " of it your employer's match" : ""}.
            {S.pay.left > 0.5 ? " " + money(S.pay.left * S.p) + " per year is still unassigned." : " Every dollar of pay has a job."}</p>
          <h5 className="gap">Spending</h5><div className="rp-fig">{money(S.spendYear / 12)}</div><p>per month, from your budget.</p></div>
        <div><h5>At {S.retire}</h5><div className="rp-fig">{money(A.total)}</div>
          <p>in today&apos;s dollars ({money(A.fv)} in future dollars){S.stages ? ", with your changes ahead" : ""}.</p>
          <h5 className="gap">To spend in retirement</h5><div className="rp-fig">{money(A.afterTax)}</div>
          <p>per year after tax, from a {pctStr(A.withdrawal, 1)} withdrawal{S.goal.v > 0
            ? (A.afterTax >= S.goal.v ? ", more than " : ", against ") + (S.goal.fromBudget ? "the " + money(S.goal.v) + " your budget spends per year" : "your goal of " + money(S.goal.v)) + (A.afterTax >= S.goal.v ? "." : ": " + money(S.goal.v - A.afterTax) + " short.")
            : "."}</p></div>
      </div>
      <div className="rp-foot"><span>RetCalc · retcalc.app</span><span>An educational plan, not financial advice. Past returns don&apos;t predict future ones.</span></div>
    </section>
  );
}

/* ---------- 2. your paycheck ---------- */
function Paycheck({ R, p }: { R: PlanReport; p: Page }) {
  const S = R.S, y = S.pay, n = S.p;
  const rows: [string, number][] = [["Gross pay", y.gross], ["Federal income tax", y.fed], [(y.stateName || "State") + " income tax", y.state], ["Social Security and Medicare", y.fica],
    ...(y.health > 0.004 ? [["Health premiums, through work", y.health] as [string, number]] : []), ...(y.preSave > 0.004 ? [["Pre-tax saving (401(k), HSA)", y.preSave] as [string, number]] : []),
    ["Reaches your bank", y.takeHome]];
  return (
    <Sheet R={R} p={p}>
      <Lead h={<>Of {money(y.gross * n)} per year, {money(y.takeHome * n)} reaches your bank.</>}>
        Taxes take {money(y.taxes * n)}, {pctStr(y.taxes / Math.max(1, y.gross), 1)} of your pay. {y.preSave > 0.004 ? money(y.preSave * n) + " goes into accounts before tax, which is why it costs your paycheck less than it saves. " : ""}
        Everything here is {S.facts.taxYear}&apos;s federal and {y.stateName || "state"} rules, {S.facts.status.toLowerCase()}, paid {S.facts.freqName.toLowerCase()}.
      </Lead>
      <Sec>Every dollar of a year&apos;s pay</Sec>
      <PayBar S={S} />
      <div className="rp-key"><span><i style={{ "--sw": PAY_PRINT.taxes } as React.CSSProperties} />Taxes</span>{y.health > 0.004 ? <span><i style={{ "--sw": PAY_PRINT.health } as React.CSSProperties} />Health premiums</span> : null}
        <span><i style={{ "--sw": PAY_PRINT.spend } as React.CSSProperties} />Spending</span><span><i style={{ "--sw": PAY_PRINT.save } as React.CSSProperties} />Saving and investing</span>{y.left > 0.5 ? <span><i style={{ "--sw": PAY_PRINT.left } as React.CSSProperties} />Unassigned</span> : null}</div>
      <Sec>From gross pay to the bank</Sec>
      <table className="rp-t"><thead><tr><th>&nbsp;</th><th>{S.per === "check" ? "Per paycheck" : "Per month"}</th>{S.per === "check" ? <th>Per month</th> : null}<th>Per year</th><th>Share of pay</th></tr></thead>
        <tbody>{rows.map(([k, v], i) => (
          <tr key={k} className={i === 0 || i === rows.length - 1 ? "tot" : undefined}><td>{k}</td><td>{money(v, 2)}</td>{S.per === "check" ? <td>{money((v * n) / 12)}</td> : null}<td>{money(v * n)}</td><td>{pctStr(v / Math.max(1, y.gross), 1)}</td></tr>
        ))}</tbody></table>
      <div className="rp-g3 gap">
        <div className="rp-side"><h5>Effective tax rate</h5><div className="rp-fig sm">{pctStr(y.taxes / Math.max(1, y.gross), 1)}</div><p className="rp-body">of gross pay: federal, state, Social Security and Medicare.</p></div>
        <div className="rp-side"><h5>{S.per === "check" ? "Each paycheck" : "Each month"}</h5><div className="rp-fig sm">{money(y.takeHome, 2)}</div><p className="rp-body">{S.per === "check" ? "deposited, " + S.facts.freqName.toLowerCase() + "." : "deposited per month, both paychecks together."}</p></div>
        <div className="rp-side"><h5>Your employer adds</h5><div className="rp-fig sm">{money(y.match * n)}</div><p className="rp-body">{y.match > 0 ? "per year in 401(k) match, on top of your pay." : "Nothing yet: no match on what goes in."}</p></div>
      </div>
    </Sheet>
  );
}

/* ---------- 3. your spending ---------- */
type SpendRow = { kind: "group" | "line" | "total"; label: string; mo: number; yr: number };
/** The spending table's rows, split into pages: the first page shares its
    column with the bars by group, later ones ("continued") have it all. */
export function spendChunks(S: PlanSummary): SpendRow[][] {
  const rows: SpendRow[] = [];
  for (const g of [...new Set(S.budgetLines.map((l) => l.group))]) {
    const ls = S.budgetLines.filter((l) => l.group === g), yr = ls.reduce((t, l) => t + l.yr, 0);
    rows.push({ kind: "group", label: g, mo: yr / 12, yr });
    for (const l of ls) rows.push({ kind: "line", label: l.desc + (l.freq === 1 ? " (yearly)" : ""), mo: l.yr / 12, yr: l.yr });
  }
  rows.push({ kind: "total", label: "Total", mo: S.spendYear / 12, yr: S.spendYear });
  const groups = new Set(S.budgetLines.map((l) => l.group)).size;
  // Rows of about 26.5px in a body of about 870px, less the lead, the bars and the headings.
  // Under the lead and the bars by group (beside the emergency fund), the table runs the full width.
  const first = Math.max(6, Math.floor((870 - 110 - Math.max(groups * 26 + 50, 240) - 70) / 26.5)), more = Math.floor((870 - 90) / 26.5);
  const out: SpendRow[][] = [rows.slice(0, first)];
  for (let i = first; i < rows.length; i += more) out.push(rows.slice(i, i + more));
  return out;
}
function SpendTable({ rows }: { rows: SpendRow[] }) {
  return (
    <table className="rp-t"><thead><tr><th>Line</th><th>Per month</th><th>Per year</th></tr></thead>
      <tbody>{rows.map((r, i) => (
        <tr key={i} className={r.kind === "group" ? "hl" : r.kind === "total" ? "tot" : undefined}>
          <td className={r.kind === "line" ? "l" : undefined}>{r.kind === "group" ? <b>{r.label}</b> : r.label}</td><td>{money(r.mo)}</td><td>{money(r.yr)}</td></tr>
      ))}</tbody></table>
  );
}
function Spending({ R, p, rows, part }: { R: PlanReport; p: Page; rows: SpendRow[]; part: number }) {
  const S = R.S;
  if (part > 0) return <Sheet R={R} p={p}><Sec>Every line, continued</Sec><SpendTable rows={rows} /></Sheet>;
  return (
    <Sheet R={R} p={p}>
      <Lead h={<>You spend {money(S.spendYear / 12)} per month.</>}>
        That&apos;s {money(S.spendYear)} per year, {pctStr(S.spendYear / Math.max(1, S.pay.gross * S.p), 0)} of your gross pay. Yearly bills are spread over the year.
        {" "}An emergency fund of {S.ef.months} months of it comes to {money(S.ef.target)}.
      </Lead>
      <div className="rp-wide gap">
        <div><Sec>By group, per month</Sec><GroupBars S={S} /></div>
        <div className="rp-side self-start"><h5>Emergency fund</h5><div className="rp-fig sm">{money(S.ef.target)}</div>
          <p>{S.ef.months} months of spending, in cash, before investing past the match. {S.inflow.ef > 0 ? "Your paycheck puts " + money(S.inflow.ef, 2) + " " + per(S) + " toward it." : ""}</p>
          <h5 className="gap">What&apos;s left</h5><p>After taxes and spending, {money((S.lines.reduce((t, l) => t + l.v, 0) + Math.max(0, S.pay.left)) * S.p)} per year is yours to save. The next section is where it goes.</p></div>
      </div>
      <Sec>Every line</Sec><SpendTable rows={rows} />
      {spendChunks(S).length > 1 ? <p className="rp-body mt-1.5">Continued on the next page.</p> : null}
    </Sheet>
  );
}

/* ---------- 4. your saving ---------- */
function Saving({ R, p }: { R: PlanReport; p: Page }) {
  const S = R.S, n = S.p, shown = ACCTS.filter((a) => S.inflow[a] > 0.004 || (S.atRetire.byAcct?.[a] ?? 0) > 1);
  const kind = (l: PlanSummary["lines"][number]) => (l.id === "hsa" ? "HSA, pre-tax" : l.id === "brok" ? "Taxable" : l.id === "ef" ? "Cash" : l.roth ? "Roth" : "Traditional, pre-tax");
  const total = S.lines.reduce((t, l) => t + l.v, 0);
  return (
    <Sheet R={R} p={p}>
      <Lead h={<>{money(total * n)} per year goes to work, {money(total, 2)} {per(S)}.</>}>
        In order: {S.lines.map((l) => l.name).join(", ")}.
        {S.inflow.match > 0 ? " Your employer's " + money(S.inflow.match * n) + " per year lands in the traditional 401(k) on top." : ""}
      </Lead>
      <Sec>Each line on your paycheck</Sec>
      <table className="rp-t"><thead><tr><th>Line</th><th className="l">Kind</th><th>{S.per === "check" ? "Per paycheck" : "Per month"}</th><th>Per year</th></tr></thead>
        <tbody>{S.lines.map((l) => <tr key={l.id}><td>{l.name}</td><td className="l">{kind(l)}</td><td>{money(l.v, 2)}</td><td>{money(l.v * n)}</td></tr>)}
          {S.inflow.match > 0 ? <tr><td>Employer match</td><td className="l">Traditional</td><td>{money(S.inflow.match, 2)}</td><td>{money(S.inflow.match * n)}</td></tr> : null}
          <tr className="tot"><td>Total</td><td></td><td>{money(total + S.inflow.match, 2)}</td><td>{money((total + S.inflow.match) * n)}</td></tr></tbody></table>
      <Sec>Each account, now and at {S.retire}</Sec>
      <div className={shown.length > 3 ? "rp-g2 tight" : "rp-g3 tight"}>
        {shown.map((a) => (
          <div key={a} className="rp-side"><h5><i className="mr-1.5 inline-block size-2.75 align-baseline bg-(--sw)" style={{ "--sw": ACCT_PRINT[a] } as React.CSSProperties} />{ACCT_NAMES[a]}</h5>
            <div className="rp-fig sm">{money(S.atRetire.byAcct?.[a] ?? 0)}</div>
            <p className="rp-body">at {S.retire}, {pctStr((S.atRetire.byAcct?.[a] ?? 0) / Math.max(1, S.atRetire.total), 0)} of the total. Today {money(S.climb[0][a])}; {money(S.inflow[a] * n)} per year going in.</p></div>
        ))}
      </div>
    </Sheet>
  );
}

/* ---------- 5. the road to retirement ---------- */
function Road({ R, p }: { R: PlanReport; p: Page }) {
  const S = R.S, A = S.atRetire, a = S.assumptions;
  return (
    <Sheet R={R} p={p}>
      <Lead h={<>{money(A.total)} at {S.retire}, in today&apos;s dollars.</>}>
        {Math.round(S.years)} years of saving at {pctStr(a.nominal, 1)} per year before {pctStr(a.inflation, 1)} inflation{a.fees > 0 ? " and " + pctStr(a.fees, 2) + " in fees" : ""}.
        {" "}Withdrawing {pctStr(A.withdrawal, 1)} the first year gives {money(A.afterTax)} after tax{S.stages ? ", including the stages on page " + (p.n + 1) : ""}.
      </Lead>
      <Sec>Your savings by age, by account</Sec>
      <ClimbChart S={S} h={340} />
      <div className="rp-key">{ACCTS.filter((x) => S.climb.some((r) => r[x] > 1)).map((x) => <span key={x}><i style={{ "--sw": ACCT_PRINT[x] } as React.CSSProperties} />{ACCT_NAMES[x]}</span>)}
        <span><i className="line" style={{ "--sw": C.trail } as React.CSSProperties} />Total</span></div>
      <div className="rp-g3 gap">
        <div className="rp-side"><h5>In future dollars</h5><div className="rp-fig sm">{money(A.fv)}</div><p className="rp-body">What your statements will say at {S.retire}, before adjusting for inflation.</p></div>
        <div className="rp-side"><h5>To spend per year</h5><div className="rp-fig sm">{money(A.afterTax)}</div><p className="rp-body">After tax at about {pctStr(A.taxRate, 1)}, from a {pctStr(A.withdrawal, 1)} withdrawal, in today&apos;s dollars.</p></div>
        <div className="rp-side"><h5>Milestones</h5>
          <dl className="rp-facts">{S.milestones.map((m) => <div key={m.label}><dt>{m.label}</dt><dd>age {m.age}</dd></div>)}</dl></div>
      </div>
      <Sec>Every five years, in today&apos;s dollars</Sec>
      <table className="rp-t"><thead><tr><th>Age</th>{used(S).map((a) => <th key={a}>{ACCT_NAMES[a]}</th>)}<th>Total</th></tr></thead>
        <tbody>{S.climb.filter((r, i) => i % 5 === 0 || i === S.climb.length - 1).map((r) => (
          <tr key={r.age} className={r.age === S.retire ? "hl tot" : undefined}><td>{r.age}</td>{used(S).map((a) => <td key={a}>{money(r[a])}</td>)}<td><b>{money(r.total)}</b></td></tr>
        ))}</tbody></table>
    </Sheet>
  );
}

/* ---------- 6. life stages ---------- */
/** How many stages the first Life stages page lists; the rest, the
    children's picture and the notes go on a second page. */
const STAGE_ROWS = 9;
export const stagePages = (S: PlanSummary) => (S.stages && S.stages.length > STAGE_ROWS ? 2 : 1);
function Stages({ R, p, part }: { R: PlanReport; p: Page; part: number }) {
  const S = R.S, st = S.stages!, kids = S.kids.length, split = stagePages(S) > 1;
  const rows = split ? (part === 0 ? st.slice(0, 20) : st.slice(20)) : st, at0 = split && part > 0 ? 20 : 0;
  const NAME: Record<string, string> = { brok: "Brokerage", roth: "Roth", trad: "Traditional", hsa: "HSA" };
  const today = S.todayMonthly, now = today.brok + today.roth + today.trad + today.hsa;
  const table = (
    <table className="rp-t"><thead><tr><th>Stage</th><th>Ages</th><th>Children</th>{COVER_ORDER.map((k) => <th key={k}>{NAME[k]}</th>)}<th>From spending</th><th>Saved</th></tr></thead>
      <tbody>{rows.map((s, j) => (
        <tr key={s.from}><td><b>{at0 + j + 1}.</b> {s.name}</td><td>{ageSpan(s.from, s.to).replace(" to ", "–")}</td><td>{s.kidCost > 0 ? money(s.kidCost) : "–"}</td>
          {COVER_ORDER.map((k) => <td key={k}>{s.take && Math.abs(s.take[k]) > 0.5 ? (s.take[k] > 0 ? "−" : "+") + money(Math.abs(s.take[k])) : "–"}</td>)}
          <td>{s.short > 0 ? "−" + money(s.short) : "–"}</td><td><b>{money(s.monthly)}</b></td></tr>
      ))}</tbody></table>
  );
  // With many stages: the stages first, then the children and the notes on the next page.
  const head = part === 0;
  const tail = !split || part > 0;
  return (
    <Sheet R={R} p={p}>
      {head ? <>
      <Lead h={<>{WORDS[st.length] ?? st.length} stages{kids ? ", built around " + (kids === 1 ? "one child" : String(WORDS[kids] ?? kids).toLowerCase() + " children") : ""}.</>}>
        Today you save {money(now)} per month. Each stage below saves that, less what its children cost beyond today, taken from the brokerage first so the tax-advantaged accounts stay full.
        {st.some((s) => s.take && s.take.trad + s.take.hsa > 0.5) ? " A cut from a traditional account or the HSA is bigger than the cost it covers, since that money is taxed as pay again." : ""}
        {st.some((s) => s.short > 0) ? " Where saving can't cover it, the rest comes out of spending." : ""}
      </Lead>
      <Sec>Your stages, to scale</Sec>
      <StageStrip S={S} />
      <Sec>Stage by stage, per month in today&apos;s dollars</Sec>
      {table}
      {split ? <p className="rp-body mt-1.5">The children and the notes are on the next page.</p> : null}
      </> : null}
      {split && part > 0 && rows.length ? <><Sec>Stage by stage, continued</Sec>{table}</> : null}
      {tail && S.children ? <>
        <Sec>What the children cost per month, in today&apos;s dollars, by your age</Sec>
        <KidBars S={S} />
        <div className="rp-key"><span><i style={{ "--sw": C.clay } as React.CSSProperties} />Before school</span><span><i style={{ "--sw": C.sand } as React.CSSProperties} />At school</span>
          <span><i style={{ "--sw": C.water } as React.CSSProperties} />All of them together</span>
          <span>{money(S.children.total)} until {S.retire}; your balance at {S.retire} is {money(Math.max(0, S.children.without - S.atRetire.total))} lower than saving today&apos;s amounts all the way.</span></div>
      </> : null}
      {tail ? <div className="rp-g2 top gap">
        <div className="rp-side"><h5>What a child costs here</h5><p className="rp-body">Per month, unless you changed them: {money(CHILD_COST.noCare)} before school plus childcare where it&apos;s paid (about {money(CHILD_COST.care.suburb)} in a suburb, {money(CHILD_COST.care.city)} in a big city, {money(CHILD_COST.care.rural)} in rural areas), {money(CHILD_COST.school)} from 6 to 12 and {money(CHILD_COST.teen)} from 13 to 18. A later child costs 20% less: they share a room, clothes and gear. College isn&apos;t included.</p></div>
        <div className="rp-side"><h5>Other changes</h5><p className="rp-body">Any change to saving can be a stage: a raise, a bigger house, easing off for a while, each with its own saving and return.</p></div>
      </div> : null}
    </Sheet>
  );
}

/* ---------- 7. assumptions ---------- */
function Method({ R, p }: { R: PlanReport; p: Page }) {
  const S = R.S, a = S.assumptions;
  const facts: [string, string][] = [
    ["Your age", String(S.age)], ["Retiring at", String(S.retire)], ["Filing", S.facts.status], ["State", S.pay.stateName || "–"], ["Paid", S.facts.freqName],
    ["Tax year", S.facts.taxYear], ["Return, before inflation", pctStr(a.nominal, 2)], ["Inflation", pctStr(a.inflation, 2)], ["Fees", pctStr(a.fees, 2)],
    ["Saving grows each year", pctStr(a.growth, 2)], ["First-year withdrawal", pctStr(a.withdrawal, 2)], ["Tax on withdrawals", pctStr(S.atRetire.taxRate, 2)],
  ];
  return (
    <Sheet R={R} p={p}>
      <Lead h="What this rests on.">Your answers, this year&apos;s tax rules, and the assumptions below about returns and inflation. Everything was worked out in your browser.</Lead>
      <div className="rp-wide gap">
        <div><Sec>Your answers and the assumptions</Sec><dl className="rp-facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></div>
        <div className="rp-side"><h5>How it&apos;s figured</h5>
          <p>Taxes use the year&apos;s federal brackets and standard deduction, your state&apos;s rules, and Social Security and Medicare, with pre-tax money taken off what each one taxes.</p>
          <p className="gap">Every account grows at the same return, contributions rise each year, and the match goes into the traditional account. Balances are shown in today&apos;s dollars.</p>
          {S.stages ? <p className="gap">What children cost: {S.kidSource}.</p> : null}
          <p className="gap">The tax on withdrawals is what the first year&apos;s withdrawal from each account would pay. Social Security and other income aren&apos;t included. The Drawdown Simulator and the Guide go further.</p></div>
      </div>
      <Sec>Please note</Sec>
      <p className="rp-body">An educational plan, not financial, tax or legal advice. Returns are an assumption. Markets don&apos;t move in a straight line, and past returns don&apos;t predict future ones. Tax figures are estimates from published rules.</p>
    </Sheet>
  );
}

export function planPages(S: PlanSummary): Page[] {
  const list: Omit<Page, "n">[] = [
    { id: "cover", title: "Cover" },
    { id: "pay", title: "Your paycheck", because: "Step 2: your pay and its taxes" },
    ...spendChunks(S).map((_, i) => ({ id: "spend" + i, title: i ? "Your spending, continued" : "Your spending", because: "Step 1: what you spend" })),
    { id: "save", title: "Your saving", because: "Step 2: where each paycheck goes" },
    { id: "road", title: "The road to retirement", because: "Step 3: where that gets you" },
    ...(S.stages ? Array.from({ length: stagePages(S) }, (_, i) => ({ id: "stages" + i, title: i ? "Your stages, continued" : "Your stages", because: "Step 4: changes ahead" })) : []),
    { id: "method", title: "Assumptions and method" },
  ];
  return list.map((p, i) => ({ ...p, n: i + 1 }));
}

export function PlanReportPages({ R }: { R: PlanReport }) {
  const pages = planPages(R.S), at = (id: string) => pages.find((p) => p.id === id)!;
  return (
    <>
      <Cover R={R} pages={pages} />
      <Paycheck R={R} p={at("pay")} />
      {spendChunks(R.S).map((rows, i) => <Spending key={i} R={R} p={at("spend" + i)} rows={rows} part={i} />)}
      <Saving R={R} p={at("save")} />
      <Road R={R} p={at("road")} />
      {R.S.stages ? Array.from({ length: stagePages(R.S) }, (_, i) => <Stages key={i} R={R} p={at("stages" + i)} part={i} />) : null}
      <Method R={R} p={at("method")} />
    </>
  );
}
