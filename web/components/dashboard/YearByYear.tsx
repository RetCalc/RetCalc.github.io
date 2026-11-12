"use client";

/* Year by year: every year from now to retirement, as the plan counts it.
   Each of you's pay (with raises and pay changes), the taxes on it, what's
   spent and what's saved by account, and what's going on that year. What
   drives it sits above the table: the raises, how much of each raise is
   saved, and the changes ahead; a pay or spending figure in the table
   opens a change for that year. Two pictures under it: income against
   spending, and where each year's income goes. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarRangeIcon, ChartColumnIcon, PencilIcon, PlusIcon, SlidersHorizontalIcon, TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { Affixed, NumberField, SelectField } from "@/components/fields/Field";
import { MoneyInput } from "@/components/fields/NumberInput";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { groupDigits, parseNum } from "@/lib/format";
import { children as kidsOf, labelAt } from "@/tools/guide/schedule";
import { useScrub } from "@/components/charts/ChartFrame";
import { ChangeDialog, INCOME_KIND, PickKind, SAVE_LESS_KIND, SPENDING_KIND, fx, kindClass, laneFigure, type Kind } from "@/components/changes/ChangeUI";
import { Frame } from "./Frame";
import { planOf, tipLabel, withRow, withoutRow } from "./Calculator";
import { useWidth } from "./charts";
import type { CashYear } from "./cover";
import type { Answers } from "@/tools/guide/store";
import { money, shortMoney } from "./format";
import { ageOf, couple, nameOf, planYearsOf, realGrowth } from "./model";
import { acctWord, liveScenarios, newScenario, scenarioName, scenarioSentence, type Scenario, type ScenarioKind } from "./scenarios";
import { newId, useDashboard, type Profile, type YearEdit } from "./store";
import { KEEP_CHOICES, pctWord } from "./yearly";
import { Tile, TipLabel, To } from "./ui";
import { useTyped } from "./fields";
import { CsvButton } from "@/components/common/CsvButton";

/** The kinds this page adds: pay, spending, and saving outright. */
const KINDS: Kind[] = [INCOME_KIND, SPENDING_KIND, SAVE_LESS_KIND];
const OWN_KINDS: ScenarioKind[] = ["income", "spending", "saving"];

const yr = (m: number) => m * 12;
const pctText = (r: number) => String(Math.round(r * 1000) / 10);

export function YearByYear() {
  const { data, setProfile } = useDashboard();
  const pr = data.profile, entries = data.entries;
  const names: [string, string] | null = couple(pr) && pr.p2.pay ? [nameOf(pr, 0), nameOf(pr, 1)] : null;
  const { years, a } = useMemo(() => planYearsOf(pr, entries), [pr, entries]);
  const fv = useMemo(() => planOf(pr, entries).fv, [pr, entries]);
  const [future, setFuture] = useState(false);
  const [dlg, setDlg] = useState<{ at: "pick" } | { at: "edit"; s: Scenario; fresh: boolean } | null>(null);
  // A figure being typed into the table, and what the last one did.
  const [cell, setCell] = useState<Cell | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 9000);
    return () => clearTimeout(t);
  }, [flash]);
  const age = a.age != null ? Math.round(a.age) : null, retire = a.retire != null ? Math.round(a.retire) : null;
  const age2now = names ? ageOf(pr.p2) : null;

  const setYearly = (patch: Partial<Profile["yearly"]>) => setProfile((p) => ({ ...p, yearly: { ...p.yearly, ...patch } }));
  const changes = (pr.scenarios ?? []).filter((s) => OWN_KINDS.includes(s.kind));
  const sentence = (s: Scenario) => scenarioSentence(s, retire ?? 0, pr.assume.growth, { names: names ?? undefined });
  const effectOf = useCallback((x: Scenario) => {
    const on = planOf(withRow(pr, { ...x, on: true }), entries), off = planOf(withoutRow(pr, x.id), entries);
    return { fv: on.fv != null && off.fv != null ? on.fv - off.fv : null, cant: null };
  }, [pr, entries]);
  /* A figure typed into the table: kept as the plan's own (not a change),
     and what it does at retirement said for a moment under the table. */
  const putEdit = (e: YearEdit | null, c: Cell) => {
    const next = (p: Profile): Profile => {
      const kept = (p.yearly.edits ?? []).filter((x) => !(x.what === c.what && x.year === c.year));
      return { ...p, yearly: { ...p.yearly, edits: e ? [...kept, e] : kept } };
    };
    const after = planOf(next(pr), entries).fv;
    setProfile(next);
    setCell(null);
    const what = c.what === "spend" ? "Spending" : c.label;
    setFlash(`${what} ${e ? (e.once ? "in " + c.year : "from " + c.year) : "in " + c.year + " back to the plan's"}: ${after != null && fv != null ? fx(after - fv) : "…"} at retirement.`);
  };
  const open = (kind: ScenarioKind, over: Partial<Scenario>) => setDlg({ at: "edit", s: { ...newScenario(newId(), kind, age ?? 30, pr.assume.growth), ...over }, fresh: true });

  if (!years.length || age == null || retire == null) {
    return (
      <Frame current="years" title="Year by year">
        <Tile icon={CalendarRangeIcon} title="Every year to retirement">
          <p className="dsh-cap">This needs your pay, your age and when you plan to retire. Add your pay on <To href="/dashboard/income">Income</To> and your ages on <To href="/dashboard/profile">Profile</To>, and every year from now to retirement shows here.</p>
        </Tile>
      </Frame>
    );
  }

  // Today's dollars, or the dollars of each year (prices rising at the plan's inflation).
  const infl = pr.assume.inflation, f = (k: number) => (future ? Math.pow(1 + infl, k) : 1);
  const y0 = years[0], last = years[years.length - 1];
  const savedOf = (y: CashYear) => y.saved.trad + y.saved.roth + y.saved.hsa + y.saved.brok + y.ef;
  const other = years.some((y) => y.other > 0);

  return (
    <Frame current="years" title="Year by year" meta={future ? "Each year's own dollars" : "Today's dollars"}>
      <Tile id="drivers" icon={SlidersHorizontalIcon} title="What shapes the years" tip="yearDrivers">
        <div className="dsh-stats">
          <div className="dsh-stat"><div className="dsh-label">Savings at retirement</div><div className="dsh-fig dsh-key">{fv != null ? money(fv) : "…"}</div></div>
          <div className="dsh-stat"><div className="dsh-label">Income this year</div><div className="dsh-fig dsh-md">{money(yr(y0.income))}</div></div>
          <div className="dsh-stat"><div className="dsh-label">Saved this year, with the match</div><div className="dsh-fig dsh-md">{money(yr(savedOf(y0) + y0.match))}</div></div>
          <div className="dsh-stat"><div className="dsh-label">Income in {last.year}</div><div className="dsh-fig dsh-md">{money(yr(last.income) * f(last.k))}</div></div>
        </div>
        <div className="dsh-yby-drivers dsh-mt">
          {(names ?? [nameOf(pr, 0)]).map((n, i) => (
            <RaiseField key={i} id={"dshRaise" + i} label={names ? `${n}'s raise per year` : "Your raise per year"} rate={pr.yearly.raise[i]}
              onRate={(r) => setYearly({ raise: (i ? [pr.yearly.raise[0], r] : [r, names ? pr.yearly.raise[1] : r]) as [number, number] })} />
          ))}
          <SelectField id="dshKeep" label={<TipLabel text="How much of each raise you save" id="raiseSaved" />} value={pr.yearly.keep == null ? "same" : String(pr.yearly.keep)} onChange={(v) => setYearly({ keep: v === "same" ? null : Number(v) })}>
            {KEEP_CHOICES.map((c) => <option key={String(c.v)} value={c.v == null ? "same" : String(c.v)}>{c.label}</option>)}
          </SelectField>
        </div>
        <p className="dsh-cap dsh-mt6">Raises are beyond inflation. Taxes come from your paycheck&apos;s own figures each year, and saving follows take-home pay as set here, each account up to its limit with the rest in the next. What&apos;s spent is what&apos;s left. Children&apos;s costs and college come out of saving, as on <To href="/dashboard/profile#children">Profile</To>. Debt payments you&apos;ve planned on <To href="/dashboard/accounts#debts">Net worth</To>, and your mortgage, stay the same in dollars, so they take a little less each year after inflation; what they free, and all of it once they&apos;re paid off, goes to saving. When pay changes other than by a raise ({names ? `a pay change below, or ${names[1]} stopping work` : "a pay change below"}), spending carries on and saving takes the difference, each account within the limits that pay allows.</p>
        <div className="dsh-yby-changes dsh-mt">
          <div className="dsh-label">Changes ahead</div>
          {changes.length ? (
            <ul className="dsh-yby-chips">
              {changes.map((s) => (
                <li key={s.id} className={"dsh-yby-chip" + (s.on ? "" : " dsh-yby-off")}>
                  {/* Clicking it switches it on or off; the pencil edits it. */}
                  <button type="button" className="dsh-yby-tog" aria-pressed={s.on} onClick={() => setProfile((p) => withRow(p, { ...s, on: !s.on }))}
                    title={sentence(s) + (s.on ? " On: click to switch it off." : " Off: click to switch it on.")}>
                    <i className={"dsh-sc-mark " + kindClass(s)} aria-hidden="true" /><span className="dsh-yby-cname">{scenarioName(s)}</span>
                    <span className="dsh-muted">{y0.year + s.from - age}{s.until ? "–" + (y0.year + s.until - age - 1) : " on"} · {laneFigure(s, null)}</span>
                  </button>
                  <button type="button" className="dsh-yby-pen" aria-label={"Edit " + scenarioName(s)} onClick={() => setDlg({ at: "edit", s, fresh: false })}><PencilIcon aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
          ) : <p className="dsh-cap">None yet. A promotion, part-time years, a bigger house: add one here, or click a pay or spending figure in the table.</p>}
          <Button variant="outline" size="sm" onClick={() => setDlg({ at: "pick" })}><PlusIcon aria-hidden="true" />Add a change</Button>
        </div>
      </Tile>

      <Tile id="table" icon={TableIcon} title="Every year to retirement" className="dsh-r4" right={
        <div className="dsh-yby-tools">
          <Segmented aria-label="Dollars">
            <SegmentedItem pressed={!future} onPressedChange={() => setFuture(false)}>Today&apos;s dollars</SegmentedItem>
            <SegmentedItem pressed={future} onPressedChange={() => setFuture(true)}>Future dollars</SegmentedItem>
          </Segmented>
          <CsvButton label="Year by year" filename={`retcalc-year-by-year-${future ? "future" : "todays"}-dollars.csv`} rows={csvRows} />
        </div>
      }>
        <YearTable years={years} names={names} other={other} f={f} age2now={age2now} pr={pr} a={a}
          onPay={(y, who) => setCell({ what: who ? "pay1" : "pay0", year: y.year, k: y.k, value: yr(y.pay[who]), label: names ? names[who] + "'s pay" : "Your pay", edit: y.edits.find((e) => e.what === (who ? "pay1" : "pay0")) ?? null })}
          onSpend={(y) => setCell({ what: "spend", year: y.year, k: y.k, value: yr(y.spending), label: "Spending", edit: y.edits.find((e) => e.what === "spend") ?? null })} />
        {flash ? <p className="dsh-cap dsh-mt6 dsh-yby-flash" role="status">{flash}</p> : null}
        <p className="dsh-cap dsh-mt6">Per year. Click a pay or spending figure to type your own; a dot marks one you&apos;ve typed. {future ? `Each year's dollars: prices rise ${pctWord(infl)} per year.` : "Today's dollars: what each year's money buys at today's prices."} Savings grow at {pctWord(realGrowth(pr))} per year beyond inflation on <To href="/dashboard/retirement">Retirement</To>.</p>
      </Tile>

      <div className="dsh-grid dsh-two">
        <Tile id="income-chart" icon={ChartColumnIcon} title="Income and spending">
          <IncomeChart years={years} names={names} other={other} f={f} />
        </Tile>
        <Tile id="where-chart" icon={ChartColumnIcon} title="Where each year's income goes">
          <WhereChart years={years} f={f} />
        </Tile>
      </div>

      {cell ? <QuickEdit cell={cell} future={future} f={f} onSave={(e) => putEdit(e, cell)} onReset={() => putEdit(null, cell)} onClose={() => setCell(null)} /> : null}
      {dlg?.at === "pick" ? <PickKind kinds={KINDS} note="What do you see coming? Pick one, then give it ages and amounts." foot="To set a single year's pay or spending, click it in the table." close={() => setDlg(null)} pick={(k) => open(k.kind, k.over)} /> : null}
      {dlg?.at === "edit" ? (
        <ChangeDialog s={dlg.s} fresh={dlg.fresh} years={{ base: age, end: retire, ages: true }} accounts saveLess label={tipLabel} names={names} sentence={sentence} effectOf={effectOf}
          where={(k) => `The rest comes out of your other accounts once ${acctWord(k)} runs out, the 401(k) up to the match last.`}
          close={() => setDlg(null)} save={(x) => { setProfile((p) => withRow(p, x)); setDlg(null); }} remove={() => { setProfile((p) => withoutRow(p, dlg.s.id)); setDlg(null); }} />
      ) : null}
    </Frame>
  );
}

/** A raise per year in percent, keeping a half-typed "1." as typed. */
function RaiseField({ id, label, rate, onRate }: { id: string; label: string; rate: number; onRate: (r: number) => void }) {
  const [text, setText] = useTyped(pctText(rate));
  return <NumberField id={id} label={label} unit="%" step={0.5} max={15} negative value={text}
    onValueChange={(v) => { setText(v); const n = parseNum(v); onRate(isFinite(n) ? n / 100 : 0); }} />;
}

/** The table as CSV, as it shows: its column names, every year and the
    totals, in the dollars chosen (the groups over the names left out). */
function csvRows(): string[][] | null {
  const t = document.querySelector<HTMLTableElement>(".dsh-yby");
  if (!t?.querySelector("tbody tr")) return null;
  const text = (c: Element) => {
    const notes = [...c.querySelectorAll(".dsh-yby-note")].map((n) => n.textContent?.trim() ?? "");
    return notes.length ? notes.join("; ") : (c.textContent ?? "").replace(/\s+/g, " ").trim();
  };
  return [...t.querySelectorAll("tr")].filter((tr) => !tr.classList.contains("dsh-yby-groups"))
    .map((tr) => [...tr.querySelectorAll("th,td")].flatMap((c) => [text(c), ...Array.from({ length: ((c as HTMLTableCellElement).colSpan || 1) - 1 }, () => "")]));
}

/* ---------- the table ---------- */

function YearTable({ years, names, other, f, age2now, pr, a, onPay, onSpend }: {
  years: CashYear[]; names: [string, string] | null; other: boolean; f: (k: number) => number; age2now: number | null; pr: Profile; a: Answers;
  onPay: (y: CashYear, who: 0 | 1) => void; onSpend: (y: CashYear) => void;
}) {
  const m = (v: number, k: number) => money(Math.round(yr(v) * f(k)));
  const live = liveScenarios(pr.scenarios), kids = kidsOf(a);
  // The children's stage each year ("A child in childcare", "School years"),
  // said only when it changes.
  const stage = (y: CashYear) => (kids.length ? labelAt(a, kids, y.age, []) : "");
  const notesOf = (y: CashYear, i: number): { text: string; warn?: boolean }[] => {
    const out: { text: string; warn?: boolean }[] = [];
    const prev = years[i - 1];
    if (names && prev && prev.works[1] && !y.works[1]) out.push({ text: `${names[1]} stops work` });
    for (const id of y.tags) {
      const s = live.find((x) => x.id === id);
      if (s && !id.startsWith("__") && (i === 0 || !prev.tags.includes(id))) out.push({ text: scenarioName(s) + " starts" });
    }
    if (prev) for (const id of prev.tags) if (!y.tags.includes(id)) { const s = live.find((x) => x.id === id); if (s && !id.startsWith("__")) out.push({ text: scenarioName(s) + " ends" }); }
    if (kids.length && prev && stage(y) !== stage(prev)) out.push({ text: stage(y) + (y.kids > 0.5 ? `: children ${money(Math.round(yr(y.kids) * f(y.k)))} more than today` : "") });
    if (y.college > 0.5 && (!prev || prev.college < 0.5)) out.push({ text: "College starts" });
    // A debt paid off: what it took a month goes to saving from then on.
    for (const name of y.paidOff ?? []) out.push({ text: `${name} paid off` });
    if (y.short > 0.5) out.push({ text: `${m(y.short, y.k)} more than saving covers`, warn: true });
    return out;
  };
  // A figure typed here: marked, and said how long it holds.
  const dot = (y: CashYear, w: YearEdit["what"]) => {
    const e = y.edits.find((x) => x.what === w);
    return e ? <span className="dsh-yby-dot" role="img" aria-label={e.once ? ", typed for this year" : ", typed from this year on"} title={e.once ? "Typed for this year only" : "Typed, from this year to retirement"} /> : null;
  };
  const sum = (g: (y: CashYear) => number) => years.reduce((t, y) => t + yr(g(y)) * f(y.k), 0);
  const savedOf = (y: CashYear) => y.saved.trad + y.saved.roth + y.saved.hsa + y.saved.brok + y.ef;
  const ef = years.some((y) => y.ef > 0.5);
  const cross = useCrosshair();
  return (
    <div className="dsh-scrollx dsh-yby-wrap">
      {/* Each group of columns (Coming in, Going out, Saved) is named over a
          rule of its own, and a line runs down the table where each starts. */}
      <table className="dsh-tbl dsh-yby" ref={cross}>
        <thead>
          <tr className="dsh-yby-groups">
            <th colSpan={2} />
            <th colSpan={(names ? 2 : 1) + (other ? 1 : 0) + 1}><span>Coming in</span></th>
            <th colSpan={2}><span>Going out</span></th>
            <th colSpan={ef ? 6 : 5}><span>Saved</span></th>
            <th />
          </tr>
          <tr>
            <th>Year</th><th>{names ? "Ages" : "Age"}</th>
            {names ? <><th className="dsh-yby-gs">{names[0]}&apos;s pay</th><th>{names[1]}&apos;s pay</th></> : <th className="dsh-yby-gs">Pay</th>}
            {other ? <th>Other income</th> : null}
            <th>Income</th>
            <th className="dsh-yby-gs">Taxes</th><th>Spending</th>
            <th className="dsh-yby-gs">Traditional</th><th>Roth and HSA</th><th>Brokerage</th>{ef ? <th>Emergency fund</th> : null}<th>Employer match</th><th>All saved</th>
            <th className="dsh-yby-notes dsh-yby-gs">What&apos;s going on</th>
          </tr>
        </thead>
        <tbody>
          {years.map((y, i) => {
            const notes = notesOf(y, i);
            return (
              <tr key={y.year} className={i === 0 ? "dsh-yby-now" : undefined}>
                <td>{y.year}</td>
                <td>{y.age}{names && age2now != null ? " · " + (age2now + y.k) : ""}</td>
                {([0, 1] as const).slice(0, names ? 2 : 1).map((who) => (
                  <td key={who} className={who === 0 ? "dsh-yby-gs" : undefined}>{y.works[who] ? <button type="button" className="dsh-yby-cell" onClick={() => onPay(y, who)} title={`Type ${names ? names[who] + "'s" : "your"} pay in ${y.year}`}>{m(y.pay[who], y.k)}{dot(y, who ? "pay1" : "pay0")}</button> : <span className="dsh-muted">Stopped</span>}</td>
                ))}
                {other ? <td>{m(y.other, y.k)}</td> : null}
                <td className="dsh-yby-strong">{m(y.income, y.k)}</td>
                <td className="dsh-yby-gs">{m(y.taxes, y.k)}</td>
                <td><button type="button" className="dsh-yby-cell" onClick={() => onSpend(y)} title={`Type spending in ${y.year}`}>{m(y.spending, y.k)}{dot(y, "spend")}</button></td>
                <td className="dsh-yby-gs">{m(y.saved.trad, y.k)}</td>
                <td>{m(y.saved.roth + y.saved.hsa, y.k)}</td>
                <td>{m(y.saved.brok, y.k)}</td>
                {ef ? <td>{m(y.ef, y.k)}</td> : null}
                <td>{m(y.match, y.k)}</td>
                <td className="dsh-yby-strong">{m(savedOf(y) + y.match, y.k)}</td>
                <td className="dsh-yby-notes dsh-yby-gs">{notes.map((n, j) => <span key={j} className={n.warn ? "dsh-yby-note dsh-dn" : "dsh-yby-note"}>{n.text}</span>)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>All {years.length} years</td>
            {names ? <><td className="dsh-yby-gs">{money(sum((y) => y.pay[0]))}</td><td>{money(sum((y) => y.pay[1]))}</td></> : <td className="dsh-yby-gs">{money(sum((y) => y.pay[0]))}</td>}
            {other ? <td>{money(sum((y) => y.other))}</td> : null}
            <td>{money(sum((y) => y.income))}</td>
            <td className="dsh-yby-gs">{money(sum((y) => y.taxes))}</td><td>{money(sum((y) => y.spending))}</td>
            <td className="dsh-yby-gs">{money(sum((y) => y.saved.trad))}</td><td>{money(sum((y) => y.saved.roth + y.saved.hsa))}</td><td>{money(sum((y) => y.saved.brok))}</td>
            {ef ? <td>{money(sum((y) => y.ef))}</td> : null}
            <td>{money(sum((y) => y.match))}</td><td>{money(sum((y) => savedOf(y) + y.match))}</td>
            <td className="dsh-yby-notes dsh-yby-gs" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** A spreadsheet's crosshair: the row and the column under the pointer
    (or holding keyboard focus) lit, the column's name with them. CSS
    lights the row; this marks the column's cells, by column position, so
    the footer's two-column first cell and the group names line up. */
function useCrosshair() {
  const ref = useRef<HTMLTableElement>(null);
  useEffect(() => {
    const t = ref.current;
    if (!t) return;
    const at = (row: HTMLTableRowElement, col: number) => {
      let x = 0;
      for (const c of Array.from(row.cells)) { if (col >= x && col < x + c.colSpan) return c; x += c.colSpan; }
      return null;
    };
    const colOf = (cell: HTMLTableCellElement) => {
      let x = 0;
      for (const c of Array.from((cell.parentElement as HTMLTableRowElement).cells)) { if (c === cell) return x; x += c.colSpan; }
      return -1;
    };
    let lit: Element[] = [];
    const clear = () => { lit.forEach((c) => c.classList.remove("dsh-yby-col")); lit = []; t.querySelectorAll(".dsh-yby-row").forEach((r) => r.classList.remove("dsh-yby-row")); };
    const light = (cell: HTMLTableCellElement | null) => {
      clear();
      if (!cell || cell.closest("thead")) return;
      const col = colOf(cell);
      if (col < 2) return;
      cell.parentElement?.classList.add("dsh-yby-row");
      lit = Array.from(t.rows).filter((r) => !r.classList.contains("dsh-yby-groups")).map((r) => at(r, col)).filter((c): c is HTMLTableCellElement => !!c && c.colSpan === 1);
      lit.forEach((c) => c.classList.add("dsh-yby-col"));
    };
    const over = (e: Event) => light((e.target as Element).closest("td, th") as HTMLTableCellElement | null);
    t.addEventListener("mouseover", over);
    t.addEventListener("focusin", over);
    t.addEventListener("mouseleave", clear);
    t.addEventListener("focusout", clear);
    return () => { t.removeEventListener("mouseover", over); t.removeEventListener("focusin", over); t.removeEventListener("mouseleave", clear); t.removeEventListener("focusout", clear); };
  }, []);
  return ref;
}

/* ---------- typing a figure ---------- */

/** The figure being typed: whose, which year, and what it is now (per year, today's dollars). */
type Cell = { what: YearEdit["what"]; year: number; k: number; value: number; label: string; edit: YearEdit | null };

/** A small window over the table: the figure selected to type over, for
    that year only or from it to retirement. Return saves it. */
function QuickEdit({ cell, future, f, onSave, onReset, onClose }: { cell: Cell; future: boolean; f: (k: number) => number; onSave: (e: YearEdit) => void; onReset: () => void; onClose: () => void }) {
  const shown = (v: number) => groupDigits(Math.round(v * (future ? f(cell.k) : 1)), true);
  const [txt, setTxt] = useState(shown(cell.edit?.amount ?? cell.value));
  const [once, setOnce] = useState(cell.edit?.once ?? false);
  const input = useRef<HTMLInputElement>(null);
  // The figure selected as the window opens, so typing replaces it.
  useEffect(() => {
    const t = setTimeout(() => { input.current?.focus(); input.current?.select(); }, 60);
    return () => clearTimeout(t);
  }, []);
  const save = () => {
    const v = parseNum(txt);
    if (!isFinite(v) || v < 0) return;
    onSave({ what: cell.what, year: cell.year, amount: Math.round(v / (future ? f(cell.k) : 1)), once });
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent aria-labelledby="dshCellTitle" initialFocus={input}>
        <h2 id="dshCellTitle" className="dsh-dlg-h">{cell.label} in {cell.year}</h2>
        <form className="dsh-cellform" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <Affixed prefix="$" suffix="/yr"><MoneyInput ref={input} aria-label={`${cell.label} in ${cell.year}, per year`} nonNeg value={txt} onValueChange={setTxt} /></Affixed>
          <Segmented aria-label="How long">
            <SegmentedItem pressed={once} onPressedChange={() => setOnce(true)}>Just this year</SegmentedItem>
            <SegmentedItem pressed={!once} onPressedChange={() => setOnce(false)}>Until retirement</SegmentedItem>
          </Segmented>
          <p className="dsh-cap">{future ? `In ${cell.year} dollars.` : "In today's dollars."} {cell.what === "spend"
            ? (once ? "Saving makes up the difference that year." : "Saving makes up the difference from then on; later raises still split as set.")
            : (once ? "Taxes and saving follow it that year." : "Raises carry on from it, and taxes and saving follow.")}</p>
          <div className="dsh-navbtns dsh-wrapbtns">
            <Button type="submit">Save</Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            {cell.edit ? <Button type="button" variant="link" onClick={onReset}>Use the plan&apos;s figure</Button> : null}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- the pictures ---------- */

type Part = { name: string; cls: string; v: (y: CashYear) => number };

/** Stacked columns, one a year, with a line over them; pointing at (or
    dragging a finger along) a year reads it out. */
function Columns({ years, parts, line, f, label }: { years: CashYear[]; parts: Part[]; line?: Part; f: (k: number) => number; label: string }) {
  const [ref, W] = useWidth(600);
  const [at, setAt] = useState<number | null>(null);
  const H = 240, L = 54, R = 10, T = 12, B = 24;
  const tot = (y: CashYear) => parts.reduce((t, p) => t + Math.max(0, p.v(y)), 0) * 12 * f(y.k);
  const max = Math.max(1, ...years.map(tot), ...(line ? years.map((y) => line.v(y) * 12 * f(y.k)) : []));
  const step = (() => { const s = Math.pow(10, Math.floor(Math.log10(max / 4))); return [1, 2, 2.5, 5, 10].map((x) => x * s).find((x) => max / x <= 5) ?? s * 10; })();
  const top = Math.ceil(max / step) * step;
  const n = years.length, slot = (W - L - R) / n, bw = Math.max(2, Math.min(28, slot * 0.72));
  const X = (i: number) => L + i * slot + slot / 2, Y = (v: number) => T + (1 - v / top) * (H - T - B);
  const grid: number[] = [];
  for (let v = 0; v <= top + 1; v += step) grid.push(v);
  const every = n > 30 ? 10 : n > 14 ? 5 : n > 7 ? 2 : 1;
  const probe = (clientX: number) => {
    const r = ref.current?.querySelector("svg")?.getBoundingClientRect();
    if (!r) return;
    const x = ((clientX - r.left) / r.width) * W, i = Math.floor((x - L) / slot);
    setAt(i >= 0 && i < n ? i : null);
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => { if (e.pointerType !== "touch") probe(e.clientX); };
  const scrub = useScrub(ref, (x) => probe(x), () => setAt(null));
  const hot = at != null ? years[at] : null;
  const lineD = line ? years.map((y, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(line.v(y) * 12 * f(y.k)).toFixed(1)).join(" ") : null;
  return (
    <div ref={ref} className="dsh-chartwrap dsh-mt" {...scrub}>
      <svg className="dsh-chart" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label}
        onPointerMove={move} onPointerDown={move} onPointerLeave={(e) => { if (e.pointerType !== "touch") setAt(null); }}>
        {grid.map((v) => <g key={v}><line className="dsh-gl" x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} /><text x={L - 8} y={Y(v) + 4} textAnchor="end">{shortMoney(v)}</text></g>)}
        {years.map((y, i) => (i % every === 0 || (i === n - 1 && (n - 1) % every >= every / 2) ? <text key={y.year} x={X(i)} y={H - 6} textAnchor="middle">{y.year}</text> : null))}
        {at != null ? <rect className="dsh-yby-hot" x={X(at) - slot / 2} y={T} width={slot} height={H - T - B} /> : null}
        {years.map((y, i) => {
          let base = 0;
          return (
            <g key={y.year}>
              {parts.map((p) => {
                const v = Math.max(0, p.v(y)) * 12 * f(y.k), y1 = Y(base + v), y0 = Y(base);
                base += v;
                return v > 0 ? <rect key={p.name} className={"dsh-seg " + p.cls} x={X(i) - bw / 2} y={y1} width={bw} height={Math.max(0, y0 - y1 - (y1 > T ? 1 : 0))} rx={2} /> : null;
              })}
            </g>
          );
        })}
        {lineD && line ? <path className={"dsh-yby-line " + line.cls} d={lineD} /> : null}
      </svg>
      {hot ? (
        <div className={at! > n / 2 ? "dsh-tipbox dsh-tip-l" : "dsh-tipbox dsh-tip-r"}>
          <b>{hot.year}, age {hot.age}</b>
          {parts.map((p) => <div key={p.name} className="dsh-tiprow"><span><i className={"dsh-sw " + p.cls} aria-hidden="true" />{p.name}</span><span>{money(Math.round(p.v(hot) * 12 * f(hot.k)))}</span></div>)}
          {line ? <div className="dsh-tiprow"><span><i className={"dsh-sw " + line.cls} aria-hidden="true" />{line.name}</span><span>{money(Math.round(line.v(hot) * 12 * f(hot.k)))}</span></div> : null}
        </div>
      ) : null}
      <div className="dsh-legend dsh-yby-legend dsh-mt6">
        {parts.map((p) => <span key={p.name}><i className={"dsh-sw " + p.cls} aria-hidden="true" />{p.name}</span>)}
        {line ? <span><i className={"dsh-yby-lsw " + line.cls} aria-hidden="true" />{line.name}</span> : null}
      </div>
    </div>
  );
}

function IncomeChart({ years, names, other, f }: { years: CashYear[]; names: [string, string] | null; other: boolean; f: (k: number) => number }) {
  const parts: Part[] = [
    { name: names ? names[0] + "'s pay" : "Pay", cls: "dsh-yc-p1", v: (y) => y.pay[0] },
    ...(names ? [{ name: names[1] + "'s pay", cls: "dsh-yc-p2", v: (y: CashYear) => y.pay[1] }] : []),
    ...(other ? [{ name: "Other income", cls: "dsh-yc-oth", v: (y: CashYear) => y.other }] : []),
  ];
  return <Columns years={years} parts={parts} line={{ name: "Spending", cls: "dsh-yc-spend", v: (y) => y.spending }} f={f} label="Each year's income, by who earns it, and spending" />;
}

function WhereChart({ years, f }: { years: CashYear[]; f: (k: number) => number }) {
  const parts: Part[] = [
    { name: "Taxes", cls: "dsh-yc-tax", v: (y) => y.taxes },
    { name: "Spending", cls: "dsh-yc-spend", v: (y) => y.spending },
    { name: "Saved", cls: "dsh-yc-save", v: (y) => y.saved.trad + y.saved.roth + y.saved.hsa + y.saved.brok + y.ef },
    { name: "Employer match", cls: "dsh-yc-match", v: (y) => y.match },
  ];
  return <Columns years={years} parts={parts} f={f} label="Each year's income split into taxes, spending and saving, with the employer match on top" />;
}
