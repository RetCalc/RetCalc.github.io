"use client";

/* The Dashboard's pages, each signed in only (the front page otherwise). */

import { SignedIn, type Section } from "./Frame";
import { Overview } from "./Overview";
import { Setup } from "./Setup";
import { Profile } from "./Profile";
import { Accounts } from "./Accounts";
import { Home } from "./Home";
import { Income } from "./Income";
import { Spending } from "./Spending";
import { Retirement } from "./Retirement";
import { NextSteps } from "./NextStepsPage";
import { Taxes } from "./Taxes";
import { Savings } from "./Savings";
import { About } from "./About";
import { Summary } from "./Summary";
import { Calculator } from "./Calculator";

const PAGES: Record<Exclude<Section, "overview" | "tools" | "learn">, () => React.JSX.Element> = {
  profile: Profile, accounts: Accounts, home: Home, income: Income, taxes: Taxes, spending: Spending, savings: Savings,
  retirement: Retirement, next: NextSteps,
  calculator: Calculator, summary: Summary, about: About,
};

export function OverviewPage() {
  return <SignedIn><Overview /></SignedIn>;
}

export function SetupPage() {
  return <SignedIn setup><Setup /></SignedIn>;
}

export function SectionPage({ id }: { id: Exclude<Section, "overview" | "tools" | "learn"> }) {
  const Page = PAGES[id];
  return <SignedIn><Page /></SignedIn>;
}
