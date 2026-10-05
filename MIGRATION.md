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
  app/                    one folder per address: /, /drawdown, /roth, ...
    layout.tsx            masthead, navigation, footer, household bar, theme
    (strategies)/         the 8 withdrawal-strategy pages, one Drawdown component with presets
  components/             shared pieces: fields, results, charts, pop-ups, tooltips
  tools/<tool>/           each tool's screens and its own state
  lib/engine/             math.js, drawdown.js, plan.js as ES modules (moved, not rewritten)
  lib/meta.ts             page titles, descriptions and structured data from page-meta.json
  styles/                 today's CSS, split the same way it is now
  workers/plan.worker.ts  the Plan Optimizer / Drawdown search worker
  e2e/                    Playwright: old-vs-new number and screenshot checks
```

Rules that keep it from turning into a tangle again:

- Each tool owns its state; nothing shares a global scope. What tools do share
  (the household: ages, accounts, income) lives in one React context.
- Components never do math. They pass inputs to `lib/engine` and show the result.
- Every page is pre-rendered HTML with its own metadata; calculators run in the browser.

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
- [ ] Node.js installed (needed for Next.js)
- [ ] Vercel agent skills installed in `.claude/skills/`
- [ ] `web/` created with create-next-app (TypeScript, App Router, ESLint)
- [ ] Engine moved to `web/lib/engine/` as ES modules, logic unchanged
- [ ] `tests/run.py --web` runs the engine tests against the moved engine
- [ ] Today's CSS copied into `web/styles/`, loaded by the root layout
- [ ] CI runs the web build and both test runs
- [ ] Vercel project connected to the branch, `web/` as root (site owner creates the account)

**Gate:** both test runs pass, `next build` passes, a Vercel preview loads; reviewer looks over the setup.

### Phase 2: Shared shell
- [ ] Root layout: masthead, navigation, footer, theme toggle, pop-up and tooltip system
- [ ] Household bar and its shared context
- [ ] All 29 routes exist (placeholder bodies), each with its metadata, from `page-meta.json`
- [ ] Sitemap, robots.txt, preview cards (`opengraph-image`), `.html` redirects
- [ ] Playwright set up, with the SEO comparison

**Gate:** all 29 pages load with the right title, description, canonical URL and structured data.

### Phase 3: Smaller tools
Mortgage, debt, budget, college, rent vs buy, income tax.

**Gate:** old-vs-new numbers and screenshots match for each.

### Phase 4: Planning tools
Retirement calculator (basic, advanced, stages), compare, Roth, RMD, healthcare, FIRE, early-retirement bridge, 72(t).

**Gate:** old-vs-new numbers and screenshots match for each.

### Phase 5: Heavy tools
Drawdown Simulator and its 8 strategy pages, backtest, Plan Optimizer (with the
worker), readiness guide, tool picker, about, tool help and glossary.

**Gate:** every page matches; SEO check passes; web-design-guidelines and
vercel-optimize audits reviewed; site owner clicks through the preview.

### Phase 6: Switch
- [ ] retcalc.app's DNS pointed at Vercel
- [ ] Old site left deployable on GitHub Pages for rollback
- [ ] Search Console and analytics watched for two weeks
- [ ] Then: remove the old build from the repo; `web/` becomes the root

## Progress log

| Date | Phase | What changed |
| --- | --- | --- |
| 2026-10-05 | 0 | Plan written; branch created |
