"use client";

/* Social Security Claiming: what the benefit is at every age from 62 to
   70, for one person or a couple, what each choice adds up to over a
   lifetime, where the choices cross, which age wins for each lifespan, and
   whether claiming early and investing the checks has beaten waiting in
   market history since 1926.

   Laid out answer-first, in Basic's thirds: the inputs a third, each
   person in a group; then one reading whose hero is the monthly benefit at
   the claiming age chosen, with the lifetime total and the best age beside
   it. Every claiming age follows as a table, then the benefits added up on
   one chart with the break-even ages under it, the lifespan strip, and the
   claim-early-and-invest test with its own fan. On a phone a compact
   reading leads and stays pinned. */

import { useRef, useState } from "react";
import { ChevronDownIcon, InfoIcon } from "lucide-react";
import { BandChart } from "@/components/charts/BandChart";
import { Legend, McLegend } from "@/components/charts/Legend";
import { MultiChart } from "@/components/charts/MultiChart";
import { FanTipRows } from "@/components/charts/TipRows";
import { useHouseholdFill } from "@/components/household/HouseholdProvider";
import { Field, MoneyField, NumberField, SelectField } from "@/components/fields/Field";
import { Tipped, TipDot } from "@/components/shell/Tooltips";
import { useShareKit } from "@/components/shell/share";
import { useToolState } from "@/components/tools/ToolState";
import { CsvButton } from "@/components/common/CsvButton";
import { KV, Segmented } from "@/components/common/Readout";
import { HeroReading, PinnedReading, type ReadingFigure } from "@/components/common/Reading";
import { DASH, dollarsField, fmtNum, money, parseNum, pctStr } from "@/lib/format";
import { SERIES } from "@/lib/hues";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ageRows, breakEvens, careerPia, CLAIM_AGES, fraLabel, household, investEarly, SOCIAL_DEF, socialInput, taxedShare, winsByLifespan, type SocialInputs } from "./model";
import { CareerDialog } from "./CareerDialog";

const two = "two bottomalign max-sm:grid-cols-2";
const age1 = (a: number) => (Math.abs(a - Math.round(a)) < 0.05 ? String(Math.round(a)) : a.toFixed(1));

function GroupHead({ children }: { children: React.ReactNode }) {
  return <h3 className="m-0 mt-1 mb-3 border-t border-border pt-4 text-sm font-semibold">{children}</h3>;
}

/** A line in the reading that isn't a figure. */
function Band({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <div id={id} className="flex items-start gap-2 border-t border-border px-5.5 py-3.5 text-body text-foreground max-sm:px-4">
      <InfoIcon className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <p className="m-0 max-w-copy">{children}</p>
    </div>
  );
}

/** One person's inputs: who they are, their benefit and their choices. */
function PersonFields({ k, s, set, label }: { k: "1" | "2"; s: SocialInputs; set: <K extends keyof SocialInputs>(k: K) => (v: SocialInputs[K]) => void; label: string }) {
  const p = socialInput(s)[k === "1" ? "you" : "spouse"]!;
  const est = s[`src${k}`] === "estimate";
  const who = k === "1" ? "Your" : "Spouse's";
  const [mapping, setMapping] = useState(false);
  const car = s[`career${k}`], years = p.career ?? [];
  const counted = years.length ? careerPia(years).years : 0;
  const edits = Object.values(car.edits).filter((v) => v !== "").length;
  return (
    <>
      <GroupHead>{label}</GroupHead>
      <div className={two}>
        <NumberField id={`ssBirth${k}`} label={<Tipped text="Year of birth" k="ssbirth" />} max={2100} value={s[`birth${k}`]} onValueChange={set(`birth${k}`)} aria-label={`${who} year of birth`} />
        <div className="field">
          <span className="mb-1.5 block text-sm font-medium text-foreground"><Tipped text="Full retirement age" k="ssfra" /></span>
          <div className="flex h-9 items-center text-body tabular-nums" id={`ssFra${k}`}>{fraLabel(p.fra)}</div>
        </div>
      </div>
      <div className="field mb-3.5">
        <Segmented id={`segSsSrc${k}`} size="compact" attr="data-src" options={[["statement", "From my statement"], ["estimate", "Estimate it"]] as const}
          value={s[`src${k}`]} onChange={set(`src${k}`)} />
      </div>
      {est ? (
        <>
          <MoneyField id={`ssInc${k}`} label={<Tipped text="Pay today, per year" k="sspay" />} unit="/yr" value={s[`inc${k}`]} onValueChange={set(`inc${k}`)} aria-label={`${who} pay today, per year`} />
          <div className="derived -mt-1 mb-3.5">
            <div><span>Career</span><span className="num">{car.start} to {car.stop}{edits ? ", " + fmtNum(edits) + " by hand" : ""}</span></div>
            <div><span>Raises above wage growth</span><span className="num">{car.growPast}% so far, {car.growAhead}% ahead</span></div>
            <div><span>At full retirement age</span><span className="num" id={`ssEst${k}`}>{money(p.pia)}/mo{counted < 35 ? ", " + fmtNum(counted) + " of 35 years" : ""}</span></div>
          </div>
          <Button variant="outline" size="sm" className="-mt-1 mb-3.5" onClick={() => setMapping(true)}>Map out {k === "1" ? "your" : "their"} pay, year by year</Button>
          {mapping ? <CareerDialog who={k === "1" ? "Your" : "Your spouse's"} career={car} ageNow={p.ageNow} incomeNow={parseNum(s[`inc${k}`])} fra={p.fra}
            apply={set(`career${k}`)} onClose={() => setMapping(false)} /> : null}
        </>
      ) : (
        <MoneyField id={`ssPia${k}`} label={<Tipped text="Monthly benefit at full retirement age" k="sspia" />} unit="/mo" value={s[`pia${k}`]} onValueChange={set(`pia${k}`)} aria-label={`${who} monthly benefit at full retirement age`} />
      )}
      <div className={two}>
        <SelectField id={`ssClaim${k}`} label="Claim at" value={s[`claim${k}`]} onChange={set(`claim${k}`)} aria-label={`${who} claiming age`}>
          {CLAIM_AGES.map((a) => <option key={a} value={String(a)}>{a}{Math.abs(a - p.fra) < 0.01 ? " (full)" : ""}</option>)}
        </SelectField>
        <NumberField id={`ssThrough${k}`} label={<Tipped text="Plan through age" k="ssthrough" />} unit="age" max={110} value={s[`through${k}`]} onValueChange={set(`through${k}`)} aria-label={`${who} age planned through`} />
      </div>
      {p.claim < p.fra ? (
        <MoneyField id={`ssEarn${k}`} label={<Tipped text={"Still working at " + p.claim + "? Pay per year, until full retirement age"} k="ssearn" />} unit="/yr" value={s[`earn${k}`]} onValueChange={set(`earn${k}`)} aria-label={`${who} pay per year while claiming before full retirement age`} />
      ) : null}
    </>
  );
}

export function Social() {
  const { state: s, set, setState } = useToolState(SOCIAL_DEF);
  const tableRef = useRef<HTMLTableElement>(null);

  useHouseholdFill("social", s, setState, (h, c) => {
    const next: SocialInputs = { ...c };
    const year = new Date().getFullYear();
    if (h.status) next.status = h.status;
    if (h.age != null && h.age > 0 && h.age < 120) next.birth1 = String(year - Math.round(h.age));
    if (h.status === "m" && h.spouseAge != null && h.spouseAge > 0 && h.spouseAge < 120) next.birth2 = String(year - Math.round(h.spouseAge));
    if (h.income != null && h.income > 0) next.inc1 = dollarsField(h.income);
    if (h.status === "m" && h.income2 != null && h.income2 > 0) next.inc2 = dollarsField(h.income2);
    return next;
  });

  const p = socialInput(s);
  const married = p.married;
  const ready = p.you.pia > 0 || (!!p.spouse && p.spouse.pia > 0);
  const H = household(p);
  const { rows, best1, best2 } = ageRows(p);
  const chosen = rows.find((r) => r.age === p.you.claim)!;
  const bestRow = rows.find((r) => r.age === best1)!;
  const bes = breakEvens(p.you);
  const wins = winsByLifespan(p);
  const I = investEarly(p);
  const fraYou = Math.round(p.you.fra);

  // The household's monthly check once everyone has claimed: each person's
  // own benefit at their claiming age, and the lower earner's top-up.
  const monthlyYou = H.you.monthly + H.top1;
  const monthlySpouse = H.spouse ? H.spouse.monthly + H.top2 : 0;
  const monthly = monthlyYou + monthlySpouse;
  const taxed = taxedShare(p, monthly * 12);
  const better = bestRow.lifetime - chosen.lifetime;

  // Benefits added up by your age, for 62, full retirement age, 70 and the
  // age chosen when it's another.
  const chartAges = [...new Set([62, fraYou, 70, p.you.claim])].sort((a, b) => a - b);
  const chartColor = (a: number) => (a === p.you.claim ? SERIES.plan : a === 62 ? SERIES.sky : a === 70 ? SERIES.lavender : SERIES.teal);
  const x0 = 62;
  const series = chartAges.map((a) => {
    const h = household(p, a);
    return { name: "Claim at " + a + (a === p.you.claim ? " (yours)" : ""), color: chartColor(a), width: a === p.you.claim ? 3 : 2,
      pts: [{ year: h.firstYear - x0, value: 0 }, ...h.rows.map((r) => ({ year: r.age + 1 - x0, value: r.cum }))] };
  });
  const maxX = H.lastYear - x0;

  useShareKit(SOCIAL_DEF.id, {
    card: () => ready ? {
      title: "Social Security", sub: married ? "Claiming at " + p.you.claim + " and " + p.spouse!.claim : "Claiming at " + p.you.claim,
      bigLabel: "A month, in today's dollars", big: money(monthly),
      rows: [
        ["Through age " + p.you.through, money(H.total)],
        ["Best age for you", String(best1)],
        ...(bes[0].at ? [["62 vs. " + age1(bes[0].b) + " break-even", "age " + age1(bes[0].at)] as [string, string]] : []),
      ],
    } : "Enter a benefit to make a card",
  });

  const hero: ReadingFigure = {
    label: married ? "Household benefit a month, both claimed" : "Your benefit a month, claiming at " + p.you.claim,
    id: "ssMonthly", value: ready ? money(monthly) : DASH,
    note: ready ? (married ? money(monthlyYou) + " yours at " + p.you.claim + ", " + money(monthlySpouse) + " your spouse's at " + p.spouse!.claim + ", in today's dollars" : "In today's dollars, rising with inflation") : "",
  };
  const figures: ReadingFigure[] = [
    { label: "All benefits through age " + p.you.through + (married ? " and " + p.spouse!.through : ""), id: "ssLifetime", value: ready ? money(H.total) : DASH,
      note: ready ? (married ? "Both of you, survivor years included" : "In today's dollars") : "" },
    { label: <span className="tipglue">Best age for you<TipDot k="ssbest" /></span>, id: "ssBest", value: ready ? String(best1) : DASH,
      note: ready ? (better > 1 ? "+" + money(better) + " over claiming at " + p.you.claim : "The age you chose") : "" },
  ];

  return (
    <div className="col-span-full grid grid-cols-1 items-start gap-5 max-sm:gap-3.5 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-1 lg:self-stretch">
        <PinnedReading main={{ label: "A month, claiming at " + p.you.claim, value: hero.value }} side={{ label: "Best age", value: figures[1].value }} />

        <aside id="asideSocial" className="max-lg:static max-lg:max-h-none max-lg:overflow-visible">
          <Card>
            <CardContent>
              <div className="field mb-3.5">
                <Segmented id="segSsStatus" attr="data-status" options={[["s", "Just me"], ["m", "Married"]] as const} value={s.status} onChange={set("status")} />
              </div>
              <PersonFields k="1" s={s} set={set} label="You" />
              {married ? <PersonFields k="2" s={s} set={set} label="Your spouse" /> : null}

              <GroupHead>Taxes and investing</GroupHead>
              <MoneyField id="ssOther" label={<Tipped text="Other income per year, in retirement" k="ssother" />} unit="/yr" value={s.other} onValueChange={set("other")} />
              <Field id="ssMix" label={<Tipped text="Stock share, if you invest the checks" k="ssmix" />}>
                <NumberField id="ssMix" label="" unit="%" step={5} max={100} value={s.mix} onValueChange={set("mix")} />
              </Field>
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="stack min-w-0 lg:col-span-2" id="tab-social">
        <Card size="flush" className="min-w-0" id="ssReading">
          <HeroReading tone={ready ? "answer" : "text"} sized={ready} hero={hero} figures={figures} />
          {!ready ? <Band id="ssEmpty">Enter the monthly benefit from your Social Security statement, or an income to estimate one.</Band> : null}
          {ready && married && H.survivorAt !== null ? (
            <Band id="ssSurvivor">
              {H.survivorAt === p.you.through
                ? <>If you die first, at {fmtNum(p.you.through)}, your spouse keeps <b>{money(H.survivor)}</b> a month: the larger of your two checks, your delayed credits included.</>
                : <>If your spouse dies first, at {fmtNum(p.spouse!.through)}, you keep <b>{money(H.survivor)}</b> a month: the larger of your two checks.</>}
            </Band>
          ) : null}
          <div className="border-t border-border px-4.5 pt-3.5 pb-4 max-sm:px-3.5" hidden={!ready}>
            <div className="grid2">
              <div>
                <KV k={<span className="tipglue">Taxed as income<TipDot k="sstaxed" /></span>} id="ssTaxed" v={ready ? pctStr(taxed, 0) + " of it" : DASH} />
                <KV k="Your full retirement age" id="ssKVFra" v={fraLabel(p.you.fra)} />
                {married ? <KV k="Spouse's full retirement age" id="ssKVFra2" v={fraLabel(p.spouse!.fra)} /> : null}
              </div>
              <div>
                <KV k={"Your benefit at " + p.you.claim + ", a month"} id="ssKVYou" v={money(H.you.monthly)} />
                {married && H.top1 > 0 ? <KV k="Spousal top-up, a month" id="ssKVTop1" v={money(H.top1)} /> : null}
                {married ? <KV k={"Spouse's benefit at " + p.spouse!.claim + ", a month"} id="ssKVSp" v={money(H.spouse!.monthly)} /> : null}
                {married && H.top2 > 0 ? <KV k="Spouse's top-up, a month" id="ssKVTop2" v={money(H.top2)} /> : null}
                {H.you.withheld > 0 ? <KV k={"Withheld per year until " + fraLabel(p.you.fra)} id="ssKVHeld" cls="neg" v={money(H.you.withheld)} /> : null}
                {H.you.withheld > 0 ? <KV k="Your benefit from full retirement age" id="ssKVLater" v={money(H.you.laterMonthly)} /> : null}
              </div>
            </div>
            {H.you.withheld > 0 ? (
              <p className="hint m-0 mt-2 max-w-copy">Earning {money(p.you.earn)} per year before full retirement age, Social Security holds back $1 of every $2 over the limit. Those months are credited back at full retirement age, so the benefit rises then.</p>
            ) : null}
          </div>
        </Card>

        <Card className="min-w-0" hidden={!ready}>
          <CardHeader>
            <CardTitle>Every claiming age</CardTitle>
            <CardDescription>Each person&apos;s own check at each age, and what the household collects in all{married ? " when one of you claims then and the other as set" : ""}.</CardDescription>
            <CardAction><CsvButton table={tableRef} label="Every claiming age" /></CardAction>
          </CardHeader>
          <div className="swipehint">Swipe the table sideways to see every column.</div>
          <div className="scroll max-h-none">
            <table id="ssTable" ref={tableRef}>
              <thead>
                <tr>
                  <th>Claim at</th><th>{married ? "Your check" : "A month"}</th>
                  {married ? <th>Spouse&apos;s check</th> : null}
                  <th>{married ? "In all, you claim then" : "In all, through " + p.you.through}</th>
                  {married ? <th>In all, spouse claims then</th> : null}
                  <th>vs. the best</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const d = r.lifetime - bestRow.lifetime;
                  return (
                    <tr key={r.age} className={cn(r.age === p.you.claim && "font-semibold")}>
                      <td>{r.age}{r.age === fraYou ? <span className="ml-1.5 text-muted-foreground font-normal">full</span> : null}
                        {r.age === best1 ? <Badge variant="positive" className="ml-1.5 align-middle">Best for you</Badge> : null}
                        {married && r.age === best2 ? <Badge variant="highlight" className="ml-1.5 align-middle">Best for spouse</Badge> : null}</td>
                      <td>{money(r.you)}</td>
                      {married ? <td>{money(r.spouse)}</td> : null}
                      <td>{money(r.lifetime)}</td>
                      {married ? <td>{money(r.lifetimeSpouse)}</td> : null}
                      <td className={d < -1 ? "neg" : undefined}>{d < -1 ? "−" + money(-d) : DASH}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="min-w-0" hidden={!ready}>
          <CardHeader>
            <CardTitle>Benefits added up</CardTitle>
            <CardDescription>Everything collected so far at each age, for the main choices. Where two lines cross is the break-even age.</CardDescription>
          </CardHeader>
          <MultiChart id="SsCum" series={series} maxX={maxX} ariaLabel="Cumulative Social Security benefits by claiming age" xFmt={(x) => x + x0}
            head={(y) => <b>Age {y + x0}</b>} />
          <Legend id="legendSsCum" items={series.map((x) => [x.color, x.name] as [string, string])} />
          <div className="border-t border-border px-4.5 pt-3.5 pb-4 max-sm:px-3.5">
            <div className="grid2">
              <div>
                {bes.slice(0, 2).map((b) => (
                  <KV key={b.a + "-" + b.b} k={"Waiting from " + age1(b.a) + " to " + age1(b.b) + " pays off from"} v={b.at ? "age " + age1(b.at) : "never"} />
                ))}
              </div>
              <div>
                {bes.slice(2).map((b) => (
                  <KV key={b.a + "-" + b.b} k={"Waiting from " + age1(b.a) + " to " + age1(b.b) + " pays off from"} v={b.at ? "age " + age1(b.at) : "never"} />
                ))}
              </div>
            </div>
            <p className="hint m-0 mt-2 max-w-copy">Your own check alone, in today&apos;s dollars, before tax{married ? ". The chart counts the household, survivor years included, so it can cross earlier or later" : ""}.</p>
          </div>
        </Card>

        <Card className="min-w-0" hidden={!ready}>
          <CardHeader>
            <CardTitle>Which age pays the most, by how long you live</CardTitle>
            <CardDescription>For each age you might live to, the claiming age that collects the most in all{married ? ", with your spouse as set" : ""}.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-10 w-full gap-px overflow-hidden rounded-md" role="img" aria-label={"Best claiming age by lifespan: " + wins.map((w) => w.claim + " from " + w.from + " to " + w.to).join(", ")}>
              {wins.map((w) => (
                <div key={w.from} className="relative flex min-w-0 flex-(--span) items-center justify-center bg-muted text-label font-medium text-foreground tabular-nums"
                  style={{ "--span": w.to - w.from + 1, "--tint": (12 + Math.round(((w.claim - 62) / 8) * 58)) / 100 } as React.CSSProperties}>
                  <span className="absolute inset-0 bg-series-sky opacity-(--tint)" aria-hidden="true" />
                  <span className="relative truncate px-0.5">{w.claim}</span>
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-label text-muted-foreground tabular-nums"><span>Live to 70</span><span>80</span><span>90</span><span>100</span></div>
            <p className="hint m-0 mt-1 max-w-copy">
              {wins.length > 1
                ? <>Claiming at {wins[0].claim} collects the most if you live to {wins[0].to} or less{wins.length > 2 ? ", and " + wins[wins.length - 1].claim + " from " + wins[wins.length - 1].from + " on" : "; " + wins[1].claim + " from " + wins[1].from + " on"}. A 65-year-old today lives to about 84 on average, and one of a couple is likely to pass 90.</>
                : <>Claiming at {wins[0].claim} collects the most at every lifespan from 70 to 100.</>}
            </p>
          </CardContent>
        </Card>

        <Card className="min-w-0" hidden={!ready}>
          <CardHeader>
            <CardTitle>Claim early and invest the checks</CardTitle>
            <CardDescription>Take it at {p.early}, invest every check, then from {p.late} draw the difference between the two checks. Does the pot last to {p.you.through}, in every market since 1926?</CardDescription>
            <CardAction>
              <span className="flex items-center gap-2">
                <SelectField id="ssEarly" label="" value={s.early} onChange={set("early")} aria-label="Claim early at">
                  {CLAIM_AGES.filter((a) => a < 70).map((a) => <option key={a} value={String(a)}>{a}</option>)}
                </SelectField>
                <span className="text-label text-muted-foreground">vs.</span>
                <SelectField id="ssLate" label="" value={s.late} onChange={set("late")} aria-label="Instead of waiting until">
                  {CLAIM_AGES.filter((a) => a > p.early).map((a) => <option key={a} value={String(a)}>{a}</option>)}
                </SelectField>
              </span>
            </CardAction>
          </CardHeader>
          {I.windows > 0 ? (
            <>
              <HeroReading tone={I.won / I.windows >= 0.5 ? "answer" : "loss"} className="pt-2"
                hero={{ label: "Retirements since 1926 where claiming at " + p.early + " came out ahead", id: "ssInvWon", value: pctStr(I.won / I.windows, 0),
                  note: fmtNum(I.won) + " of " + fmtNum(I.windows) + " starting years, " + money(I.benEarly / 12) + " a month from " + p.early + " against " + money(I.benLate / 12) + " from " + p.late + ", " + pctStr(p.mix, 0) + " stocks" }}
                figures={[
                  { label: "Left at " + p.you.through + ", median", id: "ssInvMed", value: money(I.median), note: "In today's dollars, after drawing the gap" },
                  { label: "Worst start", id: "ssInvWorst", value: money(I.worst), tone: I.worst < 0 ? "loss" : undefined,
                    note: I.firstOut ? "Ran out at " + I.firstOut + " at the earliest" : "Never ran out" },
                ]} />
              <BandChart id="SsInv" mode="mc" xOffset={p.early} pts={I.bands.map((b) => ({ year: b.year, base: b.p50, hi: b.p90, lo: b.p10, p25: b.p25, p75: b.p75 }))} maxX={I.years}
                ariaLabel="What the invested early checks are worth at each age, across every start year since 1926"
                tip={(b) => <><b>Age {b.year + p.early}</b><FanTipRows b={b} /></>} />
              <McLegend id="legendSsInv" noDet />
              <p className="hint m-0 max-w-copy px-4.5 pb-4">The pot grows from {p.early} to {p.late} on the checks alone, then pays out {money((I.benLate - I.benEarly) / 12)} a month to match the later claim. Real returns, that window&apos;s own inflation, the mix rebalanced yearly. Nothing here counts the survivor benefit or taxes on the checks.</p>
            </>
          ) : <Band>History is too short to run this comparison through age {p.you.through}.</Band>}
        </Card>

        <div className="min-w-0" hidden={!ready}>
          <Collapsible render={<Card />}>
            <CardHeader>
              <CardTitle><CollapsibleTrigger>Year by year<ChevronDownIcon aria-hidden="true" /></CollapsibleTrigger></CardTitle>
            </CardHeader>
            <CollapsibleContent keepMounted>
              <div className="scroll">
                <table id="ssYears">
                  <thead><tr><th>Your age</th>{married ? <th>Spouse&apos;s age</th> : null}<th>Yours</th>{married ? <th>Spouse&apos;s</th> : null}<th>Added up</th></tr></thead>
                  <tbody>
                    {H.rows.map((r) => (
                      <tr key={r.age}><td>{r.age}</td>{married ? <td>{r.age + p.gap}</td> : null}<td>{r.you > 0 ? money(r.you) : DASH}</td>{married ? <td>{r.spouse > 0 ? money(r.spouse) : DASH}</td> : null}<td>{money(r.cum)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );
}

