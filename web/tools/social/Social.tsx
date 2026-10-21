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
import { MoneyField, NumberField, SelectField } from "@/components/fields/Field";
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
import { ssClaimFactor } from "@/lib/engine/typed";
import { ageRows, breakEvens, CAREER_DEFAULT, careerPia, CLAIM_AGES, fraLabel, household, investEarly, SOCIAL_DEF, socialInput, taxedShare, winsByLifespan, type SocialInputs } from "./model";
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
function PersonFields({ k, s, set, label }: { k: "1" | "2"; s: SocialInputs; set: <K extends keyof SocialInputs>(k: K) => (v: SocialInputs[K]) => void; label: string | null }) {
  const p = socialInput(s)[k === "1" ? "you" : "spouse"]!;
  const est = s[`src${k}`] === "estimate";
  const who = k === "1" ? "Your" : "Spouse's";
  const [mapping, setMapping] = useState(false);
  // Inputs kept from before the career model have no career yet.
  const car = s[`career${k}`] ?? CAREER_DEFAULT, years = p.career ?? [];
  const counted = years.length ? careerPia(years).years : 0;
  const edits = Object.values(car.edits).filter((v) => v !== "").length;
  const early = p.claim < p.fra;
  return (
    <>
      {label ? <GroupHead>{label}</GroupHead> : null}
      <div className={two}>
        <NumberField id={`ssBirth${k}`} label={<Tipped text="Year of birth" k="ssbirth" />} max={2100} value={s[`birth${k}`]} onValueChange={set(`birth${k}`)} aria-label={`${who} year of birth`} />
        <SelectField id={`ssClaim${k}`} label="Claim at" value={s[`claim${k}`]} onChange={set(`claim${k}`)} aria-label={`${who} claiming age`}>
          {CLAIM_AGES.map((a) => <option key={a} value={String(a)}>{a}{Math.abs(a - p.fra) < 0.01 ? " (full)" : ""}</option>)}
        </SelectField>
      </div>
      <p className="hint -mt-1.5 mb-3.5 flex items-start gap-1.5" id={`ssFra${k}`}>
        <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>Full retirement age <b className="text-foreground">{fraLabel(p.fra)}</b>, from the birth year.{" "}
          {early ? <>Claiming at {p.claim} is <b className="text-foreground">{pctStr(1 - ssClaimFactor(p.claim, p.fra), 0)} less</b> than the full check.</>
            : p.claim > p.fra ? <>Claiming at {p.claim} is <b className="text-foreground">{pctStr(ssClaimFactor(p.claim, p.fra) - 1, 0)} more</b> than the full check.</>
            : <>That is the full check.</>}
          <TipDot k="ssfra" /></span>
      </p>
      <div className="field mb-3">
        <Segmented id={`segSsSrc${k}`} size="compact" attr="data-src" options={[["statement", "From my statement"], ["estimate", "Estimate it"]] as const}
          value={s[`src${k}`]} onChange={set(`src${k}`)} />
      </div>
      {est ? (
        <>
          <MoneyField id={`ssInc${k}`} label={<Tipped text="Pay today, per year" k="sspay" />} unit="/yr" value={s[`inc${k}`]} onValueChange={set(`inc${k}`)} aria-label={`${who} pay today, per year`} />
          <div className="derived -mt-1 mb-2.5">
            <div><span>Career</span><span className="num">{car.start} to {car.stop}{edits ? ", " + fmtNum(edits) + " by hand" : ""}</span></div>
            <div><span>Raises above wage growth</span><span className="num">{car.growPast}% so far, {car.growAhead}% ahead</span></div>
            <div><span>Check at full retirement age</span><span className="num" id={`ssEst${k}`}>{money(p.pia)}/mo{counted < 35 ? ", " + fmtNum(counted) + " of 35 years" : ""}</span></div>
          </div>
          <Button variant="outline" size="sm" className="mb-3.5 w-full" onClick={() => setMapping(true)}>Map out {k === "1" ? "your" : "their"} pay, year by year</Button>
          {mapping ? <CareerDialog who={k === "1" ? "Your" : "Your spouse's"} career={car} ageNow={p.ageNow} incomeNow={parseNum(s[`inc${k}`])} fra={p.fra}
            apply={set(`career${k}`)} onClose={() => setMapping(false)} /> : null}
        </>
      ) : (
        <MoneyField id={`ssPia${k}`} label={<Tipped text="Check at full retirement age, from the statement" k="sspia" />} unit="/mo" value={s[`pia${k}`]} onValueChange={set(`pia${k}`)} aria-label={`${who} monthly benefit at full retirement age`} />
      )}
      <div className={two}>
        <NumberField id={`ssThrough${k}`} label={<Tipped text="Plan through age" k="ssthrough" />} unit="age" max={110} value={s[`through${k}`]} onValueChange={set(`through${k}`)} aria-label={`${who} age planned through`} />
        {early ? (
          <MoneyField id={`ssEarn${k}`} label={<Tipped text={"Pay per year, if working at " + p.claim} k="ssearn" />} unit="/yr" value={s[`earn${k}`]} onValueChange={set(`earn${k}`)} aria-label={`${who} pay per year while claiming before full retirement age`} />
        ) : null}
      </div>
    </>
  );
}

export function Social() {
  const { state: s, set, setState } = useToolState(SOCIAL_DEF);
  const tableRef = useRef<HTMLTableElement>(null);
  const yearsRef = useRef<HTMLTableElement>(null);

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

  const row = (age: number) => rows.find((r) => r.age === age)!;
  const r62 = row(62), r70 = row(70);
  const you = married ? "your" : "your";
  /* The verdict, in a sentence or two: what the age chosen gets, and what
     the ends of the range would do instead. */
  const verdict = !ready ? null : (
    <>
      Claiming at <b>{p.you.claim}</b> gives {you} check of <b>{money(H.you.monthly)}</b> per month.
      {p.you.claim < 70 ? <> Waiting until 70 would make it <b>{money(r70.you)}</b>, and pay <b>{money(r70.lifetime - chosen.lifetime)}</b> more in all by {p.you.through}.</> : null}
      {p.you.claim > 62 ? <> Claiming at 62 would make it <b>{money(r62.you)}</b>, and pay <b>{money(chosen.lifetime - r62.lifetime)}</b> less.</> : null}
      {best1 === p.you.claim ? <> For a life to {p.you.through}, {p.you.claim} is the age that pays the most.</> : null}
    </>
  );

  const hero: ReadingFigure = {
    label: married ? "Your two checks each month, once both of you have claimed" : "Your check each month, claiming at " + p.you.claim,
    id: "ssMonthly", value: ready ? money(monthly) : DASH,
    note: ready ? (married ? money(monthlyYou) + " yours at " + p.you.claim + " and " + money(monthlySpouse) + " your spouse's at " + p.spouse!.claim + ", in today's dollars" : "In today's dollars; it rises with inflation") : "",
  };
  const figures: ReadingFigure[] = [
    { label: married ? "All your checks through " + p.you.through + " and " + p.spouse!.through : "All your checks through age " + p.you.through, id: "ssLifetime", value: ready ? money(H.total) : DASH,
      note: ready ? (married ? "Both of you, survivor years included" : "Added up, in today's dollars") : "" },
    { label: <span className="tipglue">Age that pays the most<TipDot k="ssbest" /></span>, id: "ssBest", value: ready ? String(best1) : DASH,
      note: ready ? (better > 1 ? money(better) + " more in all than claiming at " + p.you.claim : "The age you chose") : "" },
  ];

  // The lifespan strip's scale: 70 to 100, a tick every five years.
  const span = 31, tick = (a: number) => `${(((a - 70) / span) * 100).toFixed(2)}%`;
  // The invest-early story's figures.
  const potAtLate = I.bands[Math.min(I.bands.length - 1, p.late - p.early)]?.p50 ?? 0;

  return (
    <div className="col-span-full grid grid-cols-1 items-start gap-5 max-sm:gap-3.5 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-1 lg:self-stretch">
        <PinnedReading main={{ label: "A month, claiming at " + p.you.claim, value: hero.value }} side={{ label: "Best age", value: figures[1].value }} />

        <aside id="asideSocial" className="max-lg:static max-lg:max-h-none max-lg:overflow-visible">
          <Card>
            <CardContent>
              <div className="field mb-3.5">
                <Segmented id="segSsStatus" attr="data-status" options={[["s", "Single"], ["m", "Married"]] as const} value={s.status} onChange={set("status")} />
              </div>
              <PersonFields k="1" s={s} set={set} label={married ? "Your information" : null} />
              {married ? <PersonFields k="2" s={s} set={set} label="Your spouse's information" /> : null}

              <GroupHead>Taxes in retirement</GroupHead>
              <MoneyField id="ssOther" label={<Tipped text="Other income per year, besides Social Security" k="ssother" />} unit="/yr" value={s.other} onValueChange={set("other")} />
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="stack min-w-0 lg:col-span-2" id="tab-social">
        <Card size="flush" className="min-w-0" id="ssReading">
          <HeroReading tone={ready ? "answer" : "text"} sized={ready} hero={hero} figures={figures} />
          {!ready ? <Band id="ssEmpty">Enter the monthly benefit from your Social Security statement, or your pay to estimate one.</Band> : null}
          {verdict ? <Band id="ssVerdict">{verdict}</Band> : null}
          {ready && married && H.survivorAt !== null ? (
            <Band id="ssSurvivor">
              {H.survivorAt === p.you.through
                ? <>If you die first, at {fmtNum(p.you.through)}, your spouse keeps <b>{money(H.survivor)}</b> per month: the larger of your two checks, your delayed credits included.</>
                : <>If your spouse dies first, at {fmtNum(p.spouse!.through)}, you keep <b>{money(H.survivor)}</b> per month: the larger of your two checks.</>}
            </Band>
          ) : null}
          <div className="border-t border-border px-4.5 pt-3.5 pb-4 max-sm:px-3.5" hidden={!ready}>
            <div className="grid2">
              <div>
                <KV k={married ? "Your two checks per year" : "Your check per year"} id="ssKVYear" v={money(monthly * 12)} />
                <KV k={"Years of checks, " + p.you.claim + " to " + p.you.through} id="ssKVYears" v={fmtNum(p.you.through - p.you.claim)} />
                <KV k="Your full retirement age" id="ssKVFra" v={fraLabel(p.you.fra)} />
                {married ? <KV k="Your spouse's full retirement age" id="ssKVFra2" v={fraLabel(p.spouse!.fra)} /> : null}
              </div>
              <div>
                <KV k={<span className="tipglue">Share of it taxed as income<TipDot k="sstaxed" /></span>} id="ssTaxed" v={ready ? pctStr(taxed, 0) : DASH} />
                <KV k="Taxable amount per year" id="ssKVTaxable" v={money(taxed * monthly * 12)} />
                {married ? <KV k={"Your check at " + p.you.claim} id="ssKVYou" v={money(H.you.monthly) + "/mo"} /> : null}
                {married && H.top1 > 0 ? <KV k="Your spousal top-up" id="ssKVTop1" v={money(H.top1) + "/mo"} /> : null}
                {married ? <KV k={"Your spouse's check at " + p.spouse!.claim} id="ssKVSp" v={money(H.spouse!.monthly) + "/mo"} /> : null}
                {married && H.top2 > 0 ? <KV k="Your spouse's top-up" id="ssKVTop2" v={money(H.top2) + "/mo"} /> : null}
                {H.you.withheld > 0 ? <KV k={"Withheld per year until " + fraLabel(p.you.fra)} id="ssKVHeld" cls="neg" v={money(H.you.withheld)} /> : null}
                {H.you.withheld > 0 ? <KV k="Your check from full retirement age" id="ssKVLater" v={money(H.you.laterMonthly) + "/mo"} /> : null}
              </div>
            </div>
            {H.you.withheld > 0 ? (
              <p className="hint m-0 mt-2 max-w-copy">Earning {money(p.you.earn)} per year before full retirement age, Social Security holds back $1 of every $2 over the limit. Those months are credited back at full retirement age, so the check rises then.</p>
            ) : null}
          </div>
        </Card>

        <Card className="min-w-0" hidden={!ready}>
          <CardHeader>
            <CardTitle>What you&apos;d get at each age</CardTitle>
            <CardDescription>The check each month, and all the checks added up through age {p.you.through}{married ? ", for the household, when one of you claims at that age and the other as set" : ""}.</CardDescription>
            <CardAction><CsvButton table={tableRef} label="What you'd get at each age" /></CardAction>
          </CardHeader>
          <div className="swipehint">Swipe the table sideways to see every column.</div>
          <div className="scroll max-h-none">
            <table id="ssTable" ref={tableRef}>
              <thead>
                <tr>
                  <th>Claim at</th><th>{married ? "Your check" : "Each month"}</th>
                  {married ? <th>Spouse&apos;s check</th> : null}
                  <th>{married ? "In all, if you claim then" : "In all, through " + p.you.through}</th>
                  {married ? <th>In all, if your spouse claims then</th> : null}
                  <th>Less than the best</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const d = r.lifetime - bestRow.lifetime;
                  return (
                    <tr key={r.age} className={cn(r.age === p.you.claim && "font-semibold")}>
                      <td>{r.age}{r.age === fraYou ? <span className="ml-1.5 text-muted-foreground font-normal">full retirement age</span> : null}
                        {r.age === p.you.claim ? <span className="ml-1.5 text-muted-foreground font-normal">your choice</span> : null}
                        {r.age === best1 ? <Badge variant="positive" className="ml-1.5 align-middle">Pays the most</Badge> : null}
                        {married && r.age === best2 ? <Badge variant="highlight" className="ml-1.5 align-middle">Most for your spouse</Badge> : null}</td>
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
            <CardTitle>Which age pays the most, for how long you live</CardTitle>
            <CardDescription>Nobody knows their lifespan, so here is the claiming age that collects the most for every age you might live to{married ? ", with your spouse as set" : ""}.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-label text-muted-foreground">If you live to...</div>
            <div className="relative mt-1 mb-6">
              <div className="flex h-11 w-full gap-px overflow-hidden rounded-md" role="img" aria-label={"Best claiming age by lifespan: " + wins.map((w) => "claim at " + w.claim + " if you live to " + w.from + " to " + w.to).join(", ")}>
                {wins.map((w) => (
                  <div key={w.from} className="relative flex min-w-0 flex-(--span) items-center justify-center bg-muted text-label font-medium text-foreground tabular-nums"
                    style={{ "--span": w.to - w.from + 1, "--tint": (12 + Math.round(((w.claim - 62) / 8) * 58)) / 100 } as React.CSSProperties}>
                    <span className="absolute inset-0 bg-series-sky opacity-(--tint)" aria-hidden="true" />
                    <span className="relative overflow-hidden px-0.5 whitespace-nowrap">{w.to - w.from >= 3 ? "claim at " + w.claim : w.claim}</span>
                  </div>
                ))}
              </div>
              {Array.from({ length: 16 }, (_, i) => 70 + i * 2).map((a) => (
                <span key={a} className={cn("absolute top-full left-(--x) mt-1 -translate-x-1/2 text-label text-muted-foreground tabular-nums first:translate-x-0 last:-translate-x-full", a % 10 !== 0 && "max-sm:hidden")}
                  style={{ "--x": a === 100 ? "100%" : tick(a) } as React.CSSProperties}>{a}</span>
              ))}
            </div>
            <div className="grid2">
              <div>
                {wins.slice(0, Math.ceil(wins.length / 2)).map((w) => (
                  <KV key={w.from} k={w.from === w.to ? "Live to " + w.from : w.from === 70 ? "Live to " + w.to + " or less" : w.to === 100 ? "Live to " + w.from + " or more" : "Live to " + w.from + " to " + w.to} v={"claim at " + w.claim} />
                ))}
              </div>
              <div>
                {wins.slice(Math.ceil(wins.length / 2)).map((w) => (
                  <KV key={w.from} k={w.from === w.to ? "Live to " + w.from : w.to === 100 ? "Live to " + w.from + " or more" : "Live to " + w.from + " to " + w.to} v={"claim at " + w.claim} />
                ))}
              </div>
            </div>
            <p className="hint m-0 mt-2 max-w-copy">A 65-year-old today lives to about 84 on average, and in a couple one of the two usually passes 90.</p>
          </CardContent>
        </Card>

        <Card className="min-w-0" hidden={!ready}>
          <CardHeader>
            <CardTitle>When waiting starts to pay off</CardTitle>
            <CardDescription>Everything collected so far at each age. A later claim starts behind and catches up: where its line crosses an earlier one is the break-even age.</CardDescription>
          </CardHeader>
          <MultiChart id="SsCum" series={series} maxX={maxX} ariaLabel="Cumulative Social Security benefits by claiming age" xFmt={(x) => x + x0}
            head={(y) => <b>Age {y + x0}</b>} />
          <Legend id="legendSsCum" items={series.map((x) => [x.color, x.name] as [string, string])} />
          <div className="border-t border-border px-4.5 pt-3.5 pb-4 max-sm:px-3.5">
            <div className="grid2">
              <div>
                {bes.slice(0, 2).map((b) => (
                  <KV key={b.a + "-" + b.b} k={"Claim at " + age1(b.b) + " instead of " + age1(b.a) + ": ahead from"} v={b.at ? "age " + age1(b.at) : "never"} />
                ))}
              </div>
              <div>
                {bes.slice(2).map((b) => (
                  <KV key={b.a + "-" + b.b} k={"Claim at " + age1(b.b) + " instead of " + age1(b.a) + ": ahead from"} v={b.at ? "age " + age1(b.at) : "never"} />
                ))}
              </div>
            </div>
            <p className="hint m-0 mt-2 max-w-copy">Your own check alone, in today&apos;s dollars, before tax{married ? ". The chart counts the household, survivor years included, so it can cross earlier or later" : ""}.</p>
          </div>
        </Card>

        <Card className="min-w-0" hidden={!ready}>
          <CardHeader>
            <CardTitle><span className="tipglue">What if you claimed early and invested the checks?<TipDot k="ssinvest" /></span></CardTitle>
            <CardDescription>Take the {money(I.benEarly / 12)} check at {p.early} and invest every one. From {p.late}, draw the {money((I.benLate - I.benEarly) / 12)} per month the bigger check would have paid. Does the pot last to {p.you.through}, in every market since 1926?</CardDescription>
          </CardHeader>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-y border-border px-5.5 py-3 text-note max-sm:px-4">
            <span>Claim at</span>
            <SelectField id="ssEarly" label="" className="m-0" value={s.early} onChange={set("early")} aria-label="Claim early at">
              {CLAIM_AGES.filter((a) => a < 70).map((a) => <option key={a} value={String(a)}>{a}</option>)}
            </SelectField>
            <span>instead of</span>
            <SelectField id="ssLate" label="" className="m-0" value={s.late} onChange={set("late")} aria-label="Instead of waiting until">
              {CLAIM_AGES.filter((a) => a > p.early).map((a) => <option key={a} value={String(a)}>{a}</option>)}
            </SelectField>
            <span>, invested with</span>
            <NumberField id="ssMix" label="" className="m-0 w-24" unit="%" step={5} max={100} value={s.mix} onValueChange={set("mix")} aria-label="Stock share" />
            <span className="tipglue">in stocks<TipDot k="ssmix" /></span>
          </div>
          {I.windows > 0 ? (
            <>
              <HeroReading tone="text" row
                hero={{ label: "Start years since 1926 where claiming at " + p.early + " came out ahead", id: "ssInvWon", value: pctStr(I.won / I.windows, 0),
                  note: fmtNum(I.won) + " of " + fmtNum(I.windows) + "; the pot ran out in the rest" + (I.firstOut ? ", as early as " + I.firstOut : "") }}
                figures={[
                  { label: "Pot at " + p.late + ", typical", id: "ssInvPot", value: money(potAtLate), note: "The checks, saved and invested" },
                  { label: "Left at " + p.you.through + ", typical", id: "ssInvMed", value: money(I.median), note: "After paying out the gap" },
                ]} />
              <BandChart id="SsInv" mode="mc" xOffset={p.early} pts={I.bands.map((b) => ({ year: b.year, base: b.p50, hi: b.p90, lo: b.p10, p25: b.p25, p75: b.p75 }))} maxX={I.years}
                stageMarks={[{ year: p.late - p.early, label: "Drawing from " + p.late }]}
                ariaLabel="What the invested early checks are worth at each age, across every start year since 1926"
                tip={(b) => <><b>Age {b.year + p.early}</b><FanTipRows b={b} /></>} />
              <McLegend id="legendSsInv" noDet extra={"Drawing from " + p.late} />
            </>
          ) : <Band>History is too short to run this comparison through age {p.you.through}.</Band>}
        </Card>

        <div className="min-w-0" hidden={!ready}>
          <Collapsible render={<Card />}>
            <CardHeader>
              <CardTitle><CollapsibleTrigger>Year by year<ChevronDownIcon aria-hidden="true" /></CollapsibleTrigger></CardTitle>
              <CardAction><CsvButton table={yearsRef} label="Year by year" /></CardAction>
            </CardHeader>
            <CollapsibleContent keepMounted>
              <div className="scroll">
                <table id="ssYears" ref={yearsRef}>
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
