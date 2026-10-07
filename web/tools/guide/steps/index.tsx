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
import { About, Bridge, Cash, College, Debt, Health, Home, Income, Lasting, Outlook, RetSpend, Savings, Spending, TakeHome } from "./legacy";

export interface StepView { Body: () => ReactNode; Foot?: () => ReactNode }

export const VIEWS: Record<string, StepView> = {
  welcome: { Body: Welcome, Foot: WelcomeFoot },
  about: { Body: About },
  income: { Body: Income },
  takehome: { Body: TakeHome },
  spending: { Body: Spending },
  cash: { Body: Cash },
  debt: { Body: Debt },
  home: { Body: Home },
  college: { Body: College },
  savings: { Body: Savings },
  retspend: { Body: RetSpend },
  number: { Body: Outlook },
  lasting: { Body: Lasting },
  adjust: { Body: TuneStep },
  strategy: { Body: StrategyStep },
  health: { Body: Health },
  bridge: { Body: Bridge },
  optimize: { Body: OptimizeStep },
  plan: { Body: Results, Foot: ResultsFoot },
};
