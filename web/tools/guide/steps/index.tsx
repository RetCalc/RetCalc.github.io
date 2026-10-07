"use client";

/* Each card's screen, bound to its declaration (steps/decl.ts) by id. A
   card is drawn by the shell: its body, then the footer (Back, Continue
   and the reason Continue waits), or the card's own footer. */

import type { ReactNode } from "react";
import { OptimizeStep } from "../optimize";
import { Results, ResultsFoot } from "../results";
import { StrategyStep } from "../strategy";
import { TuneStep } from "../tune";
import { Welcome, WelcomeFoot } from "./ch0-welcome";
import { AboutYou } from "./ch1-timeline";
import { DebtCard, GoalsCard, IncomeCard, SafetyCard, SpendCard } from "./ch2-standing";
import { AccountsCard, InvestedCard, SavingsCard } from "./ch3-savings";
import { RetSpendCard, SocialCard } from "./ch4-costs";
import { Bridge, Health, Lasting, Outlook } from "./legacy";

export interface StepView { Body: () => ReactNode; Foot?: () => ReactNode }

export const VIEWS: Record<string, StepView> = {
  welcome: { Body: Welcome, Foot: WelcomeFoot },
  about: { Body: AboutYou },
  income: { Body: IncomeCard },
  spending: { Body: SpendCard },
  cash: { Body: SafetyCard },
  debt: { Body: DebtCard },
  goals: { Body: GoalsCard },
  savings: { Body: SavingsCard },
  invested: { Body: InvestedCard },
  accounts: { Body: AccountsCard },
  retspend: { Body: RetSpendCard },
  social: { Body: SocialCard },
  number: { Body: Outlook },
  lasting: { Body: Lasting },
  adjust: { Body: TuneStep },
  strategy: { Body: StrategyStep },
  health: { Body: Health },
  bridge: { Body: Bridge },
  optimize: { Body: OptimizeStep },
  plan: { Body: Results, Foot: ResultsFoot },
};
