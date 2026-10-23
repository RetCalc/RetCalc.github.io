"use client";

/* The Dashboard's pages, each signed in only. */

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

const PAGES: Record<Exclude<Section, "overview" | "tools">, () => React.JSX.Element> = {
  profile: Profile, accounts: Accounts, home: Home, income: Income, taxes: Taxes, spending: Spending, savings: Savings,
  retirement: Retirement, next: NextSteps,
};

export function OverviewPage() {
  return <SignedIn><Overview /></SignedIn>;
}

export function SetupPage() {
  return <SignedIn><Setup /></SignedIn>;
}

export function SectionPage({ id }: { id: Exclude<Section, "overview" | "tools"> }) {
  const Page = PAGES[id];
  return <SignedIn><Page /></SignedIn>;
}
