"use client";

/* Social Security Calculator: what your check will be at every age you
   could claim, 62 to 70, for you or a couple, and which age collects the
   most for how long you live.

   Inputs on top, as a sentence to fill in, with pay year by year under it
   for an estimate. Then the staircase of checks by claiming age (a step
   picks the age) beside the reading, with how the check is figured under
   both; a strip of facts; for a couple, every pair of claiming ages; the
   best age by lifespan beside the break-even chart; and every age and the
   years one by one, side by side. */

import { useRef, useState } from "react";
import { CheckIcon, PlusIcon, ChartColumnIcon, MinusIcon } from "lucide-react";
import { MultiChart } from "@/components/charts/MultiChart";
import { Legend } from "@/components/charts/Legend";
import { useNarrow } from "@/components/charts/useNarrow";
import { useHouseholdFill } from "@/components/household/HouseholdProvider";
import { MoneyInput, NumberInput } from "@/components/fields/NumberInput";
import { TipDot } from "@/components/shell/Tooltips";
import { useShareKit } from "@/components/shell/share";
import { useToolState } from "@/components/tools/ToolState";
import { BigValue } from "@/components/common/BigValue";
import { CsvButton } from "@/components/common/CsvButton";
import { KV } from "@/components/common/Readout";
import { DASH, dollarsField, money } from "@/lib/format";
import { SERIES } from "@/lib/hues";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeRange } from "@/components/ui/native-range";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { NEWEST_YEAR } from "@/lib/engine/typed";
import { CLAIM_AGES, cumulative, fraLabel, social, ssRules, SOCIAL_DEF, type PersonInputs, type Social as SocialFigures, type SocialInputs, type Who } from "./model";
import { PayYears } from "./PayYears";

const pct = (x: number) => Math.round(x * 100) + "%";
const k = (n: number) => n >= 1e6 ? "$" + (n / 1e6).toFixed(1) + "M" : "$" + Math.round(n / 1000) + "K";

/* ---------- the sentence's blanks ---------- */
function Num({ value, onChange, label, max }: { value: string; onChange: (v: string) => void; label: string; max?: number }) {
  return <NumberInput variant="inline" nonNeg max={max} value={value} onValueChange={onChange} aria-label={label} />;
}
function Cash({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return <span className="whitespace-nowrap text-foreground">$<MoneyInput variant="inline" nonNeg value={value} onValueChange={onChange} aria-label={label} /></span>;
}
function Pick({ value, onChange, label, id }: { value: string; onChange: (v: string) => void; label: string; id?: string }) {
  return (
    <NativeSelect variant="inline" id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      {CLAIM_AGES.map((a) => <option key={a} value={String(a)}>{a}</option>)}
    </NativeSelect>
  );
}

export function Social() {
  const { state: s, setState } = useToolState(SOCIAL_DEF);
  const narrow = useNarrow();
  const agesRef = useRef<HTMLTableElement>(null);
  const yearsRef = useRef<HTMLTableElement>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payWho, setPayWho] = useState<Who>("you");

  useHouseholdFill("social", s, setState, (h, c) => {
    const next: SocialInputs = { ...c, you: { ...c.you }, spouse: { ...c.spouse } };
    if (h.status) next.status = h.status;
    if (h.age != null && h.age > 0 && h.age < 120) next.you.birth = String(NEWEST_YEAR - Math.round(h.age));
    if (h.status === "m" && h.spouseAge != null && h.spouseAge > 0 && h.spouseAge < 120) next.spouse.birth = String(NEWEST_YEAR - Math.round(h.spouseAge));
    if (h.income != null && h.income > 0) next.you.pay = dollarsField(h.income);
    if (h.status === "m" && h.income2 != null && h.income2 > 0) next.spouse.pay = dollarsField(h.income2);
    return next;
  });

  const setP = (who: Who, key: keyof PersonInputs) => (v: string) => setState((c) => ({ ...c, [who]: { ...c[who], [key]: v } }));
  const setSrc = (who: Who, src: "pay" | "statement") => setState((c) => ({ ...c, [who]: { ...c[who], src } }));
  const setEdits = (who: Who) => (f: (e: Record<string, string>) => Record<string, string>) => setState((c) => ({ ...c, [who]: { ...c[who], edits: f(c[who].edits) } }));
  const claimBoth = (a: number, b?: number) => setState((c) => ({ ...c, you: { ...c.you, claim: String(a) }, spouse: b != null ? { ...c.spouse, claim: String(b) } : c.spouse }));

  const S = social(s);
  const married = S.married;
  const ready = S.you.pia > 0;
  const anyPay = s.you.src === "pay" || (married && s.spouse.src === "pay");
  const payPerson: Who = s[payWho].src === "pay" && (payWho === "you" || married) ? payWho : s.you.src === "pay" ? "you" : "spouse";

  useShareKit(SOCIAL_DEF.id, {
    card: () => ready ? {
      title: "Social Security", sub: married ? "Claiming at " + S.you.claim + " and " + S.spouse!.claim : "Claiming at " + S.you.claim,
      bigLabel: "Per month, in today's dollars", big: money(S.monthly),
      rows: [
        [married ? "Total, both lifetimes" : "Total by " + S.you.through, money(S.H.total)],
        ["Age that collects the most", String(S.best.age)],
        ...(married ? [["Survivor benefit", money(S.survivor) + "/mo"] as [string, string]] : []),
      ],
    } : "Enter your pay or your statement's benefit to make a card",
  });

  return (
    <div className="col-span-full flex min-w-0 flex-col gap-3.5" id="tab-social">
      <Sentence s={s} S={S} setP={setP} setOther={(v) => setState((c) => ({ ...c, other: v }))} setSrc={setSrc} payOpen={payOpen} setPayOpen={setPayOpen} anyPay={anyPay}
        toggleSpouse={() => setState((c) => ({ ...c, status: c.status === "m" ? "s" : "m" }))}>
        {payOpen && anyPay ? (
          <PayYears who={payPerson} setWho={setPayWho} both={married && s.you.src === "pay" && s.spouse.src === "pay"}
            inputs={s[payPerson]} person={payPerson === "you" ? S.you : S.spouse!} setP={(key) => setP(payPerson, key)} setEdits={setEdits(payPerson)} />
        ) : null}
      </Sentence>

      <Stage S={S} narrow={narrow} claim={(a) => claimBoth(a)} />
      <Facts S={S} />
      {S.pairs ? <Pairs S={S} narrow={narrow} use={claimBoth} /> : null}

      <div className="grid min-w-0 grid-cols-1 gap-3.5 lg:grid-cols-2">
        <Lifespan S={S} setThrough={setP("you", "through")} />
        <Race S={S} />
      </div>

      <div className="grid min-w-0 grid-cols-1 items-stretch gap-3.5 lg:grid-cols-5">
        <Card className="min-w-0 lg:col-span-3">
          <CardHeader>
            <CardTitle>Every age, side by side</CardTitle>
            <CardAction><CsvButton table={agesRef} label="Every age, side by side" /></CardAction>
          </CardHeader>
          <div className="scroll max-h-none" tabIndex={0} role="region" aria-label="Every age, side by side">
            <table id="ssAges" ref={agesRef}>
              <thead><tr><th>Claim at</th><th>Per month</th><th>% of full benefit</th><th>{married ? "Total, both lifetimes" : "Total by " + S.you.through}</th><th>Compared to {S.best.age}</th></tr></thead>
              <tbody>
                {S.rows.map((r) => {
                  const d = r.total - S.best.total, on = r.age === S.you.claim, max = Math.max(...S.rows.map((x) => x.total));
                  return (
                    <tr key={r.age} aria-selected={on} tabIndex={0} className="cursor-pointer aria-selected:bg-muted aria-selected:font-semibold"
                      onClick={() => claimBoth(r.age)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); claimBoth(r.age); } }}>
                      <td className={cn(on && "text-primary")}>{r.age}
                        {r.age === Math.round(S.you.fra) ? <span className="ml-1.5 text-note font-normal text-muted-foreground">full age</span> : null}
                        {r.age === S.best.age ? <Badge variant="positive" className="ml-1.5 align-middle">Most</Badge> : null}</td>
                      <td>{money(r.monthly)}</td>
                      <td>{pct(r.factor)}</td>
                      <td className="relative">
                        <span className={cn("absolute right-2.5 bottom-0.75 h-0.75 w-(--w) rounded-xs", on ? "bg-primary" : "bg-muted-foreground/40")}
                          style={{ "--w": ((r.total / max) * 60).toFixed(1) + "%" } as React.CSSProperties} aria-hidden="true" />
                        <span className="relative">{money(r.total)}</span>
                      </td>
                      <td className="text-muted-foreground">{d < -1 ? "−" + money(-d) : DASH}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <Card className="flex min-w-0 flex-col lg:col-span-2 lg:contain-size">
          <CardHeader>
            <CardTitle>Year by year</CardTitle>
            <CardAction><CsvButton table={yearsRef} label="Year by year" /></CardAction>
          </CardHeader>
          <div className="scroll max-h-101 lg:max-h-none lg:min-h-0 lg:flex-1" tabIndex={0} role="region" aria-label="Year by year">
            <table id="ssYears" ref={yearsRef}>
              <thead><tr><th>Your age</th><th>Your benefit</th>{married ? <><th>Spouse&apos;s age</th><th>Spouse&apos;s benefit</th></> : null}<th>Added up</th></tr></thead>
              <tbody>
                {S.H.rows.map((r) => (
                  <tr key={r.age}>
                    <td>{r.age}</td>
                    <td className={cn(!r.you && "text-muted-foreground")}>{r.you ? money(r.you) : DASH}</td>
                    {married ? <><td className="text-muted-foreground">{r.age + S.gap}</td><td className={cn(!r.spouse && "text-muted-foreground")}>{r.spouse ? money(r.spouse) : DASH}</td></> : null}
                    <td>{money(r.cum)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------- the sentence ---------- */
function Sentence({ s, S, setP, setOther, setSrc, payOpen, setPayOpen, anyPay, toggleSpouse, children }: {
  s: SocialInputs; S: SocialFigures; setOther: (v: string) => void;
  setP: (who: Who, key: keyof PersonInputs) => (v: string) => void;
  setSrc: (who: Who, src: "pay" | "statement") => void;
  payOpen: boolean; setPayOpen: (v: boolean) => void; anyPay: boolean; toggleSpouse: () => void; children: React.ReactNode;
}) {
  const y = s.you, sp = s.spouse, married = S.married, { earnLimit } = ssRules();
  return (
    <Card className="min-w-0" id="ssSentence">
      <CardContent className="px-5.5 max-sm:px-4">
        <div className="text-xl leading-loose text-muted-foreground max-sm:text-lg" id="ssSayYou">
          I was born in <Num value={y.birth} onChange={setP("you", "birth")} label="Year you were born" max={2100} />
          <TipDot k="ssbirth" />
          {y.src === "pay" ? (
            <> and earn <Cash value={y.pay} onChange={setP("you", "pay")} label="Your pay per year" /> per year<TipDot k="" text="Your pay this year before tax. Every other year of your career is estimated from it; open Edit pay year by year to see or change any of them." />.
              {" "}I started working at <Num value={y.start} onChange={setP("you", "start")} label="Age you started working" max={80} /> and will stop at <Num value={y.stop} onChange={setP("you", "stop")} label="Age you stop working" max={90} /><TipDot k="" text="Social Security averages your best 35 years of pay. A career shorter than 35 years averages in zeros." />.</>
          ) : (
            <>, and my statement shows <Cash value={y.pia} onChange={setP("you", "pia")} label="Full benefit from your statement, per month" /> per month at full retirement age<TipDot k="sspia" />.</>
          )}
          {" "}I&apos;ll claim at <Pick id="ssClaim1" value={y.claim} onChange={setP("you", "claim")} label="Age you claim" /> and expect to live to about <Num value={y.through} onChange={setP("you", "through")} label="Expect to live to" max={110} /><TipDot k="" text="How long the totals run. Nobody knows, so try a few: a 65-year-old today lives to about 84 on average, and in a couple one of the two usually passes 90." />.
          {S.you.claim < S.you.fra ? (
            <> Until {Math.round(S.you.fra)}, I&apos;ll still earn <Cash value={y.earn} onChange={setP("you", "earn")} label="Pay from work while collecting before full retirement age" /> per year from work<TipDot k="" text={`Pay from work while you collect before full retirement age. Over ${money(earnLimit)} per year, Social Security holds back $1 of benefit for every $2. Those months aren't lost: your check is raised at full retirement age to make up for them.`} />.</>
          ) : null}
          {" "}In retirement {married ? "we'll" : "I'll"} have <Cash value={s.other} onChange={setOther} label="Other income in retirement, per year" /> per year of other income<TipDot k="ssother" />.
        </div>
        {married ? (
          <div className="mt-2.5 border-t border-border pt-2.5 text-xl leading-loose text-muted-foreground max-sm:text-lg" id="ssSaySpouse">
            My spouse was born in <Num value={sp.birth} onChange={setP("spouse", "birth")} label="Spouse's birth year" max={2100} />
            {sp.src === "pay" ? (
              <> and earns <Cash value={sp.pay} onChange={setP("spouse", "pay")} label="Spouse's pay per year" /> per year. They started working at <Num value={sp.start} onChange={setP("spouse", "start")} label="Age your spouse started working" max={80} /> and will stop at <Num value={sp.stop} onChange={setP("spouse", "stop")} label="Age your spouse stops working" max={90} />.</>
            ) : (
              <>, and their statement shows <Cash value={sp.pia} onChange={setP("spouse", "pia")} label="Spouse's full benefit, per month" /> per month at full retirement age.</>
            )}
            {" "}They&apos;ll claim at <Pick id="ssClaim2" value={sp.claim} onChange={setP("spouse", "claim")} label="Spouse claims at" /> and expect to live to about <Num value={sp.through} onChange={setP("spouse", "through")} label="Spouse expects to live to" max={110} />.
            {S.spouse && S.spouse.claim < S.spouse.fra ? (
              <> Until {Math.round(S.spouse.fra)}, they&apos;ll still earn <Cash value={sp.earn} onChange={setP("spouse", "earn")} label="Spouse's pay while collecting early" /> per year from work.</>
            ) : null}
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3">
          <Button variant="outline" size="sm" id="ssSpouseBtn" onClick={toggleSpouse}>{married ? <MinusIcon /> : <PlusIcon />}{married ? "Remove my spouse" : "Add my spouse"}</Button>
          {anyPay ? <Button variant="outline" size="sm" id="ssPayBtn" aria-pressed={payOpen} aria-controls={payOpen ? "ssPay" : undefined} onClick={() => setPayOpen(!payOpen)}><ChartColumnIcon />Edit pay year by year</Button> : null}
          <Button variant="link" size="inline" onClick={() => setSrc("you", y.src === "pay" ? "statement" : "pay")}>
            {y.src === "pay" ? "I have my Social Security statement" : "Estimate from my pay instead"}</Button>
          {married ? <Button variant="link" size="inline" onClick={() => setSrc("spouse", sp.src === "pay" ? "statement" : "pay")}>
            {sp.src === "pay" ? "My spouse has a statement" : "Estimate my spouse's from pay"}</Button> : null}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

/* ---------- the staircase, the reading and how the check is figured ---------- */
function Stage({ S, narrow, claim }: { S: SocialFigures; narrow: boolean; claim: (a: number) => void }) {
  const married = S.married, c = S.you.claim, fra = Math.round(S.you.fra);
  const max = Math.max(...S.rows.map((r) => r.monthly)) || 1;
  const r62 = S.rows[0], r70 = S.rows[S.rows.length - 1], ch = S.chosen;
  const stairs = useRef<HTMLDivElement>(null);
  const go = (a: number) => { claim(a); requestAnimationFrame(() => stairs.current?.querySelector<HTMLElement>(`[data-age="${a}"]`)?.focus()); };
  const early = Math.round((S.you.fra - c) * 12);
  const when = early > 0 ? `${early} months early` : early < 0 ? `${-early} months late` : "at full age";
  const { cap, bend1, bend2 } = ssRules();
  return (
    <Card size="flush" className="min-w-0" id="ssReading">
      <div className="grid grid-cols-1 lg:grid-cols-3">
        <div className="min-w-0 border-border px-4.5 pt-4 pb-3 max-lg:order-2 max-lg:border-t lg:col-span-2 lg:border-r">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <h2 className="m-0 flex items-center gap-1.5 text-aside font-semibold">Pick the age you claim<TipDot k="" text="Claim at 62 and your check is cut for life. Wait past full retirement age and it grows 8% for each year, up to 70. Every amount is in today's dollars and rises with inflation once it starts." /></h2>
            {married ? (
              <div className="flex gap-3.5 text-label text-muted-foreground max-sm:hidden">
                <span><i className="mr-1.25 inline-block size-2.25 rounded-xs bg-primary" />You</span>
                <span><i className="mr-1.25 inline-block size-2.25 rounded-xs bg-series-sky/30" />Spouse</span>
              </div>
            ) : null}
          </div>
          <div ref={stairs} className="grid h-75 grid-cols-9 items-end gap-1.5 max-sm:h-57.5 max-sm:gap-0.75" role="radiogroup" aria-label="Claiming age" id="ssStairs"
            onKeyDown={(e) => {
              const d = ({ ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 } as Record<string, number>)[e.key];
              if (d) { e.preventDefault(); go(Math.max(62, Math.min(70, c + d))); }
            }}>
            {S.rows.map((r) => {
              const on = r.age === c;
              return (
                <button key={r.age} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} data-age={r.age} onClick={() => go(r.age)}
                  aria-label={`Claim at ${r.age}: ${money(r.monthly)} per month`}
                  className="group relative flex h-full cursor-pointer flex-col justify-end rounded-lg border-0 bg-transparent p-0 text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ring">
                  <span className="flex h-5 items-end justify-center">
                    {r.age === S.best.age ? <Badge variant="positive"><CheckIcon />{narrow ? "Best" : "Most by " + S.you.through}</Badge> : null}
                  </span>
                  <span className={cn("mt-1 mb-1.5 text-center text-note font-medium whitespace-nowrap text-muted-foreground group-hover:text-foreground max-sm:text-fine", on && "text-aside font-semibold text-foreground")}>
                    {narrow ? "$" + (r.monthly / 1000).toFixed(1) + "k" : money(r.monthly)}
                  </span>
                  <span className="flex h-(--h) flex-col-reverse overflow-hidden rounded-t-md rounded-b-xs" style={{ "--h": Math.max(4, (r.monthly / max) * (narrow ? 140 : 196)).toFixed(1) + "px" } as React.CSSProperties}>
                    <span className={cn("grow-(--g) basis-0", on ? "bg-primary" : "bg-muted-foreground/35 group-hover:bg-muted-foreground/50")} style={{ "--g": r.mine } as React.CSSProperties} />
                    {married ? <span className="grow-(--g) basis-0 border-b-2 border-card bg-series-sky/30" style={{ "--g": r.theirs } as React.CSSProperties} /> : null}
                  </span>
                  <span className={cn("mt-2 text-center text-body font-semibold max-sm:text-note", on && "text-primary")}>{r.age}</span>
                  <span className="text-center text-label text-muted-foreground max-sm:text-fine">{pct(r.factor)}</span>
                  {r.age === fra ? <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-fine tracking-wide whitespace-nowrap text-muted-foreground">FULL AGE</span> : null}
                </button>
              );
            })}
          </div>
          <div className="h-6.5" />
        </div>

        <div className="flex min-w-0 flex-col justify-center gap-3.5 px-5 py-4.5 max-lg:order-1" data-readout>
          <div data-pair>
            <div className="text-label text-muted-foreground" data-k>{married ? `Per month for both of you, you claiming at ${c}` : `Per month, claiming at ${c}`}</div>
            <BigValue className="mt-1 leading-none font-medium tracking-tight whitespace-nowrap text-primary tabular-nums" id="ssMonthly" text={S.you.pia > 0 ? money(S.monthly) : DASH} scale={narrow ? 1.5 : 2} />
            <div className="mt-1.5 text-label text-muted-foreground">
              {married ? `${money(S.monthlyYou)} yours, ${money(S.monthlySpouse)} your spouse's at ${S.spouse!.claim}. Today's dollars.` : "In today's dollars. Rises with inflation every year."}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3.5 border-t border-border pt-3.5">
            <div data-pair><div className="text-label text-muted-foreground" data-k>Per year</div>
              <BigValue className="mt-0.75 text-3xl leading-tight font-medium tabular-nums max-sm:text-2xl" id="ssYear" text={money(S.monthly * 12)} sized={false} /></div>
            <div data-pair><div className="text-label text-muted-foreground" data-k>{married ? "Total, both lifetimes" : `Total by ${S.you.through}`}</div>
              <BigValue className="mt-0.75 text-3xl leading-tight font-medium tabular-nums max-sm:text-2xl" id="ssTotal" text={money(S.H.total)} sized={false} /></div>
          </div>
          {married && S.H.spouse ? (
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-t border-border pt-3" id="ssSurvivor">
              <span className="flex items-center gap-1.25 text-note text-muted-foreground">Survivor benefit<TipDot k="" text="When one spouse passes away, the other keeps the larger of your two checks, including any credits for waiting, and the smaller one stops. So the household drops to one check, and that check is whichever was bigger. Waiting to claim the bigger check raises it for as long as either of you lives." /></span>
              <span className="text-right text-xl font-semibold tabular-nums">{money(S.survivor)}/mo</span>
              <span className="mt-0.5 basis-full text-label text-muted-foreground">
                After the first of you passes away, the other keeps {S.H.you.laterMonthly >= S.H.spouse.laterMonthly ? "your" : "your spouse's"} check, in place of {money(S.monthly)} for both.
              </span>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-1.5 text-note">
            {c > 62 ? <span className="rounded-full bg-muted px-2.5 py-0.75">vs. 62: <b className="font-semibold">+{money(ch.own - r62.own)}</b> per month</span> : null}
            {c < 70 ? <span className="rounded-full bg-muted px-2.5 py-0.75">vs. 70: <b className="font-semibold">−{money(r70.own - ch.own)}</b> per month</span> : null}
            {S.best.age !== c ? <span className="rounded-full bg-muted px-2.5 py-0.75">Claiming at {S.best.age} collects <b className="font-semibold">{money(S.best.total - ch.total)}</b> more by {S.you.through}</span> : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-stretch gap-2 border-t border-border px-4.5 pt-3 pb-3.5 max-sm:grid max-sm:grid-cols-2" id="ssFormula">
        <span className="mr-1.5 self-center text-note font-semibold max-sm:col-span-2">How it&apos;s figured</span>
        {S.you.career ? (
          <>
            <Link label="Average pay, best 35 years" tip={`Your pay each year in today's wages, capped at ${money(cap)}, the best 35 years averaged per month. ${S.you.years} years of pay count${S.you.years < 35 ? `, so ${35 - S.you.years} zeros are averaged in` : ""}.`}>
              {money(S.you.aime)}<span className="text-label font-normal text-muted-foreground">/mo</span>
            </Link>
            <Op>→</Op>
            <Link label={`Full benefit at ${fraLabel(S.you.fra)}`} tip={`90% of the first ${money(bend1)} of that average, 32% of it up to ${money(bend2)}, and 15% above. The formula favors lower earners on purpose.`}>{money(S.you.pia)}</Link>
          </>
        ) : (
          <Link label={`Full benefit at ${fraLabel(S.you.fra)}, from statement`} tip="The figure on your Social Security statement.">{money(S.you.pia)}</Link>
        )}
        <Op>×</Op>
        <Link label={`Claiming at ${c}, ${when}`} tip={early > 0 ? "Cut 5/9 of 1% for each of the first 36 months early, and 5/12 of 1% for each month beyond. The cut is permanent." : early < 0 ? "Raised 2/3 of 1% for each month past full retirement age (8% per year), up to 70." : "No cut and no credit: this is the full benefit."}>{pct(ch.factor)}</Link>
        {S.H.top1 > 0 ? <><Op>+</Op><Link label="Spousal top-up" tip="Half your spouse's full benefit, less your own, cut if you claim early. It starts once both of you have claimed.">{money(S.H.top1)}</Link></> : null}
        <Op>=</Op>
        <div className="flex min-w-0 flex-col justify-center rounded-lg border border-border bg-muted px-2.75 py-1.5">
          <span className="text-label text-muted-foreground">Your check</span>
          <span className="text-body font-semibold whitespace-nowrap tabular-nums">{money(S.monthlyYou)} <span className="text-label font-normal text-muted-foreground">per month</span></span>
        </div>
      </div>
    </Card>
  );
}
function Link({ label, tip, children }: { label: string; tip: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col justify-center rounded-lg border border-border bg-background px-2.75 py-1.5">
      <span className="flex items-center gap-1.25 text-label text-muted-foreground sm:whitespace-nowrap">{label}<TipDot k="" text={tip} /></span>
      <span className="flex flex-wrap items-baseline text-body font-semibold whitespace-nowrap tabular-nums">{children}</span>
    </div>
  );
}
const Op = ({ children }: { children: React.ReactNode }) => <span className="self-center px-px text-base text-muted-foreground max-sm:hidden" aria-hidden="true">{children}</span>;

/* ---------- facts ---------- */
function Facts({ S }: { S: SocialFigures }) {
  const yr = S.monthly * 12;
  const items: [string, string, string, string][] = [
    ["Full retirement age", fraLabel(S.you.fra), "Born " + S.you.birth, "The age your full benefit starts. Claim before it and the check is cut for life; wait past it and it grows 8% per year until 70."],
    ["Taxed as income", pct(S.taxedShare), money(S.taxedShare * yr) + " per year", "The share of your yearly benefit counted as federal taxable income, set by your other income. The rest is tax-free. Most states don't tax Social Security."],
    ["Checks start in", String(S.you.birth + S.you.claim), Math.max(0, S.you.birth + S.you.claim - NEWEST_YEAR) + " years from now", "The calendar year you turn your claiming age."],
    S.married
      ? ["Survivor benefit", money(S.survivor) + "/mo", "For whichever of you lives longer", "When one spouse passes away, the other keeps the larger of your two checks, including any credits for waiting, and the smaller one stops. Waiting to claim the bigger check raises it."]
      : ["Years of checks", String(S.you.through - S.you.claim), S.you.claim + " to " + S.you.through, "How many years of checks the totals count, from your claiming age to the age you expect to live to."],
  ];
  return (
    <Card size="flush" className="min-w-0 overflow-hidden" id="ssFacts">
      <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
        {items.map(([l, v, n, t]) => (
          <div key={l} className="min-w-0 bg-card px-4.5 py-3.25" data-pair>
            <div className="flex items-center gap-1.25 text-label text-muted-foreground" data-k>{l}<TipDot k="" text={t} /></div>
            <div className="mt-0.5 text-xl font-semibold tracking-tight tabular-nums">{v}</div>
            <div className="mt-0.5 text-label text-muted-foreground">{n}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------- a couple: every pair of claiming ages ---------- */
function Pairs({ S, narrow, use }: { S: SocialFigures; narrow: boolean; use: (a: number, b: number) => void }) {
  const P = S.pairs!, span = Math.max(1, P.best.total - P.min), more = P.best.total - P.chosen;
  const bigYou = S.H.spouse ? S.H.you.laterMonthly >= S.H.spouse.laterMonthly : true;
  return (
    <Card size="flush" className="min-w-0" id="ssPairs">
      <div className="grid grid-cols-1 lg:grid-cols-3">
        <div className="min-w-0 border-border px-4.5 pt-3.5 pb-4 max-lg:border-b lg:col-span-2 lg:border-r">
          <h2 className="m-0 mb-2.5 flex items-center gap-1.5 text-aside font-semibold">Best ages for the two of you<TipDot k="" text="Every pair of claiming ages, with what the two of you collect in all through the ages you expect to live to, in today's dollars, before tax. Each square shows how far that pair falls short of the best one. Click a square to use those ages." /></h2>
          {narrow ? <p className="m-0 mb-2 text-label text-muted-foreground">Thousands of dollars short of the best pair.</p> : null}
          <div className="grid grid-cols-10 gap-0.75 text-xs max-sm:gap-0.5" role="grid" aria-label="Household total for each pair of claiming ages">
            <div className="self-end pb-1 text-fine leading-tight text-muted-foreground max-sm:invisible max-sm:h-0 max-sm:overflow-hidden">You claim ↓<br />Spouse →</div>
            {CLAIM_AGES.map((b) => <div key={b} className="grid place-items-center text-label text-muted-foreground">{b}</div>)}
            {CLAIM_AGES.map((a, i) => (
              <Row key={a} a={a} i={i} P={P} span={span} narrow={narrow} S={S} use={use} />
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-center gap-3 px-5 py-4.5">
          <div data-pair>
            <div className="text-label text-muted-foreground" data-k>Collects the most</div>
            <div className="mt-0.75 text-3xl leading-tight font-medium tracking-tight max-sm:text-2xl" id="ssPairBest">You at {P.best.you}, spouse at {P.best.spouse}</div>
            <div className="text-label text-muted-foreground">{more >= 1 ? `${money(P.best.total)} in all: ${money(more)} more than ${S.you.claim} and ${S.spouse!.claim}` : `${money(P.best.total)} in all. These are your ages.`}</div>
          </div>
          {more >= 1 ? <div><Button variant="outline" size="sm" onClick={() => use(P.best.you, P.best.spouse)}>Use these ages</Button></div> : null}
          <div className="border-t border-border pt-3 text-note text-muted-foreground">
            {P.best.you !== P.best.spouse
              ? `${bigYou ? "Your" : "Your spouse's"} check is the bigger one. Whoever lives longer keeps it, so waiting on it pays off for as long as either of you lives.`
              : "Both of you do best claiming at the same age with these lifespans. Try other ages you expect to live to."}
          </div>
        </div>
      </div>
    </Card>
  );
}
function Row({ a, i, P, span, narrow, S, use }: { a: number; i: number; P: NonNullable<SocialFigures["pairs"]>; span: number; narrow: boolean; S: SocialFigures; use: (a: number, b: number) => void }) {
  return (
    <>
      <div className="grid items-center pl-0.5 text-label text-muted-foreground">{narrow ? a : "You " + a}</div>
      {CLAIM_AGES.map((b, j) => {
        const t = P.grid[i][j], d = P.best.total - t, on = a === S.you.claim && b === S.spouse!.claim, best = a === P.best.you && b === P.best.spouse;
        return (
          <button key={b} type="button" onClick={() => use(a, b)} aria-label={`You at ${a}, spouse at ${b}: ${money(t)} in all`} title={`You at ${a}, spouse at ${b}: ${money(t)} in all${d >= 1 ? `, ${money(d)} less than the best` : ", the most"}`}
            className={cn("relative grid h-8 cursor-pointer place-items-center overflow-hidden rounded-md border-0 bg-transparent p-0 whitespace-nowrap text-foreground tabular-nums outline-none hover:outline hover:outline-muted-foreground focus-visible:outline-2 focus-visible:outline-ring max-sm:h-7 max-sm:text-fine",
              on && "font-semibold outline-2 -outline-offset-1 outline-primary hover:outline-2 hover:outline-primary")}>
            <span className="absolute inset-0 bg-series-sky opacity-(--t)" style={{ "--t": (0.06 + ((t - P.min) / span) * 0.5).toFixed(2) } as React.CSSProperties} aria-hidden="true" />
            <span className={cn("relative", best && "font-semibold text-gain")}>{d < 1 ? (narrow ? "Best" : "Most") : "−" + (narrow ? Math.round(d / 1000) : k(d))}</span>
          </button>
        );
      })}
    </>
  );
}

/* ---------- the best age by lifespan ---------- */
function Lifespan({ S, setThrough }: { S: SocialFigures; setThrough: (v: string) => void }) {
  const x = (a: number) => (((a - 70) / 31) * 100).toFixed(2) + "%";
  const t = Math.max(70, Math.min(100, S.you.through));
  return (
    <Card className="min-w-0" id="ssLifespan">
      <CardHeader><CardTitle>Best age, by how long you live<TipDot k="" text="The claiming age that collects the most in all if you live to each age, in today's dollars, before tax. A 65-year-old today lives to about 84 on average; in a couple, one of the two usually passes 90." /></CardTitle></CardHeader>
      <CardContent>
        <div className="relative">
          <div className="mt-6 flex h-10 gap-0.5 overflow-hidden rounded-lg" role="img" aria-label={"Best claiming age by lifespan: " + S.wins.map((w) => `live to ${w.from} to ${w.to}, claim at ${w.claim}`).join("; ")}>
            {S.wins.map((w) => (
              // The shade deepens with the claiming age but stops at half
              // strength, where the label still reads at 4.5:1 in dark mode.
              <div key={w.from} className="relative grid min-w-0 grow-(--n) basis-0 place-items-center overflow-hidden text-xs font-semibold whitespace-nowrap"
                style={{ "--n": w.to - w.from + 1 } as React.CSSProperties}>
                <span className="absolute inset-0 bg-series-sky opacity-(--t)" style={{ "--t": (0.1 + ((w.claim - 62) / 8) * 0.4).toFixed(2) } as React.CSSProperties} aria-hidden="true" />
                <span className="relative">{w.to - w.from >= 3 ? "Claim at " + w.claim : w.claim}</span>
              </div>
            ))}
          </div>
          <div className="relative h-4.5 text-fine text-muted-foreground">
            {[70, 75, 80, 85, 90, 95, 100].map((a) => (
              <span key={a} className="absolute top-0.75 left-(--x) -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ "--x": a === 100 ? "100%" : x(a) } as React.CSSProperties}>{a}</span>
            ))}
          </div>
          <div className="pointer-events-none absolute top-6 bottom-4.5 left-(--x) w-0.5 -translate-x-px bg-foreground" style={{ "--x": x(t + .5) } as React.CSSProperties}>
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-card px-1 text-label font-semibold whitespace-nowrap">Live to {t}</span>
          </div>
        </div>
        <label className="mt-2 block">
          <span className="text-label text-muted-foreground">Live to age <b className="text-foreground">{t}</b></span>
          <NativeRange min={70} max={100} value={t} onChange={(e) => setThrough(e.target.value)} aria-label="Live to age" />
        </label>
        <div className="mt-2.5">
          {S.breakEvens.map((b) => <KV key={b.a + "-" + b.b} k={`Claiming at ${b.b} beats ${b.a} if you live past`} v={b.at ? "age " + Math.ceil(b.at) : "never"} />)}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- when waiting pays off ---------- */
function Race({ S }: { S: SocialFigures }) {
  const end = 95, c = S.you.claim, fra = Math.round(S.you.fra);
  const ages = [...new Set([62, fra, 70, c])].sort((a, b) => a - b);
  const color = (a: number) => a === c ? SERIES.plan : a === 62 ? SERIES.sky : a === 70 ? SERIES.lavender : SERIES.teal;
  const series = ages.map((a) => ({ name: "Claim at " + a + (a === c ? " (yours)" : ""), color: color(a), width: a === c ? 3 : 2, pts: cumulative(S.you, a, end) }));
  const marks = S.breakEvens.filter((b) => b.at && b.at < end).map((b) => ({ x: Math.round((b.at! - 62) * 10) / 10, label: String(Math.ceil(b.at!)) }));
  return (
    <Card className="min-w-0" id="ssRace">
      <CardHeader><CardTitle>When waiting pays off<TipDot k="" text="Your own checks added up from each claiming age. A later claim starts behind and catches up; where the lines cross is the break-even age, marked on the chart. Live past it and waiting paid off. Hover or touch the chart to read any age." /></CardTitle></CardHeader>
      {S.you.pia > 0 ? (
        <>
          <MultiChart id="SsRace" half series={series} maxX={end - 62} marks={marks} ariaLabel="Your own checks added up by claiming age"
            xFmt={(x) => x + 62} head={(y) => <b>Collected by age {y + 62}</b>} />
          <Legend id="legendSsRace" items={series.map((x) => [x.color, x.name] as [string, string])} />
        </>
      ) : <CardContent><p className="m-0 text-note text-muted-foreground">Enter your pay or your statement&apos;s benefit to see it.</p></CardContent>}
    </Card>
  );
}
