"use client";

/* Budget: what you spend, line by line, by group, and the emergency fund it
   sizes. No income and no saving: those are the Paycheck tab's (Paycheck.tsx),
   which reads these lines, so the two tabs run one way, budget then pay.
   Ported from src/js/app/13-budget.js and src/main/20-budget.html.

   Laid out as a ledger and its reading (the Budget critique, 2026-10-06):
   the lines take the wide two thirds on the left, and the reading (the
   budget a month as the one large figure, where it goes, and the emergency
   fund) stays beside them, sticky, so every amount typed shows its effect.
   On a phone a compact reading leads and stays pinned under the tab rail
   while the lines are in view. */

import { addTransitionType, startTransition, useRef, ViewTransition } from "react";
import { PencilIcon, PlusIcon, XIcon } from "lucide-react";
import { useHouseholdFill } from "@/components/household/HouseholdProvider";
import { Affixed } from "@/components/fields/Field";
import { MoneyInput, NumberInput } from "@/components/fields/NumberInput";
import { useToast } from "@/components/shell/Toast";
import { Tipped, TipDot } from "@/components/shell/Tooltips";
import { toolInputs, useToolNav, useToolScope, useToolState } from "@/components/tools/ToolState";
import { CsvButton } from "@/components/common/CsvButton";
import { Segmented } from "@/components/common/Readout";
import { HeroReading, PinnedReading } from "@/components/common/Reading";
import { ShareBar } from "@/components/charts/Legend";
import { focusLast } from "@/lib/dom";
import { dollarsField, groupDigits, money, parseNum } from "@/lib/format";
import { SERIES } from "@/lib/hues";
import { COLLEGE_DEFAULTS, collegeInput, collegeMonthly } from "@/tools/college/model";
import { BUDGET_DEF, PRESET_GROUPS, budgetCompute, emergencyYear, budgetGroups, isPlannedRow, isLockedRow, isSavingsRow, newLineName, openBudget, rowSlot, type BudgetRow } from "./model";
import { useShareKit } from "@/components/shell/share";
import { budgetShare } from "./share";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Paycheck } from "./Paycheck";


export function Budget() {
  // A budget saved before the Paycheck tab opens without its saving lines
  // (saving is planned there now), and one saved before lines could be
  // removed gets each preset line's own name (openBudget).
  const { state: s, set, setState } = useToolState(BUDGET_DEF, openBudget);
  useShareKit(BUDGET_DEF.id, budgetShare(s));
  const toast = useToast();
  const listRef = useRef<HTMLDivElement>(null);
  // In a walkthrough, the Budget and its Paycheck tab are separate steps:
  // no tabs, and the paycheck is the walkthrough's next step.
  const scope = useToolScope(), go = useToolNav();
  // Inside the Dashboard, a second column: the budget cut back for living on
  // the emergency fund.
  const dash = scope?.name === "dashboard", emerg = dash && s.efEmerg;
  const toPaycheck = () => (scope ? go("/budget#paycheck") : set("view")("paycheck"));
  const setRow = (i: number, patch: Partial<BudgetRow>) =>
    setState((c) => ({ ...c, rows: c.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));

  // The household's own pay, filing status and state go to the Paycheck tab.
  // Married with a second income: the two-income household.
  useHouseholdFill("budget", s, setState, (h, c) => {
    const two = h.status === "m" && h.income2 != null && h.income2 > 0;
    return {
      ...c, ...(h.income != null && h.income > 0 ? { pcGross: dollarsField(h.income) } : {}),
      ...(two ? { pcGross2: dollarsField(h.income2!) } : {}),
      pcStatus: h.status !== "m" ? "s" : two ? "m2" : "m", ...(h.state ? { pcState: h.state } : {}),
      // Two incomes start with an HSA each, as switching to it does.
      ...(two && c.pcStatus !== "m2" ? { pcHsaFamily: false, pcHsaBoth: true } : {}),
    };
  });

  /* Another tool sending a line in: update a row with the same name rather
     than adding a second one. */
  const upsert = (desc: string, monthly: number) =>
    setState((c) => {
      const i = c.rows.findIndex((r) => r.desc === desc);
      const amount = groupDigits(monthly, true);
      return i >= 0
        ? { ...c, rows: c.rows.map((r, j) => (j === i ? { ...r, amount, freq: 12 } : r)) }
        : { ...c, rows: [...c.rows, { group: "Custom", desc, amount, freq: 12, custom: true }] };
    });

  const { savedYr, totalYr, ef, efTarget } = budgetCompute(s);
  // With nothing entered yet there's no answer to mark, so the figure stays in Text.
  const empty = !(totalYr > 0);
  const where = budgetGroups(s);

  /* Rows grouped, keeping each row's place in the list. The preset groups
     always show, in their order, even emptied, so a line can be added back;
     any other (Custom) follows as its rows come. */
  const groups: { name: string; rows: { r: BudgetRow; i: number }[] }[] = PRESET_GROUPS.map((name) => ({ name, rows: [] }));
  s.rows.forEach((r, i) => {
    if (isPlannedRow(r)) return;
    let g = groups.find((x) => x.name === r.group);
    if (!g) groups.push((g = { name: r.group, rows: [] }));
    g.rows.push({ r, i });
  });

  /* The budget isn't a table, so its CSV is built here: each item with an
     amount, then the totals as labeled rows. */
  /* A new line at the end of a group (a new Custom one from the button
     under the list), named for its group until it's given a name, with
     that name selected to type over. */
  const addLine = (group: string) => {
    setState((c) => ({ ...c, rows: [...c.rows, { group, desc: newLineName(c.rows, group), amount: "0", freq: 12, custom: true }] }));
    focusLast(listRef, "[data-f=\"desc\"][data-group=\"" + group + "\"]");
  };
  const removeLine = (i: number) => setState((c) => ({ ...c, rows: c.rows.filter((_, j) => j !== i) }));

  const csvRows = (): string[][] | null => {
    const period = (f: number) => (f === 12 ? "Per month" : "Per year");
    if (empty) return null;
    const rows = [["Budget Item", "Amount", "Period"]];
    for (const r of s.rows) if (!isPlannedRow(r) && parseNum(r.amount) > 0) rows.push([r.desc, money(parseNum(r.amount)), period(r.freq)]);
    rows.push(["Budget", money(totalYr / 12), "Per month"], ["Budget", money(totalYr), "Per year"]);
    if (savedYr > 0) rows.push(["Of which set aside for goals", money(savedYr), "Per year"]);
    return rows;
  };

  // The two tabs: the budget itself, and where each paycheck goes.
  const tabs = scope ? null : (
    <div className="col-span-full">
      <Segmented id="segBgView" attr="data-bgview" options={[["budget", "Budget"], ["paycheck", "Paycheck"]] as const} value={s.view}
        onChange={(v) => startTransition(() => { addTransitionType("view-switch"); set("view")(v); })} />
    </div>
  );
  // Switching tabs cross-fades the old view out and the new one in.
  const swap = { "view-switch": "tab-swap", default: "none" } as const;
  if (s.view === "paycheck") return (
    <>
      {tabs}
      <ViewTransition key="paycheck" enter={swap} exit={swap} default="none">
      <div className="col-span-full grid grid-cols-1 items-start gap-5 max-sm:gap-3.5 lg:grid-cols-3">
        <Paycheck s={s} set={set} setState={setState} />
      </div>
      </ViewTransition>
    </>
  );

  return (
    <>
    {tabs}
    <ViewTransition key="budget" enter={swap} exit={swap} default="none">
    <div className="col-span-full grid grid-cols-1 items-start gap-5 max-sm:gap-3.5 lg:grid-cols-3" id="tab-budget">
      <div className="min-w-0 lg:col-span-2">
        {/* Phones and narrow screens: the answer leads, and stays under the
            tab rail while the lines are on screen. */}
        <PinnedReading tone={empty ? "text" : "answer"} main={{ label: "Your budget, per month", value: money(totalYr / 12) }} side={{ label: "Per year", value: money(totalYr) }} />

        <Card>
          <CardHeader>
            <CardTitle>Your budget</CardTitle>
            {empty ? <CardDescription>Type what each line costs you, per month or per year; leave the ones you don&apos;t have at 0.</CardDescription> : null}
            <CardAction><CsvButton id="bgCsv" label="budget" title="Download your budget as a CSV" rows={csvRows} filename="retcalc-budget.csv" /></CardAction>
          </CardHeader>
          <CardContent>
            <div id="bgList" ref={listRef} data-emerg={emerg ? "" : undefined}>
              {emerg ? <div className="bgcols" aria-hidden="true"><span>Normal</span><span>In an emergency</span></div> : null}
              {groups.map((g) => (
                <div className="bggroup" key={g.name}>
                  <div className="bggroup-h">
                    <span>{g.name || "Custom"}</span>
                    {PRESET_GROUPS.includes(g.name) ? (
                      <Button variant="ghost" size="icon-sm" title={"Add a line to " + g.name} aria-label={"Add a line to " + g.name} onClick={() => addLine(g.name)}><PlusIcon aria-hidden="true" /></Button>
                    ) : null}
                  </div>
                  {g.rows.map(({ r, i }) => (
                    /* An empty line (no amount) shows its name and its 0 in
                       Muted, so the lines in use stand out; the 0 itself stays. */
                    <div className="bgrow" key={i} data-empty={parseNum(r.amount) > 0 ? undefined : ""}>
                      {isSavingsRow(r) ? (
                        <span className="desc"><Tipped text={r.desc} k="bgsavings" /></span>
                      ) : isLockedRow(r, i) ? (
                        /* Fixed: the Paycheck tab reads this line as your premiums. */
                        <span className="desc" title="The Paycheck tab reads this line as your health premiums, so it keeps its name">{r.desc}</span>
                      ) : (
                        /* Every other name is renamed in place, a line added to a
                           group as much as a preset: a click selects it to type
                           over, Enter commits, and a preset's blank name falls back
                           to its own. A new line opens here, empty, to type into. The
                           pencil shows it can be. */
                        <span className="desc group/name">
                          <span key={r.desc} className="bgname" contentEditable suppressContentEditableWarning spellCheck={false} title="Click to rename" aria-label="Item name"
                            data-f="desc" data-group={r.group} data-placeholder="Name this line"
                            onFocus={(e) => {
                              const range = document.createRange();
                              range.selectNodeContents(e.currentTarget);
                              const sel = window.getSelection();
                              sel?.removeAllRanges();
                              sel?.addRange(range);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                e.currentTarget.blur();
                              }
                            }}
                            onBlur={(e) => {
                              const raw = (e.currentTarget.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
                              const desc = raw || rowSlot(r, i) || r.desc;
                              // Unchanged (or cleared, which keeps the name it had): put the text back as drawn.
                              if (desc === r.desc) e.currentTarget.textContent = desc;
                              else setRow(i, { desc });
                            }}>{r.desc}</span>
                          <PencilIcon className="ml-1.5 inline size-3 shrink-0 align-baseline text-muted-foreground opacity-0 transition-opacity group-hover/name:opacity-100 group-focus-within/name:opacity-100 pointer-coarse:opacity-70" aria-hidden="true" />
                        </span>
                      )}
                      <Affixed prefix="$" className="w-35 flex-none @max-md:w-auto @max-md:flex-1"><MoneyInput nonNeg data-f="amount" data-i={i} value={r.amount} onValueChange={(v) => setRow(i, { amount: v })} aria-label={r.desc + " amount"} /></Affixed>
                      {emerg ? <Affixed prefix="$" className="w-35 flex-none @max-md:w-auto @max-md:flex-1"><MoneyInput nonNeg data-f="emerg" data-i={i} value={r.emerg ?? r.amount} onValueChange={(v) => setRow(i, { emerg: v })} aria-label={r.desc + " in an emergency"} /></Affixed> : null}
                      <Segmented size="compact" attr="data-fv" options={[[12, "/mo"], [1, "/yr"]] as const} value={r.freq} onChange={(f) => setRow(i, { freq: f })} />
                      {isLockedRow(r, i) ? <span className="delspace"></span> : (
                        <Button variant="ghost" size="icon-sm" title="Remove this line" aria-label={"Remove " + (r.desc || "this line")} onClick={() => removeLine(i)}><XIcon aria-hidden="true" /></Button>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Button variant="outline" size="sm" id="bgAdd"
                onClick={() => addLine("Custom")}><PlusIcon data-icon="inline-start" aria-hidden="true" />Add custom item</Button>
            </div>
            {scope ? null : <>
            <div className="hint mt-3.5">Pull a number in from another tool:</div>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" id="bgCopyCollege"
                onClick={() => {
                  const inp = collegeInput(toolInputs("college", COLLEGE_DEFAULTS));
                  if (!inp.kids.some((k) => k.annualCost > 0)) {
                    toast("Set up the College Savings tool first");
                    return;
                  }
                  const mo = collegeMonthly(inp);
                  if (!(mo > 0)) {
                    toast("No monthly amount needed there yet");
                    return;
                  }
                  upsert("College savings", Math.round(mo));
                  toast("Added " + money(Math.round(mo)) + "/mo from College Savings");
                }}><PlusIcon data-icon="inline-start" aria-hidden="true" />College savings</Button>
            </div>
            </>}
          </CardContent>
        </Card>
      </div>

      <div className="min-w-0 lg:col-span-1 lg:self-stretch">
        <aside id="asideBudget" className="max-lg:static max-lg:max-h-none max-lg:overflow-visible">
          <Card size="flush" className="min-w-0">
            <HeroReading tone={empty ? "text" : "answer"} under
              hero={{ label: "Your budget, per month", id: "bgTotal", value: money(totalYr / 12), noteId: "bgTotalNote",
                note: empty ? "Enter your expenses to begin" : "Every line, with yearly bills spread over the year" }}
              figures={[{ label: "Per year", id: "bgTotYr", value: money(totalYr), note: savedYr > 0 ? money(savedYr) + " of it set aside for goals" : undefined }]} />

            {/* Where it goes: each group's share of the budget. */}
            <div className="border-t border-border px-5.5 pt-4 pb-3 max-sm:px-4" hidden={empty}>
              <h3 className="m-0 mb-2.5 text-body font-semibold">Where it goes</h3>
              <div id="bgWhere">
                {where.map((g, i) => (
                  <ShareBar key={g.group} label={g.group} value={g.yr / 12} share={totalYr > 0 ? g.yr / totalYr : 0} color={SERIES.lavender} idx={i} pct />
                ))}
              </div>
            </div>

            <div className="border-t border-border px-5.5 pt-4 pb-5 max-sm:px-4">
              <h3 className="m-0 flex items-center gap-2 text-body font-semibold">Emergency fund<TipDot k="emergency" /></h3>
              <div className="efrow mt-2.5">
                <span>Target for</span>{" "}
                <Affixed suffix="mo" className="w-18"><NumberInput id="efMonths" aria-label="Emergency fund target, months of expenses" nonNeg max={36} value={s.efMonths} onValueChange={set("efMonths")} /></Affixed>{" "}
                <span>of monthly expenses</span>
              </div>
              <div className="mt-3.5">
                <span className="block text-label text-muted-foreground" id="efLabel">{ef}-month emergency fund</span>
                <span className="block text-3xl leading-tight font-medium tabular-nums sm:text-display" id="efTarget">{money(efTarget)}</span>
              </div>
              {dash ? (
                <div className="mt-3.5 grid gap-2.5">
                  <p className="hint m-0">About 6 months suits most people; up to 12 if your income varies.</p>
                  {emerg ? (
                    <>
                      <div className="flex"><Segmented id="efBasis" attr="data-efb" options={[["normal", "Normal budget"], ["emergency", "Emergency budget"]] as const} value={s.efBasis} onChange={set("efBasis")} /></div>
                      <p className="hint m-0">{s.efBasis === "emergency" ? "Sized on the emergency budget: " + money(emergencyYear(s) / 12) + " per month." : "Sized on your normal budget. Switch to size it on the emergency one."}</p>
                      <div className="flex"><Button variant="link" size="inline-xs" onClick={() => setState((c) => ({ ...c, efEmerg: false, efBasis: "normal" }))}>Remove the emergency budget</Button></div>
                    </>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setState((c) => ({ ...c, efEmerg: true, efBasis: "emergency", rows: c.rows.map((r) => ({ ...r, emerg: r.emerg ?? r.amount })) }))}>
                      <PlusIcon data-icon="inline-start" aria-hidden="true" />Build an emergency budget
                    </Button>
                  )}
                </div>
              ) : null}
            </div>

            {/* The next step: the paycheck that covers this budget (a
                walkthrough has its own Next). */}
            <div className="border-t border-border px-5.5 pt-4 pb-5 max-sm:px-4" hidden={!!scope}>
              <h3 className="m-0 text-body font-semibold">Next: your paycheck</h3>
              <Button id="bgToPaycheck" onClick={toPaycheck}>{scope ? "Next: your paycheck" : "Open the Paycheck tab"}</Button>
            </div>
          </Card>
        </aside>
      </div>
    </div>
    </ViewTransition>
    </>
  );
}
