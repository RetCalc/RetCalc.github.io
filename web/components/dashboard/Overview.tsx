"use client";

/* The Dashboard's overview, as approved in mock A: net worth with the plan
   ahead, the readiness score and chance of success beside it, four tiles,
   what to do next, the profile's sections and Your timeline. A tile with
   nothing to show yet is dashed, says what it will show and offers the one
   thing that fills it. */

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  ArrowDownToLineIcon, BanknoteIcon, CalendarDaysIcon, CheckIcon, GaugeIcon, HouseIcon, IdCardIcon, ListChecksIcon,
  ChevronDownIcon, MapPinIcon, ReceiptIcon, ShieldCheckIcon, SunsetIcon, UserRoundIcon, WalletIcon, LandmarkIcon, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { Frame } from "./Frame";
import { NetWorthChart, SplitBar, Timeline, type Lane, type Readout } from "./charts";
import { daysSince, lastedWords, longDate, money, pctDown, shortMoney } from "./format";
import { collegeChildren, collegeKid, collegeYears } from "./college";
import { FACTORS, areaPoints, ageOf, answers, couple, history, holdings, mortgage, nameOf, nowYear, people, realGrowth, results, spendMonth, yearAt, type Results } from "./model";
import { nextSteps } from "./nextsteps";
import { explain } from "./readiness";
import { target, type FactorId } from "@/tools/guide/calc";
import { flow, mixWords, retireMix } from "./flows";
import { hasAccounts, netWorth, useDashboard, type DashData } from "./store";
import { useLandedOn } from "./land";
import { Empty, Tile, Tip } from "./ui";

const pct = (v: number) => (Math.round(v * 1000) / 10).toFixed(1).replace(/\.0$/, "") + "%";

export function Readiness({ R, pr, entries }: { R: Results; pr: DashData["profile"]; entries: DashData["entries"] }) {
  const pts = areaPoints(R.parts, R.score);
  const areas = FACTORS.map((f) => ({ name: f.name, w: f.w, p: R.parts[f.id]?.p ?? null, pts: pts[f.id] ?? null }));
  // With an area still unscored, the points scored out of the points scored
  // so far: a full "of 100" only once all five are in.
  const avail = areas.reduce((s, a) => s + (a.p == null ? 0 : a.w), 0);
  const got = areas.reduce((s, a) => s + (a.pts ?? 0), 0);
  const part = R.score != null && R.partial;
  const word = R.score == null ? "Not scored yet" : part ? `${100 - avail} points not scored yet` : R.score >= 85 ? "On track" : R.score >= 70 ? "Nearly there" : R.score >= 50 ? "Getting there" : "Needs work";
  // One area open at a time: why it scored what it did, and what would raise it.
  const [open, setOpen] = useState<FactorId | null>(null);
  // A link to one area ("/dashboard#readiness-outlook") opens it.
  useLandedOn("readiness-*", useCallback((id: string) => setOpen(id.slice("readiness-".length) as FactorId), []));
  const why = useMemo(() => (open ? explain(open, pr, entries, R) : null), [open, pr, entries, R]);
  return (
    <Tile id="readiness" icon={GaugeIcon} title="Readiness score" tip="readiness">
      <div className="dsh-inline dsh-mt">
        <span className="dsh-fig">{part ? got : R.score ?? "—"}<small>{part ? `of ${avail} so far` : "of 100"}</small></span>
        <span className={!R.partial && (R.score ?? 0) >= 70 ? "dsh-badge dsh-gain" : "dsh-badge"}>{word}</span>
      </div>
      <SplitBar areas={areas} />
      <div className="dsh-areas">
        {FACTORS.map((f, i) => (
          <div key={f.id} className="dsh-area" id={"readiness-" + f.id}>
            <button type="button" className="dsh-arow" aria-expanded={open === f.id} onClick={() => setOpen(open === f.id ? null : f.id)}>
              <span className="dsh-n">{f.name}</span>
              <span className="dsh-v">{areas[i].p == null ? "Not scored yet" : `${areas[i].pts} of ${f.w}`}</span>
              <ChevronDownIcon aria-hidden="true" />
            </button>
            {open === f.id && why ? (
              <div className="dsh-why">
                <p>{why.why}</p>
                {why.how.length ? <ul>{why.how.map((h) => <li key={h}>{h}</li>)}</ul> : null}
                <Button variant="outline" size="sm" nativeButton={false} render={<Link href={why.href} />}>{why.action}</Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </Tile>
  );
}

/** The plan's answer in one sentence: on track (lasting in at least the
    share of past markets the plan aims for), or not yet, with the first
    change that would get there. */
function Answer({ R, pr, entries }: { R: Results; pr: DashData["profile"]; entries: DashData["entries"] }) {
  const goal = useMemo(() => target(answers(pr, entries)), [pr, entries]);
  const how = useMemo(() => (R.success != null && R.success < goal ? explain("outlook", pr, entries, R).how[0] ?? null : null), [R, goal, pr, entries]);
  if (R.success == null || R.atRetire == null) return null;
  const lasted = lastedWords(R.success, R.runs);
  const at = `${money(Math.round(R.atRetire / 1000) * 1000)} at ${pr.p1.retire}`;
  return (
    <p className="dsh-answer">
      {R.success >= goal ? <><b>You&apos;re on track:</b> {at}, and your plan lasted in {lasted}.</>
        : <><b>Not there yet:</b> your plan lasted in {lasted}; it aims for {Math.round(goal * 100)}%.{how ? <> One way there: {how.charAt(0).toLowerCase() + how.slice(1)}.</> : null}</>}
    </p>
  );
}

function Chance({ R, accounts }: { R: Results; accounts: boolean }) {
  return (
    <Tile icon={ShieldCheckIcon} title="Chance of success" tip="chance">
      <div className="dsh-fig dsh-mt">{R.success != null ? pctDown(R.success) + "%" : "—"}</div>
      <div className="dsh-cap dsh-mt6">{R.success != null ? (R.runs && R.success < 1 ? `${R.runs.ok} of ${R.runs.of} historical retirements lasted to age 95` : "of historical retirements lasted to age 95") : R.gap ?? "Needs your age, savings, retirement age and spending"}</div>
      <div className="dsh-foot"><span className="dsh-cap">{R.strategy ? `With your chosen strategy: ${R.strategy.name}` : accounts ? "Spending a fixed amount that rises with prices" : "Add your accounts for a sharper number"}</span></div>
    </Tile>
  );
}

export function timeline(d: DashData, R: Results): { lanes: Lane[]; from: number; to: number } {
  const pr = d.profile, now = nowYear(), from = Math.floor(now);
  const lanes: Lane[] = [];
  let to = from + 30;
  people(pr).forEach((p, i) => {
    if (!p.by) return;
    to = Math.max(to, yearAt(p, 95));
    const ret = p.retire ? yearAt(p, p.retire) : null;
    const claim = (i ? R.claim2 : R.claim1) ?? 67;
    const events = [{ at: yearAt(p, 65), label: "Medicare " + yearAt(p, 65) }];
    // Retiring before 59½: the bridge years until retirement accounts open.
    const early = ret && p.retire! < 59.5 ? p.by + 59.5 : null;
    if (early) events.push({ at: early, label: "59½ " + Math.floor(early) });
    if (!R.abroad) events.push({ at: yearAt(p, claim), label: "Social Security " + yearAt(p, claim) });
    lanes.push({
      name: nameOf(pr, i ? 1 : 0), lead: "Age " + ageOf(p),
      spans: ret ? [{ from, to: ret, kind: "dsh-work" }, ...(early ? [{ from: ret, to: early, kind: "dsh-k2" as const, label: pr.bridge ? "Bridge plan" : "Bridge, not planned" }] : []), { from: early ?? ret, to: yearAt(p, 95), kind: "dsh-ret" }] : [],
      events, note: ret ? { at: ret, label: `Retires ${ret}, age ${p.retire}` } : undefined,
    });
  });
  // Each child, the ones you have and the ones planned: daycare to 5 when
  // there's paid childcare, and college when you're helping (from 18 for
  // four years, or as College Savings set it).
  const kinds = ["dsh-k1", "dsh-k2", "dsh-k3"] as const, ys = collegeYears(pr);
  collegeChildren(pr).forEach((c, i) => {
    const born = c.by ?? from + c.bornIn, spans: Lane["spans"] = [];
    if (pr.childcare && born + 5 > from) spans.push({ from: born, to: born + 5, kind: kinds[i % 3], label: "Daycare" });
    if (pr.college.help !== "none") { const s = from + ys[i], e = s + collegeKid(pr, i).years; spans.push({ from: s, to: e, kind: kinds[i % 3], label: `College ${s} to ${e}` }); }
    lanes.push({ name: c.name, spans, events: c.planned ? [{ at: born, label: "Born about " + born }] : [] });
  });
  const M = mortgage(pr, d.entries);
  if (M.payoff != null) lanes.push({ name: "Home", spans: [{ from, to: M.payoff, kind: "dsh-k3", label: "Mortgage" }], events: [{ at: M.payoff, label: "Paid off " + Math.floor(M.payoff) }] });
  return { lanes, from, to: Math.min(to, from + 70) };
}

type Range = "recent" | "retire" | "all";

export function Overview() {
  const { data } = useDashboard();
  const pr = data.profile;
  const R = useMemo(() => results(pr, data.entries), [pr, data.entries]);
  const [range, setRange] = useState<Range>("all");
  const accounts = hasAccounts(data.entries), H = holdings(data.entries, pr), EF = flow(pr);
  const hist = history(data.entries);
  const last = data.entries[data.entries.length - 1];
  const nw = last ? netWorth(last) : H.total;
  const prev = data.entries[data.entries.length - 2];
  const yearAgo = data.entries.find((e) => daysSince(e.date) <= 380);
  const end = R.path[R.path.length - 1];
  // At retirement: the plan's savings then, with the home and other assets, as every tab has it.
  const retAt = R.atRetire != null ? { v: R.atRetire + R.equity } : null;
  const p1 = pr.p1, p2 = couple(pr) ? pr.p2 : null;
  const r1 = p1.by && p1.retire ? yearAt(p1, p1.retire) : null, r2 = p2?.by && p2.retire ? yearAt(p2, p2.retire) : null;
  const marks = r1 && r1 === r2 ? [{ t: r1, label: "You both retire" }]
    : [r1 ? { t: r1, label: nameOf(pr, 0) + " retires" } : null, r2 ? { t: r2, label: nameOf(pr, 1) + " retires" } : null].filter((m): m is { t: number; label: string } => !!m);
  const until = range === "recent" ? nowYear() + 3 : range === "retire" && R.retireYear ? R.retireYear + 1 : undefined;
  const steps = nextSteps(data, R);
  const tax = R.abroad ? ", before taxes" : "";
  const describe = (p: { t: number; v: number; lo: number; hi: number; entry?: string }): Readout => {
    const rows: [string, string][] = [[p.entry ? "Net worth" : "Projected", money(p.entry ? p.v : Math.round(p.v / 1000) * 1000)]];
    if (p.hi > p.lo) rows.push(["8 in 10 markets", `${shortMoney(p.lo)} to ${shortMoney(p.hi)}`]);
    const ages = people(pr).map((x, i) => (x.by ? `${nameOf(pr, i ? 1 : 0)} ${Math.floor(p.t - x.by - ((x.bm || 1) - 1) / 12)}` : null)).filter(Boolean) as string[];
    if (ages.length) rows.push(["Ages", ages.join(", ")]);
    return { title: p.entry ? `Your entry, ${longDate(p.entry)}` : String(Math.floor(p.t)), rows };
  };
  const sections: [LucideIcon, string, boolean, string][] = [
    [UserRoundIcon, "Household and ages", !!pr.who && !!p1.by && (!p2 || !!p2.by), "/dashboard/profile"],
    [MapPinIcon, "Where you live", !!pr.state, "/dashboard/income"],
    [BanknoteIcon, "Pay", p1.pay != null, "/dashboard/income"],
    [ReceiptIcon, "Spending", spendMonth(pr) != null, "/dashboard/spending"],
    [WalletIcon, "Accounts", accounts, "/dashboard/accounts"],
    [LandmarkIcon, "Debts", accounts, "/dashboard/accounts"],
    [HouseIcon, "Home", pr.home === "rent" ? pr.rent != null : pr.home === "own" && mortgage(pr, data.entries).payoff != null, "/dashboard/home"],
    [SunsetIcon, "Retirement plans", !!p1.retire && (!p2 || !!p2.retire), "/dashboard/profile"],
    [IdCardIcon, "Social Security", pr.ss.checked || R.abroad, "/dashboard/income"],
    [ArrowDownToLineIcon, "Withdrawal strategy", !!pr.strategy, "/dashboard/retirement"],
  ];
  const filled = sections.filter((s) => s[2]).length;
  const tl = timeline(data, R);
  const names = people(pr).map((_, i) => nameOf(pr, i ? 1 : 0)).join(" and ");
  const kept = accounts || data.entries.length > 1;

  const hello = kept && last
    ? <><span>Your last entry was <b>{longDate(last.date)}</b>, {daysSince(last.date)} {daysSince(last.date) === 1 ? "day" : "days"} ago.</span><div className="dsh-r"><Button nativeButton={false} render={<Link href="/dashboard/accounts#assets" />}>Update balances</Button></div></>
    : <><span><b>Welcome{p1.name.trim() ? ", " + p1.name.trim() : ""}.</b> <span className="dsh-muted">This is your starting point. Fill in the dashed tiles to sharpen it.</span></span>
      <div className="dsh-r"><span className="dsh-cap">Profile {filled} of {sections.length}</span><div className="dsh-segs" aria-hidden="true">{sections.map((s, i) => <i key={s[1]} className={i < filled ? "dsh-on" : undefined} />)}</div></div></>;

  return (
    <Frame current="overview" title="Dashboard" sub={names + (last ? " · updated " + longDate(last.date) : "")}>
      <Answer R={R} pr={pr} entries={data.entries} />
      <div className="dsh-hello">{hello}</div>
      <div className="dsh-grid dsh-r1">
        <Tile icon={WalletIcon} title="Net worth" right={
          <div className="dsh-nwhead">
            <span className="dsh-legend"><span><i />Your entries</span><span><i className="dsh-d" />Projected</span><span><i className="dsh-b" />8 in 10 markets <Tip id="band" title="8 in 10 markets" /></span></span>
            <Segmented aria-label="How far to show">
              {([["recent", "Recent"], ["retire", "To retirement"], ["all", "Whole plan"]] as const).map(([k, l]) => (
                <SegmentedItem key={k} pressed={range === k} onPressedChange={() => setRange(k)}>{l}</SegmentedItem>
              ))}
            </Segmented>
          </div>
        }>
          <div className="dsh-nwfigs">
            <div>
              <div className="dsh-label">Today <Tip id="netWorth" title="Net worth today" /></div>
              <div className="dsh-fig dsh-key">{money(nw)}</div>
              <div className="dsh-cap dsh-mt6">
                {prev && last ? <><span className={netWorth(last) >= netWorth(prev) ? "dsh-chg dsh-up" : "dsh-chg dsh-dn"}>{netWorth(last) >= netWorth(prev) ? "↑" : "↓"} {money(Math.abs(netWorth(last) - netWorth(prev)))}</span> since your last entry
                  {yearAgo && yearAgo !== prev ? <>, <span className={netWorth(last) >= netWorth(yearAgo) ? "dsh-chg dsh-up" : "dsh-chg dsh-dn"}>{money(Math.abs(netWorth(last) - netWorth(yearAgo)))}</span> {netWorth(last) >= netWorth(yearAgo) ? "up" : "down"} over the past year</> : null}</>
                  : accounts ? "What you have, less what you owe" : pr.home === "own" ? "Savings plus home equity, today" : "Savings, today"}
              </div>
            </div>
            {retAt ? <div className="dsh-sec"><div className="dsh-label">At retirement, {R.retireYear} <Tip id="atRetire" title="Net worth at retirement" /></div><div className="dsh-fig">{shortMoney(retAt.v)}</div></div> : null}
            {end && p1.by ? <div className="dsh-sec"><div className="dsh-label">At 95, {yearAt(p1, 95)}</div><div className="dsh-fig">{shortMoney(end.v)}</div></div> : null}
          </div>
          <div className="dsh-mt">
            {R.path.length ? <NetWorthChart hist={hist.length ? hist : [{ t: nowYear(), v: nw }]} proj={R.path} marks={marks} until={until} describe={describe} />
              : <p className="dsh-cap">Your projection appears once your profile has your age, savings, retirement age and spending.</p>}
          </div>
          <div className="dsh-assume dsh-cap">
            In today&apos;s dollars{tax}. Assumes <b>{pct(realGrowth(pr))}</b> growth per year after inflation{R.retireYear ? ` until ${R.retireYear}` : ""}, then every market since 1926 invested <b>{mixWords(retireMix(pr))}</b>. <Button variant="link" size="inline" nativeButton={false} render={<Link href="/dashboard/profile#assumptions" />}>Growth is set in Profile</Button>, the mix on <Button variant="link" size="inline" nativeButton={false} render={<Link href="/dashboard/retirement" />}>Retirement</Button>.
          </div>
        </Tile>
        <div className="dsh-side"><Readiness R={R} pr={pr} entries={data.entries} /><Chance R={R} accounts={accounts} /></div>
      </div>

      <div className="dsh-grid dsh-r2">
        <Tile icon={BanknoteIcon} title="Retirement income" tip="retIncome">
          <div className="dsh-fig dsh-mt">{R.S ? money((R.S.spend + R.S.taxYr) / 12) : "—"}<small>per month</small></div>
          <div className="dsh-cap dsh-mt6">{R.S ? <>To spend <b>{money(R.S.spend / 12)}</b>{!R.abroad ? <> and pay about <b>{money(R.S.taxYr / 12)}</b> in taxes</> : null}, in today&apos;s dollars{tax}</> : R.gap ?? "Fills in once your profile has your ages, savings, retirement age and spending."}</div>
          {R.S ? <div className="dsh-foot"><span className="dsh-cap">{R.ss ? <>Social Security pays <b>{money(R.ss)}</b> of it from {R.ssYear}; savings pay the rest.</> : "Savings pay all of it."}</span></div> : null}
        </Tile>
        {R.abroad ? (
          <Tile icon={IdCardIcon} title="Social Security"><div className="dsh-fig dsh-mt">Not counted</div><div className="dsh-cap dsh-mt6">Outside the US, your plan leaves it out.</div></Tile>
        ) : R.ss != null ? (
          <Tile id="social-security" icon={IdCardIcon} title="Social Security" tip={pr.ss.checked ? "ssTotal" : "ssEstimate"} right={pr.ss.checked ? null : <span className="dsh-badge">Estimated</span>}>
            <div className="dsh-fig dsh-mt">{money(R.ss)}<small>per month</small></div>
            <div className="dsh-cap dsh-mt6">{nameOf(pr, 0)} at {R.claim1} ({money(R.ss1 ?? 0)}){p2 && R.ss2 != null ? `, ${nameOf(pr, 1)} at ${R.claim2} (${money(R.ss2)})` : ""}{pr.ss.checked ? "" : ". Estimated from today's pay"}</div>
            <div className="dsh-foot"><Button variant="link" size="inline" nativeButton={false} render={<Link href="/dashboard/income#social-security" />}>{pr.ss.checked ? "When to claim →" : "Check your benefit →"}</Button></div>
          </Tile>
        ) : <Empty icon={IdCardIcon} title="Social Security" ghost="$—" text="Add your pay, and we'll estimate your benefit; or type the figure from your statement." action="Check your benefit" href="/dashboard/income#social-security" />}
        {R.strategy ? (
          <Tile icon={ArrowDownToLineIcon} title="Withdrawal strategy" tip="strategy">
            <div className="dsh-fig dsh-name dsh-mt">{R.strategy.name}</div>
            <div className="dsh-cap dsh-mt6">Lasted in <b>{pctDown(R.strategy.success)}%</b> of past markets, spending what you plan to with taxes on top</div>
            <div className="dsh-foot"><Button variant="link" size="inline" nativeButton={false} render={<Link href="/dashboard/retirement#compare" />}>Compare strategies →</Button></div>
          </Tile>
        ) : <Empty icon={ArrowDownToLineIcon} title="Withdrawal strategy" ghost="—" text="Pick how you'll draw money in retirement. We'll test it against every past market." action="Choose a strategy" href="/dashboard/retirement#strategies" />}
        {R.cushion != null ? (
          <Tile icon={ShieldCheckIcon} title="Emergency fund" tip="cushion">
            <div className="dsh-fig dsh-mt">{R.cushion.toFixed(1).replace(/\.0$/, "")}<small>months</small></div>
            <div className="dsh-cap dsh-mt6">{money(H.cash ?? 0)} set aside{(H.cash ?? 0) < EF.efTarget ? `; ${money(EF.efTarget - (H.cash ?? 0))} more reaches your ${EF.efMonths}-month goal` : `, your ${EF.efMonths}-month goal or more`}</div>
            <div className="dsh-foot"><div className="dsh-segs dsh-grow" aria-hidden="true">{Array.from({ length: EF.efMonths }, (_, k) => k + 1).map((i) => <i key={i} className={i <= R.cushion! ? "dsh-on" : undefined} />)}</div></div>
          </Tile>
        ) : <Empty icon={ShieldCheckIcon} title="Emergency fund" ghost="— months" text="Add a savings or checking account to see how many months of spending you have set aside." action="Add cash accounts" href="/dashboard/accounts#assets" />}
      </div>

      <div className="dsh-grid dsh-r3">
        <Tile icon={ListChecksIcon} title="What to do next" right={<span className="dsh-cap">Ordered by how much each moves your plan</span>}>
          <ol className="dsh-steps">
            {steps.map((s, i) => (
              <li key={s.id} className="dsh-step"><span className="dsh-num">{i + 1}</span><div><b>{s.title}</b><span>{s.why}</span></div><Button variant="outline" size="sm" nativeButton={false} render={<Link href={s.href} />}>{s.action}</Button></li>
            ))}
          </ol>
          <div className="dsh-foot"><Button variant="link" size="inline" nativeButton={false} render={<Link href="/dashboard/next" />}>All next steps →</Button></div>
        </Tile>
        <Tile icon={UserRoundIcon} title="Your profile" right={<span className="dsh-cap">{filled} of {sections.length} sections</span>}>
          <div className="dsh-secs">
            {sections.map(([Icon, name, ok, href]) => (
              <div key={name}><Icon aria-hidden="true" /><span>{name}</span>
                {ok ? <span className="dsh-ok"><CheckIcon aria-hidden="true" /><span className="sr-only">Done</span></span> : <Button variant="link" size="inline" className="dsh-go" nativeButton={false} render={<Link href={href} />}>Fill in</Button>}
              </div>
            ))}
          </div>
          <div className="dsh-foot"><Button variant="link" size="inline" nativeButton={false} render={<Link href="/dashboard/profile" />}>Open your profile →</Button></div>
        </Tile>
      </div>

      {tl.lanes.length ? (
        <div className="dsh-r4">
          <Tile icon={CalendarDaysIcon} title="Your timeline" right={<span className="dsh-cap">Today is the dashed line</span>}>
            <div className="dsh-mt"><Timeline lanes={tl.lanes} from={tl.from} to={tl.to} now={nowYear()} /></div>
          </Tile>
        </div>
      ) : null}
    </Frame>
  );
}
