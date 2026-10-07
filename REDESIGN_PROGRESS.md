# Redesign progress

The site-wide redesign pass, after Basic (the homepage, the reference for
the quality bar and patterns). Started 2026-10-06 on branch `redesign`.
Updated and committed after every page; if a session is interrupted,
re-read this file and resume from the first item that isn't done.

Status: **todo**, **in progress**, **done**, **reverted** (with the reason
in REDESIGN_NOTES.md). Per page, Phase 1 is: critique, shape (plan in
`redesign-baseline/plans/<page>.md`, not committed), implement, polish,
checks, one commit.

Hard stops, checks and the e2e rules are in the brief this pass was given;
the short form: no calculation, figure, data, disclaimer, privacy or
"how it's calculated" text, route, id, data-attribute, theme-toggle or
navigation-structure changes; logo shape and dark colors stay; logged
behavior bugs stay logged. Each recommendation skipped for a hard stop goes
under "Skipped from critique" in REDESIGN_NOTES.md.

## Setup

| Step | Status | Notes |
|---|---|---|
| Inventory and this file | done | |
| Before screenshots of every page (desktop, phone, dark, light) | done | `redesign-baseline/pages-before/` |
| Baseline full e2e at the Basic commit | done | 8fa1e04: 72 passed, 102 failed (old-site look), 2 skipped |
| Shared: hero reading as a component and a DESIGN.md variant | done | |
| Shared: masthead controls in the pinned rail, site-wide | done | REDESIGN_NOTES.md, Planned |

## Phase 1: page pass

### Calculators
| Page | Route | Status | Commit | Notes |
|---|---|---|---|---|
| Advanced | /advanced | done | f9e824f | thirds, hero reading (after-tax income), goal inputs moved left, chart header stacks on phones |
| Stages | /stages | done | 4fdf10e | thirds like Advanced, stage editor moved into the inputs with a timeline strip, hero reading, empty and 0-year states |

### Tools (Drawdown and Income Tax first)
| Page | Route | Status | Commit | Notes |
|---|---|---|---|---|
| Drawdown Simulator | /drawdown | done | 7cfb953 | thirds, hero reading (success rate in its rating tone), views as tabs each with its own answer, plan as a story, token heat grid; strategy pages share it |
| Income Tax | /incometax | done | 36ede43 | thirds, hero reading (pay or income after tax), donut + bars as one band with a reconciling note, field error on pre-tax, gain chart up and unclipped, state rules folded |
| Plan Optimizer | /optimizer | done | 75d7a3a | thirds, run first on phones, hero reading + moves under it, stale dims; loader motion still Phase 2 |
| Early Retirement Bridge | /bridge | done | f6fa405 | Thirds; hero reading (best plan, holds, cost, at 59½); sticky Following head with the market switch; detail folds |
| 72(t) | /72t | done | 9078406 | Bridge's page with variant="72t": 72(t) terms lead the inputs and facts |
| Roth Conversion & RMDs | /roth | done | 202f807 | Thirds; verdict as the headline over three peer figures (net worth relabelled vs doing nothing); conversion plan as a lever card; chart screen-only fixes, print unchanged |
| RMDs | /rmd | done | 3d2a656 | Roth's page with variant="rmd": Peak RMD leads in amber, year table open on Doing nothing, RMD column first |
| Healthcare Cost Planner | /healthcare | done | 389e6eb | Thirds; hero reading (net ACA premium, or Medicare at 65+), cliff/IRMAA warnings in the reading, phases side by side from 1100px, what-if and tiers folded |
| FIRE Calculator | /fire | done | 0c2d028 | Thirds; age at your rate of return as hero, the history answer beside its slider in the reading |
| Portfolio Backtest | /backtest | done | e74ef68 | Thirds; return per year as hero with after inflation, volatility, deepest fall; gain/loss color by sign only |
| College Savings | /college | done | defdc37 | Thirds; save per month as hero with the step-down sentence; children as flat rows; field errors, covered state, cost as a plain line on screen |
| Rent vs. Buy | /rentbuy | done | 9c44273 | Thirds; verdict as hero with ahead-by and break-even sentence; monthly costs moved into the reading; inputs unpinned on desktop; break-even marked on screen only |
| Budget | /budget | done | 114c44d | Ledger two thirds + sticky reading third; Left over hero (amber / Loss + Over budget / Text when empty), composition bar, emergency fund beside its field; phone rows name-over-field |
| Debt Payoff | /debt | done | 69b41ef | Thirds (debts + plan left, sticky); Debt-free hero (amber / Text when stalled), labelled debt cards, field-level underwater mark + Warning callout, verdict leads the race table, chart plan line ends at payoff + year ticks (screen only), schedule folded |
| Mortgage Calculator | /mortgage | done | 1ed5b17 | Thirds; payment hero with P&I and total interest, composition under it; extras and refinance inputs beside before/after panels; field errors; chart band screen-only off; table folded, Balance pinned |

### Content pages
| Page | Route | Status | Commit | Notes |
|---|---|---|---|---|
| Guide | /guide | todo | | bow-and-arrow progress: Phase 2 |
| Tools | /tools | todo | | icon motion: Phase 2 |
| About | /about | todo | | |
| Compare | /compare | todo | | opened from Save; no sitemap entry |
| Tool Help (the docked help panel) | on every tool | todo | | shared CoachPanel |
| Not found | (404) | todo | | |

### Withdrawal-strategy landing pages (Drawdown template)
Critique one representative, apply to all, check each.

| Page | Route | Status | Commit | Notes |
|---|---|---|---|---|
| The 4% rule | /4-percent-rule | todo | | representative |
| Guardrails | /guardrails | todo | | |
| Risk-based guardrails | /risk-based-guardrails | todo | | |
| Ratcheting | /ratcheting-withdrawal | todo | | |
| VPW | /vpw | todo | | |
| Vanguard dynamic spending | /vanguard-dynamic-spending | todo | | |
| CAPE-based | /cape-withdrawal | todo | | |
| RMD-based | /rmd-withdrawal-strategy | todo | | |

Not a page: `/[slug]` serves placeholders for pages that don't have their
own route yet; every page has one now, so it renders nothing.

## Phase 2: motion
| Piece | Status | Commit | Notes |
|---|---|---|---|
| Tool-picker icon animations | todo | | |
| Guide bow-and-arrow progress | todo | | |
| Optimizer bow-and-arrow loader | todo | | |
| Page transitions, tab switches, press, panels | todo | | |

## Phase 3: share card and print summary
| Piece | Status | Commit | Notes |
|---|---|---|---|
| Print summaries (10) | todo | | white paper, graphite text |
| Share image cards (16) | todo | | graphite and amber, Plex Sans |
| Logged color items (Rent vs. Buy, Bridge 72(t), Tax state slice, hatch stripes) | todo | | |

## Phase 4: audit
| Step | Status | Notes |
|---|---|---|
| /impeccable audit, site-wide | todo | |
| Fixes, one commit per kind | todo | |

## Phase 5: fresh-agent review
| Step | Status | Notes |
|---|---|---|
| Review round 1 | todo | |
| Fixes | todo | |
| Review round 2 on the fixed pages | todo | |

## Finish
| Step | Status | Notes |
|---|---|---|
| Final checks, full e2e, smoke, overflow, screenshots | todo | |
| REDESIGN_REPORT.md | todo | |
| Push, preview URL | todo | no PR, no merge |
