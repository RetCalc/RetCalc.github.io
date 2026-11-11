"use client";

/* The interactive pictures some lessons have (content/lessons/README.md),
   each built to match its lesson's text. Each is loaded on its own, so a
   lesson only fetches the one it shows. */

import dynamic from "next/dynamic";

type W = (p: { label: string }) => React.JSX.Element;

const WIDGETS: Record<string, React.ComponentType<{ label: string }>> = {
  "sequence": dynamic<{ label: string }>(() => import("./Sequence").then((m) => m.Sequence as W)),
  "compound": dynamic<{ label: string }>(() => import("./Compound").then((m) => m.Compound as W)),
  "fees": dynamic<{ label: string }>(() => import("./Fees").then((m) => m.Fees as W)),
  "claim-age": dynamic<{ label: string }>(() => import("./ClaimAge").then((m) => m.ClaimAge as W)),
  "brackets": dynamic<{ label: string }>(() => import("./Brackets").then((m) => m.Brackets as W)),
  "inflation": dynamic<{ label: string }>(() => import("./Inflation").then((m) => m.Inflation as W)),
  "savings-rate": dynamic<{ label: string }>(() => import("./SavingsRate").then((m) => m.SavingsRate as W)),
  "withdrawal-rate": dynamic<{ label: string }>(() => import("./WithdrawalRate").then((m) => m.WithdrawalRate as W)),
  "rmd": dynamic<{ label: string }>(() => import("./Rmd").then((m) => m.Rmd as W)),
  "roth-or-traditional": dynamic<{ label: string }>(() => import("./RothOrTraditional").then((m) => m.RothOrTraditional as W)),
  "torpedo": dynamic<{ label: string }>(() => import("./Torpedo").then((m) => m.Torpedo as W)),
  "gains-stack": dynamic<{ label: string }>(() => import("./GainsStack").then((m) => m.GainsStack as W)),
  "conversion-brackets": dynamic<{ label: string }>(() => import("./ConversionBrackets").then((m) => m.ConversionBrackets as W)),
  "irmaa-steps": dynamic<{ label: string }>(() => import("./IrmaaSteps").then((m) => m.IrmaaSteps as W)),
  "qcd": dynamic<{ label: string }>(() => import("./Qcd").then((m) => m.Qcd as W)),
  "state-retirement-tax": dynamic<{ label: string }>(() => import("./StateRetirementTax").then((m) => m.StateRetirementTax as W)),
  "match": dynamic<{ label: string }>(() => import("./Match").then((m) => m.Match as W)),
  "dollar-order": dynamic<{ label: string }>(() => import("./DollarOrder").then((m) => m.DollarOrder as W)),
  "ira-phaseout": dynamic<{ label: string }>(() => import("./IraPhaseout").then((m) => m.IraPhaseout as W)),
  "solo-limits": dynamic<{ label: string }>(() => import("./SoloLimits").then((m) => m.SoloLimits as W)),
  "cash-out": dynamic<{ label: string }>(() => import("./CashOut").then((m) => m.CashOut as W)),
  "location": dynamic<{ label: string }>(() => import("./Location").then((m) => m.Location as W)),
  "outcome-range": dynamic<{ label: string }>(() => import("./OutcomeRange").then((m) => m.OutcomeRange as W)),
  "stock-share": dynamic<{ label: string }>(() => import("./StockShare").then((m) => m.StockShare as W)),
  "success-rate": dynamic<{ label: string }>(() => import("./SuccessRate").then((m) => m.SuccessRate as W)),
  "guardrails": dynamic<{ label: string }>(() => import("./Guardrails").then((m) => m.Guardrails as W)),
  "rebalance": dynamic<{ label: string }>(() => import("./Rebalance").then((m) => m.Rebalance as W)),
  "annuity-share": dynamic<{ label: string }>(() => import("./AnnuityShare").then((m) => m.AnnuityShare as W)),
  "ss-career": dynamic<{ label: string }>(() => import("./SsCareer").then((m) => m.SsCareer as W)),
  "couple-claim": dynamic<{ label: string }>(() => import("./CoupleClaim").then((m) => m.CoupleClaim as W)),
  "ss-cut": dynamic<{ label: string }>(() => import("./SsCut").then((m) => m.SsCut as W)),
  "longevity": dynamic<{ label: string }>(() => import("./Longevity").then((m) => m.Longevity as W)),
  "target": dynamic<{ label: string }>(() => import("./Target").then((m) => m.Target as W)),
  "one-more-year": dynamic<{ label: string }>(() => import("./OneMoreYear").then((m) => m.OneMoreYear as W)),
  "aca-premium": dynamic<{ label: string }>(() => import("./AcaPremium").then((m) => m.AcaPremium as W)),
  "saving-pause": dynamic<{ label: string }>(() => import("./SavingPause").then((m) => m.SavingPause as W)),
  "inherited-ira": dynamic<{ label: string }>(() => import("./InheritedIra").then((m) => m.InheritedIra as W)),
  "payoff-or-invest": dynamic<{ label: string }>(() => import("./PayoffOrInvest").then((m) => m.PayoffOrInvest as W)),
  "advisor-cost": dynamic<{ label: string }>(() => import("./AdvisorCost").then((m) => m.AdvisorCost as W)),
};

export function Widget({ name, label }: { name: string; label: string }) {
  const C = WIDGETS[name];
  return C ? <C label={label} /> : null;
}
