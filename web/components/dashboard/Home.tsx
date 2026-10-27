"use client";

/* Home. Owning: what it's worth and what's owed (from Net worth), the
   mortgage's rate and payment, and the Mortgage Calculator on your own
   loan, where what owning costs beyond the loan is set (property tax,
   insurance, PMI, HOA, upkeep, utilities), with extra payments and
   refinancing to try. Renting: the rent and renter's insurance, and the
   Rent vs. Buy Calculator on your own rent. Either way those costs are the
   budget's housing lines, which Spending shows and doesn't change. */

import { useMemo } from "react";
import { Building2Icon, HouseIcon, LandmarkIcon, ScaleIcon } from "lucide-react";
import { MoneyField, NumberField } from "@/components/fields/Field";
import { CardHeadingLevel } from "@/components/ui/card-heading";
import type { ToolInputs } from "@/components/tools/ToolState";
import { withDefaults } from "@/components/tools/ToolState";
import { groupDigits } from "@/lib/format";
import type { Inputs as MortgageInputs } from "@/tools/mortgage/model";
import { RENTBUY_DEF, type RentBuyInputs } from "@/tools/rentbuy/model";
import { Frame } from "./Frame";
import { num, pctTxt, txt, useTyped } from "./fields";
import { MONTHS, money } from "./format";
import { Hosted, TOOL_VIEWS, seedFor } from "./host";
import { fromMortgage, housingLines, mortgageFor, ownCost, payoffDrop, sameCosts } from "./housing";
import { mortgage } from "./model";
import { useDashboard, withHome } from "./store";
import { Note, PlanFacts, Tile, TipLabel, To } from "./ui";

const monthYear = (y: number) => `${MONTHS[Math.floor((y % 1) * 12)]} ${Math.floor(y)}`;

export function Home() {
  const { data, setProfile: set, update } = useDashboard();
  const pr = data.profile, entries = data.entries, M = mortgage(pr, entries);
  const [rateTxt, setRateTxt] = useTyped(pctTxt(M.rate));
  const MortgageView = TOOL_VIEWS.mortgage, RentBuy = TOOL_VIEWS.rentbuy;
  const seeded = useMemo(() => (pr.home === "own" ? mortgageFor(pr, entries) : null), [pr, entries]);

  if (pr.home === "rent") {
    const lines = housingLines(pr), total = Object.values(lines).reduce((s, v) => s + v, 0);
    return (
      <Frame current="home" title="Home" sub={pr.rent ? `Renting, ${money(total)} per month` : "Renting"}>
        <Tile icon={Building2Icon} title="Your home">
          <div className="dsh-fields dsh-fields-sm"><div className="dsh-row3">
            <MoneyField id="dshHRent" label="Rent" unit="per month" value={txt(pr.rent)} onValueChange={(v) => set((p) => ({ ...p, rent: num(v) }))} />
            <MoneyField id="dshHRentIns" label={<TipLabel text="Renter's insurance" id="rentIns" />} unit="per month" placeholder="None" value={txt(pr.rentIns ?? null)} onValueChange={(v) => set((p) => ({ ...p, rentIns: num(v) }))} />
            <div />
          </div></div>
          <p className="dsh-cap dsh-mt6">Both are your budget&apos;s housing lines on <To href="/dashboard/spending#budget">Spending</To>, changed here. Bought a place? Switch to owning in <To href="/dashboard/profile#home">Profile</To>, then add the home and mortgage in <To href="/dashboard/accounts#assets">Net worth</To>.</p>
        </Tile>
        <div className="dsh-r4">
          <Tile id="rentbuy" icon={ScaleIcon} title="Renting or buying" right={<span className="dsh-cap">On your own rent</span>}>
            <p className="dsh-cap dsh-mt6">The Rent vs. Buy Calculator, starting from your rent: what buying a home would cost over the years against renting and investing the difference. Change the home and the market to try it out; what you try is kept here.</p>
            <div className="dsh-mt">
              <Hosted key={String(pr.rent)} household={null}
                seed={(id) => (id === "rentbuy" ? ({ ...(seedFor(pr, entries)("rentbuy") as unknown as RentBuyInputs), ...withDefaults(RENTBUY_DEF, (pr.tools.rentbuy ?? {}) as Partial<RentBuyInputs>), ...(pr.rent ? { rent: groupDigits(pr.rent, true) } : {}) } as unknown as ToolInputs) : undefined)}
                keep={(id, d) => { if (id === "rentbuy") set((p) => ({ ...p, tools: { ...p.tools, rentbuy: d } })); }}>
                <CardHeadingLevel value={3}><RentBuy /></CardHeadingLevel>
              </Hosted>
            </div>
          </Tile>
        </div>
      </Frame>
    );
  }

  const own = ownCost(pr), drop = payoffDrop(pr, entries);
  const retYear = pr.p1.by != null && pr.p1.retire != null ? pr.p1.by + pr.p1.retire : null;
  return (
    <Frame current="home" title="Home" sub={pr.home === "own" ? (own != null ? `Owned, ${money(own)} per month to own` : "Owned") : "Not given yet"}>
      <Tile icon={HouseIcon} title="Your home" right={<To href="/dashboard/accounts#assets">Change in Net worth</To>}>
        <div className="dsh-stats">
          <div className="dsh-stat"><div className="dsh-label"><TipLabel text="Equity" id="equity" /></div><div className="dsh-fig dsh-key">{money(M.value - M.owed)}</div></div>
          <div className="dsh-stat"><div className="dsh-label">Worth</div><div className="dsh-fig dsh-md">{money(M.value)}</div></div>
          <div className="dsh-stat"><div className="dsh-label">Left on the mortgage</div><div className="dsh-fig dsh-md">{money(M.owed)}</div></div>
          {own != null ? <div className="dsh-stat"><div className="dsh-label"><TipLabel text="To own it, per month" id="ownCost" /></div><div className="dsh-fig dsh-md">{money(own)}<small>per month</small></div></div> : null}
        </div>
      </Tile>
      <div className="dsh-r4"><Tile id="mortgage" icon={LandmarkIcon} title="Mortgage">
        {M.owed > 0 ? (
          <>
            <div className="dsh-fields dsh-fields-sm"><div className="dsh-row3 dsh-pair">
              <NumberField id="dshHRate" label="Interest rate" unit="%" step={0.125} max={20} value={rateTxt} onValueChange={(v) => { setRateTxt(v); const r = v.trim() === "" ? null : (num(v) ?? 0) / 100; set((p) => ({ ...p, mortRate: r })); update((d) => ({ ...d, entries: withHome(d, { rate: r }) })); }} />
              <MoneyField id="dshHPay" label="Payment, principal and interest" unit="per month" value={txt(pr.mortPay)} onValueChange={(v) => set((p) => ({ ...p, mortPay: num(v) }))} />
              <div />
            </div></div>
            <div className="dsh-stats dsh-mt">
              <div className="dsh-stat"><div className="dsh-label">Paid off</div><div className="dsh-fig dsh-md">{M.payoff != null ? monthYear(M.payoff) : "—"}</div></div>
              <div className="dsh-stat"><div className="dsh-label"><TipLabel text="Interest still to pay" id="interestLeft" /></div><div className="dsh-fig dsh-md">{M.interest != null ? money(M.interest) : "—"}</div></div>
            </div>
            <p className="dsh-cap dsh-mt">{M.tooSmall ? "That payment doesn't cover the interest, so the balance would never fall. Check the payment and rate."
              : M.payoff == null ? "Add the rate and the monthly payment (without taxes and insurance) to see when it's paid off. It shows on Your timeline."
              : drop && retYear != null ? (pr.retSpend != null ? `Your spending once retired is the figure in Profile, so it stays as you set it when the mortgage is paid off.`
                : drop.year <= retYear ? `It's paid off before you retire, so your spending once retired leaves out its ${money(drop.monthly)} per month.`
                : `It's paid off after you retire, in ${Math.floor(drop.year)}: your plan keeps counting its ${money(drop.monthly)} per month through retirement. Set your spending once retired in Profile to plan otherwise.`)
              : "At this payment. Paying extra brings it sooner: try it below."}</p>
          </>
        ) : <p className="dsh-cap dsh-mt">No mortgage in your latest entry. If you have one, add it in <To href="/dashboard/accounts#debts">Net worth</To>.</p>}
      </Tile></div>
      {pr.home === "own" && M.value > 0 && seeded ? (
        <div className="dsh-r4">
          <Tile id="owning" icon={HouseIcon} title="What owning costs" right={<span className="dsh-cap">Your budget&apos;s housing lines</span>}>
            <p className="dsh-cap dsh-mt6">{pr.homeCosts
              ? <>Property tax, insurance, PMI, HOA, upkeep and utilities as set here are your budget&apos;s housing lines on <To href="/dashboard/spending#budget">Spending</To>, with the mortgage payment. Change them here.</>
              : <>Set what owning costs beyond the loan: property tax, insurance, PMI, HOA, upkeep and utilities. Once you change any, they become your budget&apos;s housing lines on <To href="/dashboard/spending#budget">Spending</To>.</>}</p>
            <div className="dsh-mt">
              <Hosted key={JSON.stringify([seeded.price, seeded.downAmt, seeded.rate, seeded.term])} household={null} locked={["loan"]}
                slots={{ facts: <PlanFacts id="moFacts" rows={[
                  ["Worth", money(M.value)],
                  ["Left on the mortgage", money(M.owed)],
                  ["Interest rate", M.rate != null ? `${+(M.rate * 100).toFixed(3)}%` : "—"],
                  ["Years left", M.months != null ? `${Math.floor(M.months / 12)} years${M.months % 12 ? `, ${M.months % 12} months` : ""}` : "—"],
                ]} note={<>The home&apos;s worth and what&apos;s owed come from <To href="/dashboard/accounts#assets">Net worth</To>, the rate and payment from Mortgage above.</>} /> }}
                seed={(id) => (id === "mortgage" ? (seeded as unknown as ToolInputs) : undefined)}
                keep={(id, d) => {
                  // Opening isn't a change: costs become the budget's only once one is changed.
                  if (id !== "mortgage" || (!pr.homeCosts && sameCosts(d as unknown as MortgageInputs, seeded))) return;
                  set((p) => fromMortgage(p, d as unknown as MortgageInputs, entries));
                }}>
                <CardHeadingLevel value={3}><MortgageView /></CardHeadingLevel>
              </Hosted>
            </div>
          </Tile>
        </div>
      ) : pr.home === "own" ? <div className="dsh-r4"><Note>Add your home&apos;s worth in <To href="/dashboard/accounts#assets">Net worth</To> to work out what owning it costs.</Note></div> : (
        <div className="dsh-r4"><Note>Own or rent? Say which in <To href="/dashboard/profile#home">Profile</To>.</Note></div>
      )}
    </Frame>
  );
}
