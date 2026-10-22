# Marketing materials

Three files describe RetCalc to people who haven't used it. Everything that
builds them lives in this folder, so a refresh means recapturing the live
site and rebuilding, not starting over. Nothing here is part of the site or
its build: `web/` never reads this folder.

| File | What it is | Who it's for |
| --- | --- | --- |
| `RetCalc-Marketing-Package.pdf` | 37 US Letter pages: cover, contents, an overview, a page per tool, a worked household story, then how it's built | Someone deciding whether to use the site, plus a closing section for someone curious about the build |
| `RetCalc-One-Pager.pdf` | The overview on a single page | A quick hand-out |
| `RetCalc-Deck.pptx` | 40 widescreen slides: a 14-slide talk with speaker notes, then an appendix of every tool and the build | Presenting live; the appendix answers follow-up questions |

Last refreshed **22 October 2026**, from retcalc.app as it stood that day.

The repo is public, so these files and their screenshots are too. The
"how it's built" pages are written to be safe to publish: no project IDs,
keys, internal URLs or table-level details. Keep it that way.

## What's in this folder

```
marketing/
  RetCalc-*.pdf, RetCalc-Deck.pptx   the three finished files (committed)
  build/      the PDFs: build.mjs (every page and the one-pager),
              build-pages.html (the five under-the-hood pages),
              styles.css, charts.mjs, tools.json (tool names and questions)
  deck/       the deck: build-deck.mjs (every slide), assets.mjs (image
              crops, icons, chart data), apply-theme.mjs
  shots/      crops/: the screenshots the builds use, captured from the live
              site; logo_nav.svg: the header logo
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
2. **Recapture the site:** `npm run capture` (5 to 10 minutes). Every
   screenshot is retaken from retcalc.app with the sample households below.
   Then `npm run prune` deletes the crops no build uses.
3. **Update the words.** Screenshots refresh themselves; the text does not.
   Every figure quoted in the copy is typed into `build/build.mjs`,
   `build/build-pages.html` and `deck/build-deck.mjs`, so re-read the new
   screenshots and fix any that moved (see "Figures typed into the copy").
   Add or remove tools here too.
4. **Build:** `npm run pdf` writes both PDFs (with the package's bookmark
   sidebar) and page previews in `.preview/pdf`. `npm run deck` writes the
   deck.
5. **Check:**
   - `npm run measure`: free space at the bottom of every page, in pixels.
     Negative means it runs into the footer. `-12` is normal for the dark
     pages and `-52` for the one-pager, which have no running footer.
   - Look at every page in `.preview/pdf` and `.preview/onepager`.
   - `npm run deck:check` exports a copy of the deck through PowerPoint and
     renders each slide to `.preview/deck/`. Look at every slide.
     `node sheet2.mjs "$PWD/../.preview/deck" "$PWD/../.preview/sheet.png" 1 40 5`
     puts them all on one image.
   - The pptx skill's `validate.py` checks the deck file, if it's available.
6. **Update the date above**, commit, and say what changed.

To change one page or slide, skip step 2 and edit its builder. To add a
tool: a `T({...})` in `build/build.mjs`, a `tool({...})` in
`deck/build-deck.mjs`, its line in `build/tools.json`, and a capture job in
`tooling/shoot2.mjs`.

## Where each page comes from

**PDF** (`build/build.mjs`, in order): cover; contents (written last, from
every page's `toc`); Part 1 overview (O1 to O5); Part 2 deep dive (`toolPage`
for the calculators and guides, `T` for the 14 tools, in `web/lib/tools.ts`
order, then the two "Putting it together" pages); Part 3 (the pages in
`build-pages.html`, split on `<!--PAGE-->`); back cover; then the one-pager.
Page numbers, the contents, the section openers and the bookmarks all follow
the order automatically.

**Deck** (`deck/build-deck.mjs`): slides 1 to 14 are numbered in comments
(`// 6. Stages`); feature slides use `feature()`. The appendix is `A(...)`
for one-off slides and `tool({...})` for tool slides; its divider lists and
links them all automatically.

## Sample households

Every screenshot uses made-up inputs, set in the capture scripts:

| Where | Household | Set in |
| --- | --- | --- |
| Most tool pages | The tool's own defaults | `shoot2.mjs` |
| Stages | Four stages: early career, kids at home, peak earning, coasting; target $45,000 | `shoot2.mjs` (`stages`) |
| Budget | A filled-in budget and a $95,000 salary in Illinois | `shoot2.mjs` (`budget`) |
| Healthcare | Couple retiring at 60 on $95,000, just over the ACA subsidy cliff | `recap.mjs` |
| Mortgage | $300 extra per month, $10,000 in month 24, a refinance to 6.25% | `recap.mjs` |
| Readiness Guide and its report | Couple, 38 and 36, retiring at 62 (scores 98) | `guide.mjs`, `rp.mjs` |
| Paycheck to Retirement | The Budget household, 34, retiring at 62 | `plan.mjs` |
| The household story | Alex (34, $92,000) and Jordan (32, $68,000), Illinois, $60,000 saved, two children planned, carried through Budget, Stages, Social Security and Drawdown by the site's own hand-off buttons | `story.mjs` |

Inputs go in through share links (`#s=`, see `share()` in `lib.mjs`) or the
browser storage the site reads; the Guide and Paycheck to Retirement keep
their own state in localStorage. Tune a sample so its headline reads well:
no red warnings, believable numbers (the story couple saves 13.5% of pay,
not 39%), and a target the plan can reach.

## Figures typed into the copy

Re-check each on a refresh:

- **Counts:** 14 tools, 3 calculators, 2 walkthroughs, 15 Drawdown
  strategies, 29 articles, 100 years / 1,200 months of history, 5,000
  Monte Carlo runs, 835 monthly starts (30-year), 829 windows (31-year).
- **Build:** about 618 checks in 55 groups, 209 article checks, 7 Guide
  households, 17 end-to-end specs, 39 routes, about 55,600 lines of app code,
  about 7,400 in the engine and its per-file line counts, 22 tracked figures
  and their sources (`upkeep/items.json`).
- **Market:** $1 grew to about $1,140 (computed from `history.js` in the
  PDF; typed in the deck), and the real declines −77%, −50%, −45%, −50%.
- **Samples:** every dollar figure next to a screenshot, the deck's big stat
  on each appendix tool slide (`stat:`), and the whole household story
  ($1,803 per month, $832.35 biweekly, $743,576, $993,511, $6,236 per month,
  $104,573 per year, 835 of 835).
- **Tax year** (2026) wherever it is named.

## Design

Both documents use the site's own design system (`../DESIGN.md`).

- **Colors:** the PDF reads in Paper, the light theme (`#faf9f6` ground,
  `#9a6200` amber), with Graphite (`#0e1116`, amber `#e3a93b`) for the
  cover, section openers and back cover. The deck is Graphite throughout.
  Each tool group keeps one color everywhere: calculators amber, retirement
  income sky, saving and investing teal, everyday money lavender, guided
  walkthroughs rose, under the hood gray.
- **Type:** the PDF uses IBM Plex Sans (the site's typeface) and Plex Mono
  for numbers. The deck uses Arial so it lays out the same on any computer;
  Plex appears only inside the screenshots.
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
- Don't label tools "Highlight". The favorites (Stages, Drawdown, Income Tax,
  Budget and Paycheck, the two guides) get their emphasis from the overview
  and the deck's talk, not from badges.
- Don't feature the strategy pages (/4-percent-rule, /guardrails and the
  rest); they exist for search. Mentioning the 29 articles is fine.
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
- Copy follows the site's rules: "per year", "per month"; name what a figure
  is, never "the Guide's costs" or "the full RetCalc tool".

## When a capture script breaks

The capture scripts click the live site by its text and ids, so a renamed
button or a new layout stops them. The ones they rely on:

- Chart modes "Historical" and "Monte Carlo"; Drawdown tabs "Compare
  strategies" and "Safe spending"; the Optimizer's "Find my best plan";
  Income Tax "Retirement income"; the Paycheck tab's "The usual order"; the
  tool list's "Compact".
- Budget `#pcCopyOut` ("Copy to a calculator", then "Stages", then
  "Replace it"); Stages `#btnKidsS` and `#kdPlanned`, `#kdFirst`,
  `#kdSpacing`, then "Build the stages"; `#toDrawdownS`; Drawdown
  `#ddRetireAge`, `#ddSSMode`.
- Cards are found by their heading text (`card(page, 'Balance over time',
  ...)`) and saved under a slug of it, so a renamed heading renames the file
  the builds look for. `npm run prune -- --dry-run` (or `node cards.mjs
  /route`) helps find the new names.
- Tool state is saved under `retcalc.tool-<id>.v1`, the Guide under
  `retcalc.guide.v2`, the walkthrough under `retcalc.paycheck-plan.v1`. If a
  version number changes, update the capture scripts to match.
