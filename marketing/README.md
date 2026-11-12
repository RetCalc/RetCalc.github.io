# Marketing materials

Five files describe RetCalc to people who haven't used it. Everything that
builds them lives in this folder, so a refresh means recapturing the site
and rebuilding, not starting over. Nothing here is part of the site or its
build: `web/` never reads this folder.

| File | What it is | Who it's for |
| --- | --- | --- |
| `RetCalc-Marketing-Package.pdf` | 62 US Letter pages: cover, contents, an overview (Part 1), a walkthrough of the Dashboard tab by tab (Part 2), a page per tool and guide, Learn and a worked household story (Part 3), then how it's built (Part 4) | Someone deciding whether to use the site, plus a closing section for someone curious about the build |
| `RetCalc-One-Pager.pdf` | The site's tools on a single page; it leaves the Dashboard out | A quick hand-out |
| `RetCalc-Dashboard-One-Pager.pdf` | The Dashboard on a single page, a sibling of the one above | A quick hand-out for the Dashboard |
| `RetCalc-Deck.pptx` | 50 widescreen slides: a 17-slide talk with speaker notes, then an appendix of every tool, the Dashboard's highlights and the build | Presenting live; the appendix answers follow-up questions |
| `RetCalc-Dashboard-Deck.pptx` | 39 widescreen slides: a 21-slide talk on the Dashboard with speaker notes, phones included, then an appendix of each tab in depth and how the Dashboard works | Presenting the Dashboard; the appendix is for a technical reader |

Last refreshed **11 November 2026**, from the site as it stood that day (a
local production build of `main`, so today's figures; see "Updating").

The repo is public, so these files and their screenshots are too. The
"how it's built" pages are written to be safe to publish: no project IDs,
keys, internal URLs or table-level details. Keep it that way.

## What's in this folder

```
marketing/
  RetCalc-*.pdf, RetCalc-*.pptx   the five finished files (committed)
  build/      the PDFs: build.mjs (the package and the main one-pager),
              dashboard-pages.mjs (Part 2, the Dashboard), build-pages.html
              (the under-the-hood pages), build-dash-onepager.mjs (the
              Dashboard one-pager), styles.css, charts.mjs, tools.json;
              DASHBOARD-FACTS.md and SITE-CHANGES.md, the checked facts the
              November copy was written from
  deck/       build-deck.mjs (the main deck), assets.mjs (image crops, icons,
              chart data), build-dash-deck.mjs and dash/kit.mjs (the
              Dashboard deck), apply-theme.mjs
  shots/      crops/ (light) and crops-dark/ (dark, same names): the main
              site; dash/: the Dashboard (lt_ light, dk_ dark, *_ph_ phones,
              *_x_ extra captures); CAPTURES.md: what every crop shows and
              the figures in it; logo_nav.svg: the header logo
  tooling/    capture scripts (puppeteer), renderers and checks
```

Read straight from the site, so always current:
`web/lib/engine/data/history.js` (the cover art and the century charts) and
`web/public/og/*.jpg` (the link-preview cards on the hosting page/slide).

## Updating

Needs macOS with Node on the PATH (`~/.local/node/bin` on the owner's Mac),
Google Chrome, Python 3, and Microsoft PowerPoint for the deck check. Set
`CHROME=/path/to/chrome` if Chrome isn't in /Applications. All commands run
from `tooling/`.

1. **Install, once per checkout:** `npm run setup`
2. **Start a local copy of the site with a test sign-in.** The Dashboard
   needs an account, so its screenshots come from a local production build
   that lets a test account in on localhost. Never put that in the repo:
   make a throwaway worktree (`git worktree add <scratch>/wt HEAD
   --detach`), clone `web/node_modules` into it with `cp -Rc` (a symlink
   breaks Turbopack), copy `web/.env.local`, and in its
   `components/account/AccountProvider.tsx`, at the top of the first
   `useEffect`, return a fake signed-in account (`setAccount({ id: "dev",
   email: "sam@example.com", firstName: "Sam", askedName: true,
   suggestedName: null }); setReady(true)`) when `location.hostname ===
   "localhost"` and `localStorage["rc-dev-account"]` is set. Then `npx next
   build` and `npx next start -p 3190` there. The main-site captures use the
   same server, so every figure matches the code being described.
3. **Recapture:** `BASE=http://localhost:3190 npm run capture` (main site,
   light then dark, 10 to 20 minutes; it rewrites `shots/CAPTURES.md`), then
   `npm run capture:dash` (the Dashboard for the household in
   `tooling/dash-seed.json`; `DASH=` changes its address). Move the old
   crops aside first so stale files can't linger. Then `npm run prune`
   deletes the crops no build uses.
4. **Update the words.** Screenshots refresh themselves; the text does not.
   Every figure quoted in the copy is typed into the builders, so re-read
   `shots/CAPTURES.md` and the new screenshots and fix any that moved (see
   "Figures typed into the copy"). Add or remove tools here too.
5. **Build:** `npm run pdf` writes the package (with its bookmark sidebar)
   and both one-pagers, with page previews in `.preview/pdf`,
   `.preview/onepager` and `.preview/dashone`. `npm run deck` writes both
   decks.
6. **Check:**
   - `npm run measure`: free space at the bottom of every page, in pixels.
     Negative means it runs into the footer. `-12` is normal for the dark
     pages and `-52` for the one-pagers, which have no running footer.
   - Look at every page in the `.preview` folders.
   - `npm run deck:check` exports both decks through PowerPoint and renders
     each slide to `.preview/deck/` and `.preview/dash-deck/` (it can take
     ten minutes per deck). Look at every slide.
     `node sheet2.mjs "$PWD/../.preview/deck" "$PWD/../.preview/sheet.png" 1 60 5`
     puts them all on one image.
   - The pptx skill's `validate.py` checks the deck files, if it's available.
7. **Update the date above**, commit, and say what changed. Remove the
   worktree.

To change one page or slide, skip steps 2 and 3 and edit its builder. To
add a tool: a `T({...})` in `build/build.mjs`, a `tool({...})` in
`deck/build-deck.mjs`, its line in `build/tools.json`, and a capture job in
`tooling/shoot2.mjs`. To add a Dashboard tab: a page in
`build/dashboard-pages.mjs`, a slide in `deck/build-dash-deck.mjs`, a line
in the Dashboard one-pager's tab list, and its route in `tooling/dash.mjs`.

## Where each page comes from

**Package** (`build/build.mjs`, in order): cover; contents (written last,
from every page's `toc`); Part 1 overview; Part 2, the Dashboard
(`dashboardPart()` in `build/dashboard-pages.mjs`); Part 3 deep dive
(`toolPage` for the calculators and guides, `T` for the 14 tools in
`web/lib/tools.ts` order, Learn, then the two "Putting it together" pages);
Part 4 (the pages in `build-pages.html`, split on `<!--PAGE-->`); back
cover. Page numbers, the contents, the section openers and the bookmarks
all follow the order automatically. The main one-pager is the `one` section
at the end of `build.mjs`.

**Main deck** (`deck/build-deck.mjs`): the talk slides are numbered in
comments; feature slides use `feature()`. The appendix is `A(...)` for
one-off slides and `tool({...})` for tool slides; its divider lists and
links them all automatically.

**Dashboard deck** (`deck/build-dash-deck.mjs`): the same theme, masters and
helpers as the main deck, copied into it so the two can change apart;
`deck/dash/kit.mjs` crops `shots/dash` images and frames phones. Talk slides
carry speaker notes; the appendix divider links each appendix slide.

## Sample households

Every screenshot uses made-up inputs. `shots/CAPTURES.md` has the full list
and the figures each one shows.

| Where | Household | Set in |
| --- | --- | --- |
| The Dashboard | Sam (42, $128,000) and Jordan (40, $86,000), daughter Nora, Illinois, $400,000 saved, a home worth $520,000; balances entered three times since October 2025 | `dash-seed.json`, `dash.mjs` |
| Most tool pages | The tool's own defaults | `shoot2.mjs` |
| Advanced, Changes ahead | 30, retiring at 65, $60,000 saved, $1,000 per month; three changes (kids at home, peak earning, an inheritance); $45,000 target | `shoot2.mjs` (`advanced`) |
| Budget | A filled-in budget and a $95,000 salary in Illinois | `shoot2.mjs` (`budget`) |
| Healthcare | Couple retiring at 60 on $95,000, just over the ACA subsidy cliff | `recap.mjs` |
| Mortgage | $300 extra per month, $10,000 in month 24, a refinance to 6.25% | `recap.mjs` |
| Readiness Guide and its report | Couple, 38 and 36, retiring at 62 | `guide.mjs`, `rp.mjs` |
| Paycheck to Retirement | The Budget household, 34, retiring at 62 | `plan.mjs` |
| The household story | Alex (34, $92,000) and Jordan (32, $68,000), Illinois, $60,000 saved, one child planned, carried through Paycheck, Advanced (Copy to Advanced, the child as a change), Social Security and Drawdown by the site's own hand-off buttons | `story.mjs` |

Inputs go in through share links (`#s=`, see `share()` in `lib.mjs`) or the
browser storage the site reads; the Guide and Paycheck to Retirement keep
their own state in localStorage, and the Dashboard reads
`retcalc.dashboard.v1`. Tune a sample so its headline reads well: no red
warnings, believable numbers (the story couple saves 13.5% of pay, not 39%),
and a target the plan can reach. The story has one child and no paid
childcare because two children outran that couple's saving. Its Drawdown
step spends $96,005 per year in all, Social Security included (the
simulator's spending is the household's total); describe it that way, never
as a withdrawal rate.

## Figures typed into the copy

Re-check each on a refresh:

- **Counts:** 14 tools, 2 calculators (Basic and Advanced), 2 walkthroughs,
  15 Drawdown strategies, 28 articles, 66 lessons in 8 tracks with 39
  charts, 100 years / 1,200 months of history, 5,000 Monte Carlo runs, 835
  monthly starts (30-year), 829 windows (31-year).
- **Dashboard:** 15 tabs, up to 8 setup steps, a 14-page report plus up to
  7 more, 24 help guides, 53 tips, 9 kinds of assets and 5 of debts, 5
  markets in the Bridge picker (section 6 of `build/DASHBOARD-FACTS.md`
  lists each and where it's checked).
- **Build:** 1,322 checks in 62 groups (`python3 tests/run.py`), 16
  end-to-end specs (run by hand, not in CI), 53 routes, about 79,400 lines
  of app code, about 12,600 of Dashboard code, 6,774 lines in the engine
  (about 6,100 of them finance) and its per-file line counts, 24 tracked
  figures and their sources (`upkeep/items.json`).
- **Market:** $1 grew to about $1,140 (computed from `history.js` in the
  PDF; typed in the deck), the real declines −77%, −50%, −45%, −50%, and
  today's CAPE where it appears.
- **Samples:** every dollar figure next to a screenshot, the deck's big stat
  on each appendix tool slide (`stat:`), the Dashboard figures ($610,500 net
  worth, $1,891,000 at 60, readiness 96, 751 of 751), and the household
  story ($1,803 per month, $832.35 every two weeks, $1,200,063, $6,236 per
  month, $96,005 per year, 835 of 835, median $2,943,319 left).
- **Tax year** (2026) wherever it is named.

## Design

Every file uses the site's Clear Glass design system (`../DESIGN.md`).

- **Colors:** the PDFs read in the light glass theme (`#f5f5f7` page, white
  cards, `#975300` amber), with night black (`#000`, surfaces `#1c1c1e`,
  amber `#ffb340`) for the cover, section openers, one-pager bands and back
  cover. Both decks are night black throughout. Screenshots match: light
  ones in the PDFs, dark ones in the decks.
  Each tool group keeps one color everywhere: calculators and the Dashboard
  amber, retirement income sky, saving and investing teal, everyday money
  lavender, guided walkthroughs rose, Learn indigo, under the hood gray.
- **Type:** the PDFs use Inter with tabular figures (the site shows SF Pro
  on Apple devices and Inter elsewhere; Inter embeds in a PDF anywhere). The
  decks use Arial so they lay out the same on any computer; the site's type
  appears only inside the screenshots.
- **Motion:** both decks fade between slides (0.3 s), and a few talk slides
  build click by click where the order is the point: the main deck's
  household story, and the Dashboard deck's profile hub, month in the life,
  and where your numbers live. `deck/motion.mjs` adds them after the build;
  a shape joins a build by its name (`objectName: 'build:N'`, or `BUILD.n`
  in the Dashboard deck). Nothing else animates, and the appendices don't.
  PDF exports show each slide as it ends, so check builds in a slideshow.
- **Phones:** phone captures are 390 points wide and sit in a drawn iPhone
  outline (`tooling/phone.mjs`, `framePhone()`), with a status bar and home
  bar added around the page.
- **PDF pages:** US Letter portrait. A running head (group and position)
  sits at the top of each page and a footer with the logo and page number at
  the bottom. Tool pages have one header line, the tool's name, its question
  in amber, a short description, and its address (linked) under a large
  number; then real screenshots with captions, and a side column of what it
  takes and gives.
- **Deck slides:** dark slides that use the full width. Feature and appendix
  slides split into a text column on the left and a full-bleed panel tinted
  in the group color on the right, filled with screenshot cards. Every slide
  carries a real visual. Talk slides have speaker notes.
- **Links:** contents entries, section-opener lists and the deck's appendix
  divider jump to their page or slide. Every "retcalc.app" mention, tool
  address and screenshot address bar opens the site.

### Decisions from the owner's reviews

Keep these on every refresh:

- No soft drop shadows in the PDF. They print as solid gray boxes in macOS
  Preview; use a thin border.
- Don't label tools "Highlight". The favorites (Advanced with Changes ahead,
  Drawdown, Income Tax, Budget and Paycheck, the two guides, the Dashboard) get their emphasis from the overview
  and the deck's talk, not from badges.
- Don't feature the strategy pages (/4-percent-rule, /guardrails and the
  rest); they exist for search. Mentioning the 28 articles is fine.
- Section subtitles say something about the product, never restate the
  brief ("one page per tool…").
- Crops start and end at clean boundaries: no label cut in half, no stray
  button edge. Pick crops that show the feature in use (the Mortgage page
  shows extra payments filled in, not the closed dropdown) and that differ
  from neighbouring pages.
- Show the tool list in its compact view, so all 14 tools are visible.
- No empty space left at the bottom of a page or slide; no overflow.
- Claims about the build must be exactly true: "no API routes; the only
  thing the site's own server receives is error reports, stripped of
  inputs" (the Sentry tunnel), not "no server".
- The main one-pager leaves the Dashboard out; it has its own one-pager.
- The Dashboard's copy names its tabs as the sidebar does, in the sidebar's
  order (Profile first), and never mentions shelved features (section 7 of
  `build/DASHBOARD-FACTS.md`).
- Copy follows the site's rules: "per year", "per month"; name what a figure
  is, never "the Guide's costs" or "the full RetCalc tool".

## When a capture script breaks

The capture scripts click the live site by its text and ids, so a renamed
button or a new layout stops them. The ones they rely on:

- Chart modes "Historical" and "Monte Carlo"; Drawdown tabs "Compare
  strategies" and "Safe spending"; the Optimizer's "Find my best plan";
  Income Tax "Retirement income"; the Paycheck tab's "The usual order"; the
  tool list's "Compact".
- Budget `#pcCopyOut` ("Copy to Advanced"; "Replace it" when Advanced
  already holds saving); Advanced `#btnAddChange`, then "Children",
  `#kdPlanned`, `#kdFirst`, "Brokerage first", "Add them";
  `#btnViewChanges`, `#btnStagesBehind`; Advanced's "Test withdrawals"
  `#toDrawdown`; Drawdown `#segDDIn`, `#ddRetireAge`, `#ddSSMode`, `#ddRate`.
- The Dashboard's tiles are `.dsh-tile` sections found by their `h2`
  (`dash.mjs` names files by a slug of it); its routes are
  `/dashboard/<section>` with the ids in `web/components/dashboard/sections.ts`.
- Cards are found by their heading text (`card(page, 'Balance over time',
  ...)`) and saved under a slug of it, so a renamed heading renames the file
  the builds look for. `npm run prune -- --dry-run` (or `node cards.mjs
  /route`) helps find the new names.
- Tool state is saved under `retcalc.tool-<id>.v1`, the Guide under
  `retcalc.guide.v2`, the Dashboard under `retcalc.dashboard.v1`, the walkthrough under `retcalc.paycheck-plan.v1`. If a
  version number changes, update the capture scripts to match.
