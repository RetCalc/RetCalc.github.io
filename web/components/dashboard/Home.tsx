"use client";

/* Home: what it's worth and what's owed (from Accounts), the mortgage's
   rate and payment, and when it's paid off; or the rent. */

import Link from "next/link";
import { Building2Icon, HouseIcon, LandmarkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoneyField, NumberField } from "@/components/fields/Field";
import { Frame } from "./Frame";
import { toolHref } from "./host";
import { num, pctTxt, txt } from "./fields";
import { MONTHS, money } from "./format";
import { mortgage } from "./model";
import { useDashboard } from "./store";
import { Note, Tile } from "./ui";

export function Home() {
  const { data, setProfile: set } = useDashboard();
  const pr = data.profile, M = mortgage(pr, data.entries);
  const paidOff = M.payoff != null ? `${MONTHS[Math.floor((M.payoff % 1) * 12)]} ${Math.floor(M.payoff)}` : null;
  if (pr.home === "rent") {
    return (
      <Frame current="home" title="Home" sub="Renting">
        <Tile icon={Building2Icon} title="Rent">
          <div className="dsh-fields dsh-fields-sm"><div className="dsh-row">
            <MoneyField id="dshHRent" label="Rent" unit="per month" value={txt(pr.rent)} onValueChange={(v) => set((p) => ({ ...p, rent: num(v) }))} /><div />
          </div></div>
          <div className="dsh-foot"><Button variant="link" size="inline" nativeButton={false} render={<Link href={toolHref("rentbuy", "/dashboard/home")} />}>Renting or buying: compare them in the Rent vs. Buy Calculator</Button></div>
        </Tile>
        <div className="dsh-r4"><Note>Bought a place? Switch to owning in <b>Profile</b>, then add the home and mortgage in <b>Net worth</b>.</Note></div>
      </Frame>
    );
  }
  return (
    <Frame current="home" title="Home" sub={pr.home === "own" ? "Owned" : "Not given yet"}>
      <Tile icon={HouseIcon} title="Your home" right={<Button variant="outline" size="sm" nativeButton={false} render={<Link href="/dashboard/accounts#assets" />}>Change in Net worth</Button>}>
        <div className="dsh-stats">
          <div className="dsh-stat"><div className="dsh-label">Equity</div><div className="dsh-fig dsh-key">{money(M.value - M.owed)}</div></div>
          <div className="dsh-stat"><div className="dsh-label">Worth</div><div className="dsh-fig dsh-md">{money(M.value)}</div></div>
          <div className="dsh-stat"><div className="dsh-label">Left on the mortgage</div><div className="dsh-fig dsh-md">{money(M.owed)}</div></div>
        </div>
      </Tile>
      <div className="dsh-r4"><Tile id="mortgage" icon={LandmarkIcon} title="Mortgage">
        {M.owed > 0 ? (
          <>
            <div className="dsh-fields dsh-fields-sm"><div className="dsh-row3 dsh-pair">
              <NumberField id="dshHRate" label="Interest rate" unit="%" step={0.125} max={20} value={pctTxt(M.rate)} onValueChange={(v) => set((p) => ({ ...p, mortRate: v.trim() === "" ? null : (num(v) ?? 0) / 100 }))} />
              <MoneyField id="dshHPay" label="Payment, principal and interest" unit="per month" value={txt(pr.mortPay)} onValueChange={(v) => set((p) => ({ ...p, mortPay: num(v) }))} />
              <div />
            </div></div>
            <div className="dsh-stats dsh-mt">
              <div className="dsh-stat"><div className="dsh-label">Paid off</div><div className="dsh-fig dsh-md">{paidOff ?? "—"}</div></div>
              <div className="dsh-stat"><div className="dsh-label">Interest still to pay</div><div className="dsh-fig dsh-md">{M.interest != null ? money(M.interest) : "—"}</div></div>
            </div>
            <p className="dsh-cap dsh-mt">{M.tooSmall ? "That payment doesn't cover the interest, so the balance would never fall. Check the payment and rate." : M.payoff == null ? "Add the rate and the monthly payment (without taxes and insurance) to see when it's paid off. It shows on Your timeline." : "At this payment. Paying extra brings it sooner: try it in the Mortgage Calculator, below."}</p>
            <div className="dsh-foot"><Button variant="link" size="inline" nativeButton={false} render={<Link href={toolHref("mortgage", "/dashboard/home")} />}>Open the Mortgage Calculator</Button></div>
          </>
        ) : <p className="dsh-cap dsh-mt">No mortgage in your latest entry. If you have one, add it in Net worth.</p>}
      </Tile></div>
    </Frame>
  );
}
