"use client";

/* Chapter 2 · Where you stand (doc 2, cards 2 to 5 and the deeper Home and
   big goals): income and what reaches the bank, spending, the safety net,
   debt, and the house and college goals that shape spending later. Each
   card teaches the idea its question depends on, asks two or three things,
   and says what the answers mean in the person's own figures. The trips
   into the tools that find these numbers are on the Full walkthrough. */

import { money, pctStr } from "@/lib/format";
import { gross, mar, months, ok, parts, payParts, pos, taxEst } from "../calc";
import { PayBar } from "../charts/PayBar";
import { Lesson, Term } from "../lessons/Lesson";
import { SourceBadge } from "../SourceBadge";
import { BackNote, Callout, Choice, H3, MoneyF, NumF, Q, Task, useGuideView } from "../ui";
import { Learn, Means, Numbers } from "../zones";
import { NativeRange } from "@/components/ui/native-range";

const points = (a: Parameters<typeof parts>[0], id: "cushion" | "debt" | "flow", w: number) => {
  const p = parts(a, null)[id];
  return p ? Math.round(p.p * w) + " of " + w : null;
};

/* ---------- Card 2 · Income and take-home ---------- */
export function IncomeCard() {
  const G = useGuideView(), { v, a, g } = G, P = payParts(a), full = g.pace === "full";
  // An answer with no recorded source (from the household bar, say) is the
  // person's own, as the confidence line counts it.
  const s = g.src.takehome, mine = s ? s.kind !== "estimated" : pos(a.takehome);
  return (
    <>
      <Q>What do you earn, and what reaches your account?</Q>
      <Learn>
        <Lesson id="take-home" figure={P ? <PayBar P={P} /> : null} caption={P ? "A month of your pay by the 2026 rules, before a 401(k) or health insurance." : null}>
          <p>Your salary is the gross: the headline figure on an offer letter. Less of it reaches your bank account. Federal and state income tax come
            {" "}out, then Social Security and Medicare, then anything your employer takes before paying you, like 401(k) contributions and health insurance.</p>
          <p>What&apos;s left is your <Term k="takehome">take-home pay</Term>. It&apos;s what your spending has to fit inside, so it&apos;s the figure the next cards use.</p>
        </Lesson>
      </Learn>
      <BackNote step="income" />
      <Numbers moreOpen={!!mine} more={<>
        <div className="gd-fields"><MoneyF k="takehome" label="Your actual take-home" per="/mo"
          hint={mar(v) ? "For the two of you together, from your pay stubs." : "From your pay stub. Paid every two weeks? One paycheck × 26 ÷ 12."} /></div>
        {full ? <Task id="tax" head="Work it out with the Income Tax tool" label={s?.kind === "tool" ? "Open Income Tax again" : null} /> : null}
      </>} moreLabel="Know your real take-home?">
        <div className="gd-fields">
          <MoneyF k="income" label="Your gross income" per="/yr" hint="Self-employed? Use net profit. Not working? Enter 0." />
          {mar(v) ? <MoneyF k="income2" label="Spouse's gross income" per="/yr" /> : null}
        </div>
      </Numbers>
      <Means>
        {!ok(a.income) ? <p className="gd-means-empty">What reaches your account appears once your income is in.</p>
          : !(gross(a) > 0) ? <p className="gd-means-empty">With no income from work, the cards ahead skip take-home and the savings rate.</p>
            : (
              <ul className="gd-read">
                <li>{mine ? "You take home " : "About "}<b>{money(a.takehome || 0)}</b> a month{mine ? "" : " reaches your account"} from <b>{money(gross(a))}</b> a year{mar(a) ? " between you" : ""}. <SourceBadge s={s} /></li>
                {mine && Math.abs(taxEst(a) - (a.takehome || 0)) >= 100 ? <li>The tax rules alone would leave about {money(taxEst(a))}; the {money(Math.abs(taxEst(a) - (a.takehome || 0)))} between is
                  {taxEst(a) > (a.takehome || 0) ? " likely what comes out before you're paid, such as 401(k) contributions and health insurance." : " likely deductions the estimate doesn't know about."}</li>
                  : !mine ? <li>That&apos;s before any 401(k) or health insurance taken from your pay. If your pay stub shows less, enter it under <b>Know your real take-home?</b></li> : null}
              </ul>
            )}
      </Means>
    </>
  );
}

/* ---------- Card 3 · What you spend ---------- */
export function SpendCard() {
  const G = useGuideView(), { a, g } = G, full = g.pace === "full";
  const th = pos(a.takehome) ? a.takehome : 0;
  const share = th && pos(a.spend) ? Math.round((a.spend / th) * 100) : 80;
  return (
    <>
      <Q>What do you spend each month?</Q>
      <Learn>
        <Lesson id="keystone">
          <p>Of every figure in a plan, spending matters most. It sizes your emergency fund, sets what&apos;s left to save, and is the best first guess at what
            {" "}retirement will cost. Three ways to find it: build a budget line by line, add up two months of bank and card statements, or start from
            {" "}take-home and take away what you save. Any of them beats a guess.</p>
        </Lesson>
      </Learn>
      <BackNote step="spending" />
      <Numbers>
        <div className="gd-fields">
          <MoneyF k="spend" label="Monthly spending" per="/mo" full hint="Everything except what you save or invest: housing, bills, food, car, fun, and yearly costs ÷ 12." />
        </div>
        {th ? (
          <div className="gd-slide">
            <label htmlFor="gdSpendSlide">Or a quick estimate: <b>{share}%</b> of your take-home</label>
            <NativeRange id="gdSpendSlide" min={40} max={110} step={1} value={Math.max(40, Math.min(110, share))}
              aria-valuetext={share + "% of take-home, " + money(Math.round((th * share) / 100 / 50) * 50) + " a month"}
              onChange={(e) => G.set("spend", Math.round((th * +e.target.value) / 100 / 50) * 50, true, "estimated")} />
          </div>
        ) : null}
        {full ? <Task id="budget" head="Build it line by line in the Budget tool" label={g.src.spend?.kind === "tool" ? "Open Budget again" : null} /> : null}
      </Numbers>
      <Means><FlowReadout /></Means>
    </>
  );
}
function FlowReadout() {
  const { a, g } = useGuideView();
  if (!pos(a.spend)) return <p className="gd-means-empty">What&apos;s left each month appears once your spending is in.</p>;
  if (!pos(a.takehome)) return <ul className="gd-read"><li>{money(a.spend)} a month. <SourceBadge s={g.src.spend} /></li></ul>;
  const left = a.takehome - a.spend, pct = left / a.takehome, pts = points(a, "flow", 10);
  if (left < 0) return <Callout cls="bad">You&apos;re spending <b>{money(-left)} a month more</b> than you bring home. That gap usually lands on a credit card, so it&apos;s the first thing to fix. {pts ? "Cash flow scores " + pts + "." : ""}</Callout>;
  const sv = pos(a.bgSave) && a.bgSave <= left ? a.bgSave : 0;
  return (
    <ul className="gd-read">
      <li><b>{money(left)} a month</b> unspent, <b>{pctStr(pct, 0)}</b> of take-home{sv ? <>: {money(sv)} already going to savings and {money(left - sv)} left over</> : ", for saving and paying down debt"}. <SourceBadge s={g.src.spend} /></li>
      <li>Spending no more than 80% of take-home earns full marks for cash flow{pts ? "; yours scores " + pts : ""}.{pct < 0.1 ? " Under 10% leaves little room for surprises." : ""}</li>
    </ul>
  );
}

/* ---------- Card 4 · Your safety net ---------- */
export function SafetyCard() {
  const { a } = useGuideView();
  return (
    <>
      <Q>How much cash do you have for emergencies?</Q>
      <Learn>
        <Lesson id="months">
          <p>An <Term k="emergency">emergency fund</Term> is measured in months of spending, not dollars. Three to six months is the usual target: toward six
            {" "}with one income, children, or pay that varies; toward three with two steady incomes. It comes before investing because it protects the plan
            {" "}itself: without it, a car repair or a gap between jobs lands on a credit card.</p>
        </Lesson>
      </Learn>
      <Numbers>
        <div className="gd-fields"><MoneyF k="cash" label="Cash savings" full hint="Checking, savings and money market accounts; not retirement accounts or investments you'd have to sell." /></div>
      </Numbers>
      <Means>
        {!ok(a.cash) ? <p className="gd-means-empty">How many months it covers appears once it&apos;s in, even if it&apos;s 0.</p>
          : !pos(a.spend) ? <p className="gd-means-empty">Enter your monthly spending on the card before this one to see how many months this covers.</p>
            : (() => {
              const m = a.cash / a.spend, pts = points(a, "cushion", 15);
              return (
                <ul className="gd-read">
                  <li><b>{months(m)} {m === 1 ? "month" : "months"}</b> of spending. The usual target is 3 to 6: <b>{money(a.spend * 3)}</b> to <b>{money(a.spend * 6)}</b> for you.</li>
                  <li>{m < 1 ? "Start with one month, " + money(a.spend) + ", before anything else. " : ""}Six months earns full marks for the emergency fund{pts ? "; yours scores " + pts : ""}.</li>
                </ul>
              );
            })()}
      </Means>
    </>
  );
}

/* ---------- Card 5 · Debt ---------- */
export function DebtCard() {
  const G = useGuideView(), { v, a, g } = G, full = g.pace === "full";
  return (
    <>
      <Q>Do you owe money on anything besides a mortgage?</Q>
      <Learn>
        <Lesson id="eight-percent">
          <p>Paying off a debt that charges 8% earns a sure 8%, with no risk and no tax. Investing rarely beats that reliably, so debt at 8% or more comes
            {" "}before saving beyond your employer&apos;s match. Most credit cards are far above it; the <Term k="apr">APR</Term> is on each statement.
            {" "}Debt under the line, like most mortgages and student loans, can be paid on schedule while you invest.</p>
        </Lesson>
        <Lesson id="order">
          <p>A common order: first, put in enough to collect any <Term k="match">employer match</Term>, an instant 50% or 100% return. Then pay off debt at 8%
            {" "}or more. Then build three months of spending in cash. Then save more for retirement. Each step protects the one after it.</p>
        </Lesson>
      </Learn>
      <BackNote step="debt" />
      <Numbers>
        <div className="gd-choices two">
          <Choice k="debtHas" val="no" title="No, nothing" sub="Or only a mortgage" />
          <Choice k="debtHas" val="yes" title="Yes" sub="Credit cards, car, student or personal loans" />
        </div>
        {v.debtHas === "yes" ? (
          <>
            <div className="gd-fields"><MoneyF k="debtTotal" label="Total you owe" />
              <MoneyF k="debtHi" label="Of that, at 8% interest or more" hint="Credit cards almost always are." /></div>
            {full ? <Task id="debt" head="List them in Debt Payoff for a debt-free date" label={g.src.debtTotal?.kind === "tool" ? "Open your plan in Debt Payoff again" : null} /> : null}
          </>
        ) : null}
      </Numbers>
      <Means>
        {a.debtHas === "no" ? <ul className="gd-read"><li>Nothing owed besides any mortgage: full marks for debt, and nothing ahead of saving but the match.</li></ul>
          : a.debtHas !== "yes" || !ok(a.debtTotal) ? <p className="gd-means-empty">What it means for your plan appears once you&apos;ve answered.</p>
            : (() => {
              const hi = Math.min(a.debtHi || 0, a.debtTotal), pts = points(a, "debt", 15);
              return (
                <ul className="gd-read">
                  {hi > 0 ? <li><b>{money(hi)}</b> at 8% or more: that comes before extra investing, after any employer match.</li>
                    : <li>Nothing at 8% or more: pay it on schedule while you invest.</li>}
                  <li>{money(a.debtTotal)} owed in all{pts ? "; debt scores " + pts : ""}. Nothing owed at 8% or more earns full marks.</li>
                </ul>
              );
            })()}
      </Means>
    </>
  );
}

/* ---------- Deeper · Home and big goals ---------- */
export function GoalsCard() {
  const G = useGuideView(), { v, a } = G;
  const inc = gross(a), p = pos(a.housePay) && inc > 0 ? (a.housePay * 12) / inc : null;
  return (
    <>
      <Q>Your home and the big goals</Q>
      <Learn>
        <Lesson id="housing">
          <p>Housing is most people&apos;s biggest cost. Lenders and planners like the whole house payment, the <Term k="piti">PITI</Term> plus any PMI and HOA
            {" "}dues, at or under 28% of gross income; past about 36%, the rest of the plan gets squeezed.</p>
          <p>College matters too, but retirement comes first: there are loans for college and none for retirement, and a parent who&apos;s secure later is
            {" "}one less cost for their children.</p>
        </Lesson>
      </Learn>
      <BackNote step="goals" />
      <Numbers>
        <H3>What&apos;s your housing situation?</H3>
        <div className="gd-choices">
          <Choice k="home" val="rent" title="I rent, with no plans to buy soon" />
          <Choice k="home" val="buy" title="I'd like to buy in the next few years" sub="See what a home would cost each month" />
          <Choice k="home" val="mortgage" title="I own and I'm paying off a mortgage" />
          <Choice k="home" val="own" title="I own my home outright" />
          <Choice k="home" val="other" title="Something else" sub="Living with family, or it's complicated" />
        </div>
        {v.home === "buy" || v.home === "mortgage" ? (
          <>
            <div className="gd-fields"><MoneyF k="housePay" label={v.home === "buy" ? "Expected house payment" : "Your house payment"} per="/mo" full
              hint="Loan, property tax, insurance, PMI and HOA. The Mortgage Calculator works it out." /></div>
            {v.home === "mortgage" ? <><H3>Will it be paid off by the time you retire?</H3>
              <div className="gd-choices two"><Choice k="mortPaid" val="yes" title="Yes" sub="Your spending drops once it's gone" /><Choice k="mortPaid" val="no" title="No, or not sure" /></div></> : null}
            <Task id={v.home === "buy" ? "mortBuy" : "mortOwn"} head={v.home === "buy" ? "Price it in the Mortgage Calculator" : "Try extra payments in the Mortgage Calculator"} />
          </>
        ) : null}
        <H3>Are you saving for a child&apos;s college?</H3>
        <div className="gd-choices two"><Choice k="college" val="yes" title="Yes, or I'd like to" /><Choice k="college" val="no" title="No, or it doesn't apply" /></div>
        {v.college === "yes" ? (
          <>
            <div className="gd-fields"><NumF k="kidAge" label="Youngest child's age" affix="age" hint="Not born yet? Enter 0." />
              <MoneyF k="collegeMo" label="Monthly for college" per="/mo" hint="College Savings works it out." /></div>
            <Task id="college" head="Find the number with College Savings" />
          </>
        ) : null}
      </Numbers>
      <Means>
        {!a.home && !a.college ? <p className="gd-means-empty">What these mean for your plan appears as you answer.</p> : (
          <ul className="gd-read">
            {p != null ? <li>Housing: <b>{money(a.housePay!)}/mo</b>, <b>{pctStr(p, 0)}</b> of gross income{p <= 0.28 ? ", inside the 28% line." : p <= 0.36 ? ", above 28% but under 36%." : ", above 36%: the rest of the plan feels it."}</li> : null}
            {a.home === "mortgage" && a.mortPaid === "yes" ? <li>Paid off by retirement, so retirement spending can drop by the loan payment; the spending card offers that figure.</li> : null}
            {a.college === "yes" && pos(a.collegeMo) ? <li>College: <b>{money(a.collegeMo)}/mo</b>, on top of retirement saving, not instead of it.</li>
              : a.college === "yes" ? <li>College Savings finds the monthly figure from the child&apos;s age and the kind of school.</li> : null}
            {a.home === "rent" || a.home === "own" || a.home === "other" ? <li>No house payment to plan around here.</li> : null}
          </ul>
        )}
        {a.college === "yes" ? <Callout cls="warn"><b>Retirement comes first.</b> There are loans for college but none for retirement.</Callout> : null}
      </Means>
    </>
  );
}

