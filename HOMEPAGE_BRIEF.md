# Homepage brief

Decided with the owner on 2026-10-12. This covers the new homepage at `/` and
the navigation changes it needs. Everything not named here stays as it is.

## Job

A real front door for retcalc.app. No tools on the page: it introduces the
site in a few seconds and sends each visitor to the right place. Shorter than
ProjectionLab's or Stripe's homepages (about five screens on a laptop).

Visitors arrive from search, a shared link or word of mouth, usually knowing
nothing about RetCalc. In five seconds they should know:

1. **Free and private.** No signup required, nothing you type leaves your
   browser. (An optional free account for saving scenarios is coming, so the
   copy says "no signup required", never "no accounts, ever".)
2. **Tested against history.** Every market since 1926, not one average return.
3. **One plan, many tools.** A calculator, a guide and 13 planning tools that
   share one household and one set of saved scenarios. (Never "20+": the 72(t),
   RMD and strategy pages are SEO views of other tools. Drawdown has 15
   withdrawal strategies.)

## Three paths

| Visitor | Goes to |
| --- | --- |
| "I'm new, where do I start?" | The Retirement Readiness Guide (`/guide`) |
| "Give me a quick number" | The Calculator, Basic mode (`/calculator`) |
| "I'm planning retirement income" | The Drawdown Simulator (`/drawdown`) |

The Plan Optimizer is not one of the three; it appears with the other tools
further down.

## Look and feel

- References: **projectionlab.com** (clean, calm, real views of the product
  carry the page) and **stripe.com** (visuals that change as you scroll, short
  descriptions of each product). Not their logos, testimonials or reviews: we
  have none and won't invent any.
- The homepage, and only the homepage, may go beyond DESIGN.md: bigger type,
  bolder color, motion as you scroll, images. The logo, name, tagline
  ("Know your number."), palette roots (graphite, paper, amber, the logo's
  gold, jade and steel) and IBM Plex Sans carry over, so the step into the
  tools doesn't feel like a different site.
- Tool views are drawn live on the page with fixed sample data rather than
  saved as screenshots: sharp at any size, right in both themes, they animate,
  and they don't go stale. Small thumbnails may be real screenshots made by a
  script.
- Historical visuals use the engine's real 1926–2025 series and say so. Sample
  plans are labeled as examples.
- Still never: hype, testimonials, user counts, money emoji, stock photos of
  retirees, gamification.
- Motion respects reduced-motion (a still page that says the same thing). Both
  dark and light themes work.
- Loading stays light: no video; images below the first screen load lazily.

## Header and navigation

- No Home tab. The logo links to `/`. Tabs stay Guide, Calculator, Tools, About.
- On `/`, `/about` and `/tools`, the header drops the saved-scenarios menu,
  its save/export/reset buttons and the household button (they only act on a
  tool). The theme toggle stays. The empty right side is where "Sign in" will
  go later.
- Header: ONE merged row (logo, tabs, theme toggle), pinned whole. Chosen by
  the owner; after the homepage ships it becomes the header on every page.
  No "Sign in" placeholder until sign-in actually exists.

## Routing changes (build phase)

- Basic moves from `/` to `/calculator`; Calculator → Basic points there.
- Old Basic share links (`retcalc.app/#...`) forward to `/calculator#...`.
- The installed home-screen app starts at `/calculator`
  (`public/site.webmanifest`).
- The logo's "scroll to household on `/`" behavior goes away.
- `lib/site.ts` (`CALC_PATHS`, `pathFor`, tab mapping), `page-meta.json` (a new
  `home` title and description; Basic gets its own), the sitemap and the e2e
  tests that use `/` follow.
- The SEO cost of `/` no longer being the calculator is accepted.
- Fix the old count elsewhere: the Guide's "All 20 tools, by what they answer"
  link (`web/tools/guide/steps/ch7-plan.tsx`) and "about 20 connected tools" in
  PRODUCT.md.

## Process

1. Three mock directions (`.impeccable/mocks/homepage/`), all the same visual
   world, different structure. The owner picks one, or mixes.
2. Build on a branch with shadcn components where controls appear. Routing and
   nav changes in their own commit.
3. Lint, typecheck, numbers check and contrast check after each commit; e2e,
   production build and screenshots at the end.
