"use client";

/* The Dashboard's overview, as approved in mock A: net worth with the plan
   ahead, the readiness score and chance of success beside it, four tiles,
   what to do next, the profile's sections and the timeline. A tile with
   nothing to show yet is dashed, says what it will show and offers the one
   thing that fills it. */

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowDownToLineIcon, BanknoteIcon, CalendarDaysIcon, CheckIcon, GaugeIcon, HouseIcon, IdCardIcon, ListChecksIcon,
  PlusIcon, ReceiptIcon, ShieldCheckIcon, SunsetIcon, UserRoundIcon, WalletIcon, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { TipDot } from "@/components/shell/Tooltips";
import { Frame } from "./Frame";
import { NetWorthChart, SplitBar, Timeline, type Lane } from "./charts";
import { daysSince, longDate, money, money10, shortMoney } from "./format";
import { FACTORS, ageOf, couple, history, nowYear, people, results, yearAt, type Results } from "./model";
import { netWorth, useDashboard, type DashData } from "./store";

function Tile({ icon: Icon, title, right, className, children }: { icon: LucideIcon; title: string; right?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={className ? "dsh-tile " + className : "dsh-tile"}>
      <div className="dsh-tile-h"><span className="dsh-ti"><Icon aria-hidden="true" /></span><h2>{title}</h2>{right ? <div className="dsh-r">{right}</div> : null}</div>
      {children}
    </section>
  );
}
function Empty({ icon, title, ghost, text, action, href }: { icon: LucideIcon; title: string; ghost: string; text: string; action: string; href: string }) {
  return (
    <Tile icon={icon} title={title} className="dsh-empty">
      <div className="dsh-ghostfig dsh-mt">{ghost}</div>
      <p>{text}</p>
      <div className="dsh-foot"><Button variant="outline" size="sm" nativeButton={false} render={<Link href={href} />}><PlusIcon aria-hidden="true" />{action}</Button></div>
    </Tile>
  );
}

function Readiness({ R }: { R: Results }) {
  const areas = FACTORS.map((f) => ({ name: f.name, w: f.w, p: R.parts[f.id]?.p ?? null }));
  const word = R.score == null ? "Not scored yet" : R.partial ? "Partial score" : R.score >= 85 ? "On track" : R.score >= 70 ? "Nearly there" : R.score >= 50 ? "Getting there" : "Needs work";
  return (
    <Tile icon={GaugeIcon} title="Readiness score" right={<TipDot k="" text="Five areas, weighted: how your plan holds up, how much you save, your emergency fund, debt and monthly cash flow." />}>
      <div className="dsh-inline dsh-mt">
        <span className="dsh-fig">{R.score ?? "—"}<small>of 100</small></span>
        <span className={!R.partial && (R.score ?? 0) >= 70 ? "dsh-badge dsh-gain" : "dsh-badge"}>{word}</span>
      </div>
      <SplitBar areas={areas} />
      <div className="dsh-areas">
        {areas.map((a) => (
          <div key={a.name}>
            <span className="dsh-n">{a.name}</span>
            {a.p == null ? <Button variant="link" size="inline" className="dsh-add" nativeButton={false} render={<Link href="/dashboard/accounts" />}>Add</Button> : <span className="dsh-v">{Math.round(a.p * a.w)} of {a.w}</span>}
          </div>
        ))}
      </div>
    </Tile>
  );
}

function Chance({ R }: { R: Results }) {
  return (
    <Tile icon={ShieldCheckIcon} title="Chance of success" right={<TipDot k="" text="How often this plan lasted through every past market since 1926, starting in each year." />}>
      <div className="dsh-fig dsh-mt">{R.success != null ? Math.round(R.success * 100) + "%" : "—"}</div>
      <div className="dsh-cap dsh-mt6">{R.success != null ? "of historical retirements lasted to age 95" : "Needs your age, savings, retirement age and spending"}</div>
      <div className="dsh-foot"><span className="dsh-cap">Add your accounts for a sharper number</span></div>
    </Tile>
  );
}

function nextSteps(d: DashData, R: Results) {
  const out: { title: string; why: string; action: string; href: string }[] = [];
  if (d.skipped.length) out.push({ title: "Finish setting up", why: `${d.skipped.length} ${d.skipped.length > 1 ? "steps" : "step"} skipped`, action: "Finish", href: "/dashboard/setup" });
  out.push({ title: "Split your savings into accounts", why: "401(k), Roth, brokerage and cash are taxed differently", action: "Add accounts", href: "/dashboard/accounts" });
  if (!R.parts.cushion) out.push({ title: "Add a savings account", why: "Scores your emergency fund", action: "Add", href: "/dashboard/accounts" });
  out.push({ title: "Check your Social Security", why: "Uses your earnings record, not a guess", action: "Start", href: "/dashboard/retirement" });
  out.push({ title: "Choose a withdrawal strategy", why: "How you'll draw down in retirement", action: "Choose", href: "/dashboard/retirement" });
  return out.slice(0, 4);
}

function timeline(d: DashData, R: Results): { lanes: Lane[]; from: number; to: number } {
  const pr = d.profile, now = nowYear(), from = Math.floor(now);
  const lanes: Lane[] = [];
  let to = from + 30;
  people(pr).forEach((p, i) => {
    if (!p.by) return;
    const name = p.name.trim() || (i ? "Partner" : "You");
    to = Math.max(to, yearAt(p, 95));
    const ret = p.retire ? yearAt(p, p.retire) : null;
    const claim = R.S ? (i ? R.S.ss.claim2 : R.S.ss.claim) : 67;
    lanes.push({
      name, lead: "Age " + ageOf(p),
      spans: ret ? [{ from, to: ret, kind: "dsh-work" }, { from: ret, to: yearAt(p, 95), kind: "dsh-ret" }] : [],
      events: [{ at: yearAt(p, 65), label: "Medicare " + yearAt(p, 65) }, { at: yearAt(p, claim), label: "Social Security " + yearAt(p, claim) }],
      note: ret ? { at: ret, label: `Retires ${ret}, age ${p.retire}` } : undefined,
    });
  });
  const kinds = ["dsh-k1", "dsh-k2", "dsh-k3"] as const;
  pr.kidList.slice(0, pr.kids).forEach((k, i) => {
    if (!k.by) return;
    lanes.push({ name: k.name.trim() || `Child ${i + 1}`, spans: [{ from: k.by + 18, to: k.by + 22, kind: kinds[i % 3], label: `College ${k.by + 18} to ${k.by + 22}` }], events: [] });
  });
  return { lanes, from, to: Math.min(to, from + 70) };
}

type Range = "recent" | "retire" | "all";

export function Overview() {
  const { data } = useDashboard();
  const pr = data.profile;
  const R = useMemo(() => results(pr, data.entries), [pr, data.entries]);
  const [range, setRange] = useState<Range>("all");
  const hist = history(data.entries);
  const last = data.entries[data.entries.length - 1];
  const nw = last ? netWorth(last) : (pr.saved ?? 0) + R.equity;
  const prev = data.entries[data.entries.length - 2];
  const yearAgo = data.entries.find((e) => daysSince(e.date) <= 380);
  const end = R.path[R.path.length - 1];
  const retAt = R.path.find((p) => R.retireYear != null && p.t >= R.retireYear);
  const p1 = pr.p1, p2 = couple(pr) ? pr.p2 : null;
  const r1 = p1.by && p1.retire ? yearAt(p1, p1.retire) : null, r2 = p2?.by && p2.retire ? yearAt(p2, p2.retire) : null;
  const marks = r1 && r1 === r2 ? [{ t: r1, label: "You both retire" }]
    : [r1 ? { t: r1, label: (p1.name.trim() || "You") + " retires" } : null, r2 ? { t: r2, label: (p2!.name.trim() || "Your partner") + " retires" } : null].filter((m): m is { t: number; label: string } => !!m);
  const until = range === "recent" ? nowYear() + 3 : range === "retire" && R.retireYear ? R.retireYear + 1 : undefined;
  const steps = nextSteps(data, R);
  const sections: [LucideIcon, string, boolean, string][] = [
    [UserRoundIcon, "Household and ages", !!pr.who && !!p1.by, "/dashboard/setup"],
    [BanknoteIcon, "Pay", p1.pay != null, "/dashboard/income"],
    [ReceiptIcon, "Spending", pr.spend != null, "/dashboard/spending"],
    [WalletIcon, "Accounts", false, "/dashboard/accounts"],
    [WalletIcon, "Debts", false, "/dashboard/accounts"],
    [HouseIcon, "Home", pr.home != null, "/dashboard/home"],
    [SunsetIcon, "Retirement plans", false, "/dashboard/retirement"],
    [IdCardIcon, "Social Security", false, "/dashboard/retirement"],
    [ArrowDownToLineIcon, "Withdrawal strategy", false, "/dashboard/retirement"],
  ];
  const filled = sections.filter((s) => s[2]).length;
  const tl = timeline(data, R);
  const names = people(pr).map((p, i) => p.name.trim() || (i ? "partner" : "You")).join(" and ");

  const hello = last && data.entries.length > 1
    ? <><span>Your last entry was <b>{longDate(last.date)}</b>, {daysSince(last.date)} days ago.</span><div className="dsh-r"><Button nativeButton={false} render={<Link href="/dashboard/accounts" />}>Update balances</Button></div></>
    : <><span><b>Welcome{p1.name.trim() ? ", " + p1.name.trim() : ""}.</b> <span className="dsh-muted">This is your starting point. Fill in the dashed tiles to sharpen it.</span></span>
      <div className="dsh-r"><span className="dsh-cap">Profile {filled} of {sections.length}</span><div className="dsh-segs" aria-hidden="true">{sections.map((s, i) => <i key={s[1]} className={i < filled ? "dsh-on" : undefined} />)}</div></div></>;

  return (
    <Frame current="overview" title="Overview" sub={names + (last ? " · updated " + longDate(last.date) : "")}>
      <div className="dsh-hello">{hello}</div>
      <div className="dsh-grid dsh-r1">
        <Tile icon={WalletIcon} title="Net worth" right={
          <div className="dsh-nwhead">
            <span className="dsh-legend"><span><i />Your entries</span><span><i className="dsh-d" />Projected</span><span><i className="dsh-b" />8 in 10 markets</span></span>
            <Segmented aria-label="How far to show">
              {([["recent", "Recent"], ["retire", "To retirement"], ["all", "Whole plan"]] as const).map(([k, l]) => (
                <SegmentedItem key={k} pressed={range === k} onPressedChange={() => setRange(k)}>{l}</SegmentedItem>
              ))}
            </Segmented>
          </div>
        }>
          <div className="dsh-nwfigs">
            <div>
              <div className="dsh-fig dsh-key">{money(nw)}</div>
              <div className="dsh-cap dsh-mt6">
                {prev ? <><span className={netWorth(last) >= netWorth(prev) ? "dsh-chg dsh-up" : "dsh-chg dsh-dn"}>{netWorth(last) >= netWorth(prev) ? "↑" : "↓"} {money(Math.abs(netWorth(last) - netWorth(prev)))}</span> since your last entry
                  {yearAgo && yearAgo !== prev ? <>, <span className="dsh-chg dsh-up">{money(netWorth(last) - netWorth(yearAgo))}</span> in a year</> : null}</>
                  : pr.home === "own" ? "Savings plus home equity, today" : "Savings, today"}
              </div>
            </div>
            {retAt ? <div className="dsh-sec"><div className="dsh-label">At retirement, {R.retireYear}</div><div className="dsh-fig">{shortMoney(retAt.v)}</div></div> : null}
            {end && p1.by ? <div className="dsh-sec"><div className="dsh-label">At 95, {yearAt(p1, 95)}</div><div className="dsh-fig">{shortMoney(end.v)}</div></div> : null}
          </div>
          <div className="dsh-mt">
            {R.path.length ? <NetWorthChart hist={hist.length ? hist : [{ t: nowYear(), v: nw }]} proj={R.path} marks={marks} until={until} />
              : <p className="dsh-cap">Your projection appears once setup has your age, savings, retirement age and spending.</p>}
          </div>
          <div className="dsh-foot"><span className="dsh-cap">In today&apos;s dollars. {data.entries.length > 1 ? `${data.entries.length} entries since ${longDate(data.entries[0].date)}.` : "Each time you update your balances, a new point joins the line."}</span></div>
        </Tile>
        <div className="dsh-side"><Readiness R={R} /><Chance R={R} /></div>
      </div>

      <div className="dsh-grid dsh-r2">
        <Tile icon={BanknoteIcon} title="Retirement income">
          <div className="dsh-fig dsh-mt">{R.savingsIncome != null ? money10(R.savingsIncome) : "—"}<small>per month</small></div>
          <div className="dsh-cap dsh-mt6">from savings, in today&apos;s dollars</div>
          <div className="dsh-foot"><span className="dsh-cap">{pr.spend != null ? <>You plan to spend <b>{money(pr.spend)}</b> per month</> : "Add your spending to compare"}</span></div>
        </Tile>
        <Empty icon={IdCardIcon} title="Social Security" ghost="$—" text="We've guessed from today's pay. Add your earnings record for your real benefit and the best age to claim." action="Check your benefit" href="/dashboard/retirement" />
        <Empty icon={ArrowDownToLineIcon} title="Withdrawal strategy" ghost="—" text="Pick how you'll draw money in retirement. We'll test it against every past market." action="Choose a strategy" href="/dashboard/retirement" />
        <Empty icon={ShieldCheckIcon} title="Emergency fund" ghost="— months" text="Add a savings or checking account to see how many months of spending you have set aside." action="Add cash accounts" href="/dashboard/accounts" />
      </div>

      <div className="dsh-grid dsh-r3">
        <Tile icon={ListChecksIcon} title="What to do next" right={<span className="dsh-cap">Ordered by how much each moves your plan</span>}>
          <ol className="dsh-steps">
            {steps.map((s, i) => (
              <li key={s.title} className="dsh-step"><span className="dsh-num">{i + 1}</span><div><b>{s.title}</b><span>{s.why}</span></div><Button variant="outline" size="sm" nativeButton={false} render={<Link href={s.href} />}>{s.action}</Button></li>
            ))}
          </ol>
        </Tile>
        <Tile icon={UserRoundIcon} title="Your profile" right={<span className="dsh-cap">{filled} of {sections.length} sections</span>}>
          <div className="dsh-secs">
            {sections.map(([Icon, name, ok, href]) => (
              <div key={name}><Icon aria-hidden="true" /><span>{name}</span>
                {ok ? <span className="dsh-ok" aria-label="Done"><CheckIcon aria-hidden="true" /></span> : <Button variant="link" size="inline" className="dsh-go" nativeButton={false} render={<Link href={href} />}>Fill in</Button>}
              </div>
            ))}
          </div>
          <div className="dsh-foot"><Button variant="link" size="inline" nativeButton={false} render={<Link href="/dashboard/setup" />}>Back to setup →</Button></div>
        </Tile>
      </div>

      {tl.lanes.length ? (
        <div className="dsh-r4">
          <Tile icon={CalendarDaysIcon} title="Your timeline" right={<span className="dsh-cap">Today is the amber line</span>}>
            <div className="dsh-mt"><Timeline lanes={tl.lanes} from={tl.from} to={tl.to} now={nowYear()} /></div>
          </Tile>
        </div>
      ) : null}
    </Frame>
  );
}
