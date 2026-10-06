# Product

<!-- impeccable:product-schema 1 -->

<!-- Written 2026-10-06 by /impeccable init. At the owner's direction, the
     answers come from REDESIGN_BRIEF.md and DESIGN.md (both the owner's
     decisions) and from the repository, not from a fresh interview. Facts
     taken only from the code are marked "(from the code)". -->

## Platform

web

## Users

1. **DIY savers, about 25 to 45**, who want a quick, credible answer to "am I saving enough, and what will I have?" They start on the Calculator's Basic mode or the Retirement Readiness Guide, often on a phone, and want the answer on the first screen.
2. **Advanced self-directed planners** (FIRE and Bogleheads-style) who use the Drawdown Simulator, Plan Optimizer and Roth tools, check the assumptions, and want rigor: historical sequences, tax rules, withdrawal strategies, and the engine's own bookkeeping.

Both are served by the same pages: simple on the first screen, depth on demand.

## Product Purpose

RetCalc (retcalc.app) is a free, privacy-first retirement and financial planning suite built around a compound interest calculator, with about 20 connected tools. Tagline: "Know your number."

It exists to give people a trustworthy number about their own retirement without handing over their data, paying, or signing up. Success is a visitor who leaves knowing their number, understanding roughly why, and able to go deeper when they want to.

## Positioning

Everything runs in the browser. There are no logins, no database and no payments; nothing a visitor types leaves their browser. Unlike account-based planners in the same category (ProjectionLab is the reference), RetCalc asks for nothing up front, and the tools share one household and one set of saved scenarios so a plan can move from tool to tool. Results are tested against every historical market since 1926, not only an average return.

## Operating Context

- Used on desktops and phones, in both dark and light themes, with a System / Dark / Light switch. It can also be installed to a phone's home screen as a web app (from the code).
- Every tool has its own URL and a written article explaining it, read by search engines as well as visitors.
- Outputs leave the site as a printed one-page summary, a share link, a share summary, a share image card, and CSV exports.
- Inputs, saved scenarios and the household are kept only in the visitor's browser storage (from the code).
- Hosted on Vercel from `main`; production counts visits with Cloudflare Web Analytics (from the code, MIGRATION.md).

## Capabilities and Constraints

**Capabilities**
- **Calculator:** Basic, Advanced and Stages modes.
- **Retirement Readiness Guide:** a step-by-step flow ending in a score and a plan.
- **Tools** (from the code, `web/lib/tools.ts`):
  - *Retirement income:* Plan Optimizer, Drawdown Simulator (with eight withdrawal-strategy pages), Early Retirement Bridge, Roth Conversion & RMDs, Healthcare Cost Planner.
  - *Saving and investing:* FIRE Calculator, Portfolio Backtest, College Savings, Rent vs. Buy.
  - *Everyday money:* Income Tax, Budget, Debt Payoff, Mortgage Calculator.
  - Plus 72(t), RMD and the strategy pages.
- **Shared across tools:** the household bar, saved scenarios, Compare, Share, the print summary and CSV export.

**Constraints**
- **No calculation changes during the redesign.** The redesign changes styling, layout and markup only. No calculation, tax, simulation or data file, formula, or displayed number changes. `node scripts/baseline/numbers.mjs check` (from `web/`) must pass after every batch of changes.
- **URLs stay.** All existing URLs and routes stay.
- **Loading.** Fonts load through next/font (self-hosted, no layout shift). No heavy new JavaScript or images.
- **Theme switch.** The System / Dark / Light toggle keeps its current behavior.

**Open decisions** (logged in REDESIGN_NOTES.md, not decided)
- Whether the System theme should follow the OS while a page is open.
- What the Debt Payoff tool shows when the chosen plan itself never clears.
- The Portfolio Backtest yearly rebalance count fix, which is left for the math audit.

## Brand Commitments

- **Name and tagline:** the name "RetCalc" and the tagline "Know your number."
- **Logo:** kept exactly as it is, in shape and in its gold, jade and steel.
- **Bow-and-arrow motif:** the Guide's progress bar and the Plan Optimizer's loading bar are brand elements and stay. They are not gamification.
- **Statements:**
  - "Nothing leaves your browser."
  - The disclaimers: an educational tool, not financial or tax advice; past returns don't predict future ones.
- **Voice:** precise, calm, trustworthy, numbers-first. A serious instrument, not a fintech app. Some playfulness is welcome in small moments.
- **Never:**
  - hype
  - gamification (points, badges, streaks, confetti)
  - money emoji
  - stock photos of retirees
- **References named by the owner:**
  - ProjectionLab, for the category
  - Stripe and Linear, for restraint and typography
  - the FT and Observable, for chart clarity

## Evidence on Hand

- **Historical market data** back to 1926, which the Drawdown Simulator, Backtest and strategy pages run against (from the code).
- **Written articles** for each tool, in `web/content/articles/`, citing the tax rules they implement (e.g. IRS Notice 2022-6 for 72(t)).
- **A numbers baseline** of every tool's outputs (`web/scripts/baseline/`) and math tests (`tests/`).
- **Not on hand:** no testimonials, user counts, reviews, press or endorsements. Don't invent them.

## Product Principles

1. **The answer comes first.** Every tool leads with its key result; explanation and depth follow for whoever wants them.
2. **Trust is earned by honesty.** Show the assumptions, the historical range and the disclaimers. Never overstate certainty, never sell.
3. **Private by construction.** Nothing a visitor enters leaves their browser, and nothing asks them to sign up.
4. **One plan, many tools.** The household, scenarios and comparisons carry across tools, so the suite works as one planner.
5. **The numbers are sacred.** Presentation can change freely; the calculations and the figures they produce cannot change without a deliberate, separate decision.

## Accessibility & Inclusion

- **Contrast.** Text meets 4.5:1 contrast in both themes, including text on tinted pills.
- **Color.** Color never carries meaning alone: gain and loss always pair with an icon and a label.
- **Motion.** Every animation respects `prefers-reduced-motion`. Anything that animates on hover also responds to keyboard focus and tap.
- **Guide progress.** The Guide's progress is exposed to assistive technology as a real progress bar with a visible step label.
- **Phones.** Dense tables scroll sideways inside their own container, so the page never scrolls horizontally.
