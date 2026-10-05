# Next.js migration plan

RetCalc is being rebuilt in Next.js on the `nextjs-migration` branch, one tool
at a time, while the current site on `main` stays live on GitHub Pages.
retcalc.app switches to the new site only when every page gives the same
numbers as today. After the switch: a redesign, then logins and saved plans.

Plain-language version, with the reasoning behind each decision: the
"RetCalc Next.js Migration Plan" doc. This file is the working checklist.

## Decisions

| Question | Decision |
| --- | --- |
| Framework | Next.js (App Router), TypeScript for new code |
| Hosting | Vercel, free Hobby plan (the site is non-commercial) |
| Where the code lives | `web/` in this repo, beside the current site, so both can be built and compared |
| Look | Today's CSS carried over unchanged; redesign after the switch |
| Saved inputs and share links | Not kept compatible; few visitors use them, so they can be redesigned |
| Logins and database | Not part of this migration; service picked afterward |
| New calculators | Paused until the switch |

## Guidance: Vercel agent skills

Installed in `.claude/skills/` from
[vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills), so
every session follows the same patterns:

| Skill | Used for |
| --- | --- |
| `react-best-practices` | How components, data loading and bundles are written (every phase) |
| `composition-patterns` | How shared pieces (inputs, results panels, charts) are built, so tools don't grow piles of on/off props |
| `react-view-transitions` | The animated pane changes the current site has between tools |
| `web-design-guidelines` | Accessibility and UX audit before the switch; the redesign afterward |
| `vercel-optimize` | Cost and performance check before the switch |

Not installed: `react-native-guidelines` (no mobile app), `writing-guidelines`
and `vercel-deploy-claimable` (deploys go through the connected GitHub repo).

## Target structure

```
web/
  app/
    layout.tsx            masthead, navigation, footer, household and toast providers, theme script
    page.tsx              / (the Basic calculator)
    <slug>/page.tsx       one folder per rebuilt page (mortgage/, debt/, tools/, ...), so each
                          page loads only its own tool's code
    [slug]/page.tsx       the pages not rebuilt yet, as placeholders; removed with the last one
    sitemap.ts, robots.ts
  components/
    shell/                masthead, navigation, footer, page frame, tool header, article, toast
    household/            the household bar and the profile shared across tools
    fields/               Field, MoneyField, NumberField, SelectField, FieldHeading, Affixed;
                          number and money inputs (comma grouping, arrow-key steps)
    tools/                the tool list, each tool's icon, and ToolState (inputs, scenarios, share, reset)
    charts/               the band chart (hover and touch), legends and share bars
    ui/                   Figure (headline), KV, Segmented, BigValue, CsvButton
  lib/
    engine/               math.js, drawdown.js, plan.js as ES modules (moved, not rewritten);
                          typed.ts gives screens the engine's functions with their result types
    site.ts               every address, its tab, its tool; page-meta.json beside it
    seo.ts, articles.ts   each page's <head> and structured data; its "about" article
    tools.ts              the tool list's groups, names and descriptions
    format.ts, storage.ts, theme.ts, household.ts
  tools/<tool>/           model.ts (defaults, inputs, math wiring) and the screen
  content/articles/       each page's "about this tool" article, HTML moved unchanged
  e2e/                    Playwright old-vs-new checks, one file per tool
  styles/                 today's CSS, split the same way it is now
  scripts/                html2jsx.py (markup into JSX), seo-compare.mjs (old vs new <head>s)
```

Rules that keep it from turning into a tangle again:

- Each tool owns its state; nothing shares a global scope. What tools do share
  (the household: ages, accounts, income) lives in one React context.
- Components never do math. They pass inputs to `lib/engine` and show the result.
- Every page is pre-rendered HTML with its own metadata; calculators run in the browser.
- Markup moves over with `web/scripts/html2jsx.py`, not by retyping, so it
  stays exactly what the CSS expects; then the repeated parts are swapped for
  the shared pieces (fields, figures, toggles), never copied by hand.
- Screens import calculations from `@/lib/engine/typed`, not the engine
  directly, so result types are declared once.
- Pages without a calculator never load the engine: the household bar's
  state names come from the server (`lib/states.ts`). The "?" explanations'
  text loads the first time one is used.
- Saved data uses versioned keys (`retcalc.<name>.v1`, `lib/storage.ts`).
- The household profile reaches a tool when the tool is next opened, not
  instantly: only the open tool is loaded now (`useHouseholdFill`).
- Each tool keeps its defaults and input handling in `tools/<tool>/model.ts`,
  apart from its screen, so another tool can read it ("Copy from Budget")
  without loading that tool's page. `toolInputs(id, defaults)` reads a
  tool's inputs as last left this visit.
- Inputs live for the visit as you move between pages, as on the old
  single-page site; a reload starts fresh, as it did there.
- Anything that depends on today's date renders once in the browser
  (`useClient`), so the pre-built pages don't bake in the build day.
- Phase 4 must keep these input keys, which the Budget already reads:
  Basic and Advanced `contrib` and `period`, Stages `stages[0].contrib` and
  `.period` (`lib/retirement-contribs.ts`).
- Screens import the engine through `@/lib/engine/typed` (and the Bridge's
  through `@/lib/engine/typed-bridge`), never a module file directly:
  `math.js` and `drawdown.js` read each other's names, and `lib/engine/core.js`
  loads them in the order that works. Keeping the Bridge and plan engines out
  of `core.js` keeps them off every other page.

Known and accepted: `npm audit` reports a high-severity issue in `braces`, a
lint-time dependency of the Next.js ESLint plugin. It never ships to visitors
(`npm audit --omit=dev` finds 0); it goes away when the plugin updates.

## Checks (every phase)

1. **Engine tests**: `python3 tests/run.py` against `src/` (unchanged) and
   `python3 tests/run.py --web` against `web/lib/engine`. Both must pass.
2. **Old vs new numbers**: Playwright opens a tool on the old site (built from
   `src/`, served locally) and the new one, enters the same inputs, and compares
   every number shown. Typical cases plus edge cases per tool.
3. **Screenshots**: every ported page at phone and desktop width, light and
   dark, compared with the old site.
4. **SEO** (from phase 2): every page's title, description, canonical URL,
   structured data and main heading compared with the old site.
5. `next build` and lint pass; CI runs all of the above on every push.

## Phases

Each phase ends with a commit on `nextjs-migration` and its gate passing.

### Phase 1: Foundation
- [x] Node.js installed (22 LTS, in `~/.local/node`)
- [x] Vercel agent skills installed in `.claude/skills/` (`skills-lock.json` pins the versions)
- [x] `web/` created with create-next-app (Next.js 16, TypeScript, App Router, ESLint)
- [x] Engine moved to `web/lib/engine/` as ES modules, logic unchanged (checked line by line against `src/js/`)
- [x] `tests/run.py --web` runs the engine tests against the moved engine: 939 of 939 pass
- [x] Today's CSS copied into `web/styles/`, loaded by the root layout; pages marked noindex until the switch
- [x] CI runs the web build and both test runs; the pre-commit hook runs `--web` when the engine or tests change
- [x] Vercel project `retcalc` connected, `web/` as root, Next.js preset

**Gate:** both test runs pass, `next build` passes, a Vercel preview loads; reviewer looks over the setup.

### Phase 2: Shared shell
- [x] Root layout: masthead, navigation (Calculator menu, keyboard, pinned rail), footer, theme (no flash), toasts
- [x] Household bar and its shared context
- [x] All 29 routes exist (placeholder bodies, real tool list on /tools, each page's article), each with its metadata
- [x] Sitemap, robots.txt, preview cards (today's images, copied), `.html` and /single, /series redirects
- [x] SEO comparison: `node web/scripts/seo-compare.mjs` — 29 of 29 pages match
- Moved to the phase that needs them: Playwright (phase 3); the saved-scenario, share and
  reset buttons (each tool, phases 3 to 5); tooltips (phase 3); the card-to-header icon
  animation (phase 5, with the view-transitions skill)

**Gate:** all 29 pages load with the right title, description, canonical URL and structured data.

### Phase 3: Smaller tools
Mortgage, debt, budget, college, rent vs buy, income tax.

- [x] Shared tool plumbing: inputs, saved scenarios, share links (`#s=`), reset, CSV, tooltips, dropdown lists, chart
- [x] All six tools, each with its cases in `web/e2e/`; every case matches on desktop and phone
- [x] College and rent-vs-buy math moved into `web/lib/engine/calculators.js`; `tests/run.py --web` reads it there
- Fixed on the way, so intentionally different from the old site (each checked on its own):
  Debt Payoff and Rent vs. Buy no longer leave the last results on screen once there's nothing to calculate
- [x] The household profile fills Income Tax and Budget (`e2e/household.spec.ts`)
- Left for phase 5 with the rest of the share menu: the printable summary and the image card

Running the checks: `cd web && npm run build && npx playwright test` (about
3.5 minutes; 55 checks as of phase 4). They run on this machine, not in CI: they need
Chrome and the old site built from `../src`. A check that needed its one
retry is reported as "flaky".

**Gate:** old-vs-new numbers and screenshots match for each.

### Phase 4: Planning tools
Retirement calculator (basic, advanced, stages), compare, Roth, RMD, healthcare, FIRE, early-retirement bridge, 72(t).

- [x] Basic (home page), Advanced and Stages, each with its cases in `web/e2e/`
- [x] Compare at `/compare` (it had no address before; kept out of search and the sitemap),
      opened from the Save menu; its check saves the same scenarios on both sites first
- [x] Roth Conversion and RMDs, Healthcare Cost Planner, FIRE, Early Retirement Bridge and 72(t)
- [x] The bridge engine moved to `web/lib/engine/bridge.js`; `tests/run.py --web` reads it there
- [x] Shared pieces: one chart frame (size, axes, hover and touch) under the band, multi-line
      and stacked-bar charts; account-type math (`lib/accounts.ts`); the By account type
      table; the contribution converter and per-account growth dialogs; a Modal; one
      Monte Carlo seed shared by every tool, as before
- [x] The household profile fills Basic, Advanced, Stages, FIRE, Roth, the Bridge and Healthcare
- [x] The checker also compares each list row's fields (stage cards, debts, budget lines,
      children), and screenshots pages too tall for Chrome at one pixel per CSS pixel
- Fixed on the way, so intentionally different from the old site (each checked on its own):
  the Bridge and Basic clear their results when there's nothing to calculate; the Roth
  chart keeps its Balance / Tax switch; light-theme colours on swatches and tooltip
  labels drawn after the page loads
- Not ported: Advanced's hidden inflation calculator, and each stage's hidden stock-mix field
- Left for phase 5: the drawdown compare view, and the handoffs into the Drawdown Simulator
  (the buttons already write its inputs; the page itself is still the placeholder)

**Gate:** old-vs-new numbers and screenshots match for each.

### Phase 5: Heavy tools
Drawdown Simulator and its 8 strategy pages, backtest, Plan Optimizer (with the
worker), readiness guide, tool picker, about, tool help and glossary.

**Gate:** every page matches; SEO check passes; web-design-guidelines and
vercel-optimize audits reviewed; site owner clicks through the preview.

### Phase 6: Switch
- [ ] Remove the noindex setting from `web/app/layout.tsx`
- [ ] Add Cloudflare Web Analytics (left out so previews don't count as visits)
- [ ] retcalc.app's DNS pointed at Vercel
- [ ] Old site left deployable on GitHub Pages for rollback
- [ ] Search Console and analytics watched for two weeks
- [ ] Then: remove the old build from the repo; `web/` becomes the root

## Progress log

| Date | Phase | What changed |
| --- | --- | --- |
| 2026-10-05 | 4 | Review against the Vercel skills: the Save menu no longer pulls the engine onto every page (tools and about back to 192 KB); the Bridge and plan engines load only on the Bridge (every calculator page about 12 KB lighter); Advanced and Stages share their headline and chart panel; shared helpers for field dollars, the Income Tax handoff, the glide note, chart paths. All 55 checks unchanged |
| 2026-10-05 | 4 | Early Retirement Bridge and 72(t), Advanced, Stages, Compare; shared chart frame, account math and dialogs. 55 old-vs-new checks pass on desktop and phone; SEO check 29 of 29 |
| 2026-10-05 | 4 | Basic (home page), Healthcare, Roth and RMDs, FIRE |
| 2026-10-05 | 3 | Review against the Vercel skills: one route per rebuilt page (each loads only its tool), engine kept off non-calculator pages, glossary loaded on demand, field/figure/toggle/CSV/engine-type repetition replaced by shared pieces. All checks unchanged |
| 2026-10-05 | 3 | Mortgage, Debt Payoff, College Savings, Rent vs. Buy, Income Tax, Budget; old-vs-new checks for each |
| 2026-10-05 | 2 | Shared shell, household bar, number fields, 29 pages with metadata and articles, tool list, sitemap, redirects, SEO check passing |
| 2026-10-05 | 1 | Node, Vercel skills, Next.js app, engine moved and tested, CSS, CI |
| 2026-10-05 | 0 | Plan written; branch created |
