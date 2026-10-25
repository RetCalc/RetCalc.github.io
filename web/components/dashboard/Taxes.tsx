"use client";

/* Taxes: the Income Tax tool on your own numbers. Pay comes from Income
   and the pre-tax money through work (401(k), HSA, health premiums) from
   Savings, so moving a slider there changes the taxes here; the deductions
   and the year are chosen here. What it leaves is your pay after taxes,
   everywhere on the dashboard. */

import { LandmarkIcon } from "lucide-react";
import type { ToolInputs } from "@/components/tools/ToolState";
import type { TaxInputs } from "@/tools/tax/model";
import { Frame } from "./Frame";
import { budgetFor, flow, fromTax, taxFor } from "./flows";
import { money } from "./format";
import { Hosted, TOOL_VIEWS } from "./host";
import { outsideUS } from "./model";
import { useDashboard } from "./store";
import { Note, Tile, TipLabel } from "./ui";

export function Taxes() {
  const { data, setProfile } = useDashboard();
  const pr = data.profile, F = flow(pr), T = F.tax;
  const Tax = TOOL_VIEWS.tax;
  if (outsideUS(pr)) return (
    <Frame current="taxes" title="Taxes" sub="Outside the US">
      <Note>Outside the US we don&apos;t work out taxes: your pay is entered after taxes, and figures for retirement are before taxes.</Note>
    </Frame>
  );
  const yr = F.gross * 12;
  return (
    <Frame current="taxes" title="Taxes" sub={T ? `${money(T.federal + T.state + T.fica)} per year` : "Add your pay in Income"}>
      <Tile icon={LandmarkIcon} title="This year">
        <div className="dsh-stats">
          <div className="dsh-stat"><div className="dsh-label">Pay after taxes</div><div className="dsh-fig dsh-key">{F.hasPay ? money(F.afterTax) : "—"}<small>per month</small></div></div>
          <div className="dsh-stat"><div className="dsh-label">Federal income tax</div><div className="dsh-fig dsh-md">{T ? money(T.federal) : "—"}<small>per year</small></div></div>
          <div className="dsh-stat"><div className="dsh-label">State income tax</div><div className="dsh-fig dsh-md">{T ? money(T.state) : "—"}<small>per year</small></div></div>
          <div className="dsh-stat"><div className="dsh-label"><TipLabel text="Social Security and Medicare" id="fica" /></div><div className="dsh-fig dsh-md">{T ? money(T.fica) : "—"}<small>per year</small></div></div>
          {T && yr > 0 ? <div className="dsh-stat"><div className="dsh-label"><TipLabel text="Of your pay" k="effrate" /></div><div className="dsh-fig dsh-md">{Math.round(((T.federal + T.state + T.fica) / yr) * 1000) / 10}%</div></div> : null}
        </div>
        <p className="dsh-cap dsh-mt">Pay comes from Income, and what goes to your 401(k), HSA and health premiums from Savings: change those there. Deductions are yours to set below. Health premiums come out of pay too, so after taxes is also after them.</p>
      </Tile>
      {F.hasPay ? (
        <div className="dsh-r4">
          <Hosted household={null}
            seed={(id) => (id === "tax" ? (taxFor(pr) as unknown as ToolInputs) : id === "budget" ? (budgetFor(pr) as unknown as ToolInputs) : undefined)}
            keep={(id, d) => { if (id === "tax") setProfile((p) => fromTax(p, d as unknown as TaxInputs)); }}>
            <Tax />
          </Hosted>
        </div>
      ) : null}
    </Frame>
  );
}
