# SEO plan

Written 2026-10-13. A plan, not a build: nothing here is started. It was
written from an audit of the code on `main` (commit `89131a8`) and of pages
rendered from a local copy. The live site couldn't be fetched from the
environment the audit ran in, so anything about the live site is marked
"verify on the live site".

The aim is more people finding RetCalc through search (Google, Bing, and the
AI answer engines that read them) while spending as close to nothing as
possible. The paid extras that are worth it are listed separately at the end
(§10) and are all optional.

---

## 0. Read this first (for the agent picking this up)

**How to use this file**

- Work goes in task IDs (`T1.3`, `C2`, ...). Each task says who does it:
  - **Owner**: a person has to do it (accounts, DNS, outreach, decisions).
    Don't attempt these; if one blocks you, say so and move on.
  - **Agent**: code or content changes in this repo.
  - **Owner decision → Agent**: ask the owner the stated question first,
    then build.
- Do the phases in order unless the owner says otherwise. Phase 0 (§3) is
  the owner's and should start first, because it gives the before/after
  numbers that later work is judged by.
- When a task is done, tick its box, add a dated line to the progress log
  (§12) with the commit, and note anything that differs from the plan. Keep
  this file current: it is the shared memory between sessions.
- If a task's facts don't match the code any more (a file moved, a count
  changed), check the code, update the task here, then do it.

**Where things are**

The live site, retcalc.app, is the Next.js app in `web/`, served by Vercel
from `main` (switched 2026-10-05, see `MIGRATION.md`). The repo root also
still holds the old static site (`src/`, `build.py`, the root `*.html`).
**Don't make SEO changes in `src/` or the root HTML files**; they aren't
served any more.

| What | File |
| --- | --- |
| Every page's slug, title, description, main heading | `web/lib/page-meta.json` |
| Page list, URLs, strategy pages, which tool a page opens | `web/lib/site.ts` (`SLUGS`, `TOOL_SUB`, `STRATEGY_PAGES`, `STRATEGY_LEDE`, `urlFor`) |
| `<head>`: title, description, canonical, preview tags, structured data | `web/lib/seo.ts` (`metadataFor`, `jsonLdFor`) |
| Site-wide `<head>`, robots noindex off production, analytics | `web/app/layout.tsx` |
| What every page renders: main heading, tool header, article | `web/components/shell/PageShell.tsx` |
| Each page's "about this tool" article (HTML) | `web/content/articles/<slug>.html`, loaded by `web/lib/articles.ts` |
| Links between strategy pages | `web/components/shell/StrategyLinks.tsx` |
| Strategy pages' preset inputs (the worked example) | `web/lib/engine/landing.js` (`DD_LANDING`) |
| Sitemap, robots | `web/app/sitemap.ts`, `web/app/robots.ts` |
| Redirects | `web/next.config.ts` |
| Link-preview cards (1200×630 JPGs) | `web/lib/cards.ts`, images in `web/public/og/`, drawn by `web/scripts/og/render.mjs` |
| Homepage | `web/components/home/Home.tsx`, `web/styles/16-home.css`; its brief is `HOMEPAGE_BRIEF.md` |
| Tools page, tool registry | `web/lib/tools.ts`, `web/components/tools/ToolPicker.tsx` |
| About page | `web/tools/about/About.tsx` |
| 404 page | `web/app/not-found.tsx` |
| Look and design rules | `DESIGN.md`, `PRODUCT.md` |

**Checks to run before every push** (from `web/`): `npm run lint`,
`npm run typecheck`, `npm run build`; from the repo root,
`python3 tests/run.py --web`. CI (`.github/workflows/tests.yml`) also runs
the numbers baselines. Follow `web/AGENTS.md` (this Next.js version differs
from older ones; read its docs in `node_modules/next/dist/docs/` before
using an API you aren't sure of).

**Known traps**

- `python3 tests/run.py --web` checks the figures quoted in the articles
  against the calculators, reading `web/content/articles/*.html` (T1.10,
  done). Plain `python3 tests/run.py` still reads the old site's file. A
  changed figure in an article without a matching check isn't caught, so
  add a `says(...)` check in `tests/math.test.js` for any new figure.
- `src/page-meta.json` (the old site's copy) no longer matches
  `web/lib/page-meta.json`, and that's intended. Edit only the `web/` one.
- Pages are `noindex` everywhere except the production deployment
  (`LIVE` in `web/app/layout.tsx`). Don't "fix" the noindex you see locally
  or on previews.
- The homepage's look was chosen by the owner (`HOMEPAGE_BRIEF.md`). Changes
  to what it shows are owner decisions.
- Style for code and comments: match the surrounding code (plain-language
  comments, no marketing words). Copy rules for the site's own text are in
  `PRODUCT.md` and `DESIGN.md`.

---

## 1. Where things stand (audit, 2026-10-13)

**Already good**

- Every page has its own title, description, canonical URL, Open Graph and
  Twitter tags, and a 1200×630 preview card.
- Structured data on every page: `WebApplication` (free, `FinanceApplication`),
  `WebSite` on the homepage, and `FAQPage` from each article's questions.
- Pages are rendered on the server, so the tool and its article are in the
  HTML without JavaScript (checked: `/4-percent-rule` has about 3,500 words in
  its HTML, `/calculator` about 1,400).
- `sitemap.xml` (every page in `SLUGS`) and `robots.txt` (allow all, points to
  the sitemap).
- Redirects from the old site's addresses (`/x.html` → `/x`, `/single` →
  `/advanced`, `/series` → `/stages`); `www` redirects to the bare domain;
  unknown addresses return a real 404 with links to popular tools.
- 28 "about this tool" articles, 380–1,430 words each, with worked examples
  and questions. 128 links between pages from inside the articles.
- Eight strategy pages (`/4-percent-rule`, `/guardrails`, `/vpw`, ...) that
  target specific, lower-competition searches.

**Gaps, roughly in order of impact**

| # | Gap | Evidence |
| --- | --- | --- |
| G1 | The site moved hosts (2026-10-05) and `/` changed from the calculator to a landing page (2026-10-12), with no search tool set up to watch either | `MIGRATION.md` "Search Console and analytics watched for two weeks" unchecked; no verification file, meta tag or notes anywhere |
| G2 | Weak trust signals for a money site. Google rates finance pages as "Your Money or Your Life" and looks hard for who wrote them, their sources and when they were checked | 0 links to outside sources in all 28 articles; no "last reviewed" dates; no author; About doesn't say who runs the site |
| G3 | Titles too long to show in full; descriptions too long | 18 of 31 titles over 60 characters (longest 84); most descriptions 165–218 characters |
| G4 | Main headings hidden or vague | `/calculator`, `/guide`, `/tools`, `/about`: the `<h1>` is visually hidden (`srlive` class in `PageShell.tsx`). Homepage `<h1>` is "Know your number." with no search words |
| G5 | Weak internal links to some pages | The 8 strategy pages aren't linked from the homepage or `/tools`; they link to each other |
| G6 | Sitemap has no `lastmod` | `web/app/sitemap.ts` returns only `url` |
| G7 | Facts written into text that will go stale | "Shiller's CAPE is 41" in `4-percent-rule.html` and `cape-withdrawal.html`; "2026" in titles and tax content |
| G8 | Room for more strategy pages at almost no cost | The Drawdown Simulator has 15 strategies (`web/tools/drawdown/text.ts`); 7 have no page |
| G9 | The old GitHub Pages site still builds on every push to `main`. It's kept on purpose as the rollback (`MIGRATION.md`), but should go once the move is confirmed | A "pages build and deployment" run follows each push. Verify `retcalc.github.io` redirects to retcalc.app meanwhile |
| G10 | Article figures aren't tested against the new site's articles | See "Known traps" in §0 |

---

## 2. Ground rules

1. **Every page must answer something no other page does**, with numbers
   from RetCalc's own engine. No pages that only swap a dollar amount or a
   city name: Google treats mass-produced near-duplicates as spam ("scaled
   content abuse").
2. **No fake signals**: no star ratings or review structured data without
   real reviews, no bought links, no link networks, no hidden text.
3. **Keep URLs stable.** If an address must change, add a permanent redirect
   in `web/next.config.ts` in the same commit.
4. **Pages updated yearly keep one address** (`/401k-limits`, not
   `/401k-limits-2027`); the year goes in the title and text.
5. **Accuracy first.** Every figure in an article is either produced by the
   calculators (and tested, T1.10) or cited to a primary source with a link.
6. **Measure before and after.** Note the date of every change that could
   move rankings in the progress log, so Search Console data can be read
   against it.

---

## 3. Phase 0: Measure and protect the move (owner, this week, free)

- [x] **T0.1 Owner: Google Search Console.** Add retcalc.app as a *Domain*
  property, verified with a DNS TXT record at the DNS host (Cloudflare,
  per `MIGRATION.md`; DNS only, so this changes nothing about serving).
  Then: Sitemaps → submit `https://retcalc.app/sitemap.xml`; URL Inspection →
  "Request indexing" for `/`, `/calculator`, `/drawdown`, `/4-percent-rule`,
  `/guide`.
  *Done 2026-10-13: set up on the retcalc Google account (it was on the owner's personal account before). Sitemap submitted; indexing requested for `/`, `/calculator`, `/privacy`, `/drawdown`, `/4-percent-rule` and `/guide`. First report (as of 10/8): 15 indexed, 14 "Discovered, currently not indexed".*
- [x] **T0.2 Owner: Bing Webmaster Tools.** Sign in and use "Import from
  Google Search Console". Bing's index also feeds ChatGPT search,
  DuckDuckGo and others.
  *Done 2026-10-13: imported from Search Console; sitemap submitted by hand (the import brought none). Bing's inspection of `/` still showed the old description, which clears on re-crawl.*
- [x] **T0.3 Owner: Ahrefs Webmaster Tools** (free for verified sites).
  Connect via Search Console. Gives backlinks and a monthly site audit.
  *Done 2026-10-13: connected through Search Console. Ahrefs' own web analytics script was skipped: Cloudflare Web Analytics is already on the site.*
- [ ] **T0.4 Owner: record a baseline** in §12's baseline table:
  - pages indexed (Search Console → Indexing → Pages)
  - last 28 days clicks and impressions, top 20 queries, top pages
  - referring domains (Ahrefs)
  - PageSpeed Insights phone scores and Core Web Vitals for `/`,
    `/calculator`, `/drawdown`, `/4-percent-rule`, `/tools`
- [ ] **T0.5 Owner: watch the move for 4–6 weeks.** Weekly: Indexing →
  Pages for jumps in "Not found (404)", "Page with redirect" or "Duplicate
  without user-selected canonical"; Performance for falling clicks on pages
  that existed before the move. Then tick "Search Console and analytics
  watched" in `MIGRATION.md`.
- [ ] **T0.6 Owner: links that meant the calculator.** In Search Console →
  Links (and Ahrefs), find sites linking to `/` that clearly meant the
  calculator, and ask them to link to `/calculator`.
- [ ] **T0.7 Owner: retire GitHub Pages, after the watch.** Now: check
  that `https://retcalc.github.io/` redirects to `https://retcalc.app/`, so
  the old copy can't compete in search. Pages is the move's rollback
  (`MIGRATION.md`, "Rollback"), so leave it on until T0.5's watch ends
  cleanly; then turn it off (repo Settings → Pages), together with
  `MIGRATION.md`'s "remove the old build from the repo" step.

---

## 4. Phase 1: Technical and on-page fixes (agent, weeks 1–3, free)

Each is a small change. One commit per task, so each can be tied to its
effect in Search Console.

### T1.1 Shorter titles — Agent  [x] 2026-10-13

Change `title` in `web/lib/page-meta.json` to fit in about 60 characters,
search words first. Proposed (owner may adjust; unlisted pages already fit):

| Slug | Proposed title (chars) |
| --- | --- |
| home | RetCalc: Free Retirement Planning Toolkit (41), the owner's wording |
| calculator | Free Retirement Calculator: Will Your Savings Last? (51) |
| advanced | Advanced Retirement Calculator: Taxes, Fees & History (53) |
| drawdown | Retirement Withdrawal Calculator: Will My Money Last? (53) |
| 4-percent-rule | 4% Rule & Safe Withdrawal Rate Calculator \| RetCalc (51) |
| guardrails | Guyton-Klinger Guardrails Calculator \| RetCalc (46) |
| vpw | VPW Calculator: Variable Percentage Withdrawal \| RetCalc (56) |
| vanguard-dynamic-spending | Vanguard Dynamic Spending Calculator \| RetCalc (46) |
| risk-based-guardrails | Risk-Based Guardrails Calculator \| RetCalc (42) |
| rmd-withdrawal-strategy | RMD Withdrawal Strategy Calculator \| RetCalc (44) |
| ratcheting-withdrawal | Kitces Ratchet Calculator: The 4% Rule With Raises (50) |
| cape-withdrawal | CAPE-Based Withdrawal Rate Calculator \| RetCalc (47) |
| optimizer | Retirement Optimizer: Social Security & Roth Conversions (56) |
| bridge | Early Retirement Calculator: Reach 59½ Penalty-Free (51) |
| rmd | RMD Calculator: Required Minimum Distributions by Age (53) |
| healthcare | Retirement Healthcare Cost Calculator: ACA & Medicare (53) |
| backtest | Portfolio Backtest: Stocks, Bonds & Cash Since 1926 (51) |
| incometax | 2026 Income Tax Calculator: Federal, State & FICA (49) |
| mortgage | Mortgage Calculator With Taxes, PMI & Extra Payments (52) |
| college | College Savings Calculator: How Much to Save \| RetCalc (54) |

Notes:
- `jsonLdFor` takes the app's name as the title before " | ". Titles without
  " | RetCalc" would give the whole title as the name; make it strip a
  trailing " | RetCalc" if present, else use the part before the first ":".
- The link-preview cards use `web/lib/cards.ts`, not these titles; no new
  images needed.
- `seo-compare.mjs` was deleted and `MIGRATION.md` updated.

Done when: every title ≤ 60 characters; lint, typecheck, build pass.

### T1.2 Shorter descriptions — Agent  [x] 2026-10-13

Rewrite each `desc` in `web/lib/page-meta.json` to 140–155 characters. Lead
with what the page answers, then the proof ("tested against every
retirement since 1926"), then "No account needed." where it fits. Match the
voice in `PRODUCT.md`. Done when: every description is 120–155 characters.

### T1.3 Visible main headings — closed 2026-10-13, no change

Decided by the owner: the `<h1>` on `/calculator`, `/guide`, `/tools` and
`/about` stays visually hidden (`srlive` in `PageShell.tsx`). Search engines
read it either way, the gain from showing it is small, and those pages go
straight to the tool. The homepage part is moot: its `<h1>` became "The
complete retirement planning toolkit." with the tagline change, and the lede
below it names the tools and "every market since 1926".

### T1.4 Sitemap `lastmod` — Agent  [x] 2026-10-13

`web/app/sitemap.ts` serves each page's date from `web/lib/lastmod.json`.
`node scripts/lastmod.mjs` (from `web/`) writes that file: for each page, the
date of the last commit that touched its article, its route or its tool's
folder, or today if any of those has uncommitted changes. It is not the build
date. The dates are committed rather than worked out at build time, because
Vercel's clone is shallow and would give every page the same date.

- **Run it before committing a change to a page's article or tool**
  (`node scripts/lastmod.mjs check` says whether it's out of date).
  `tests/run.py --web` only checks that every page has a date, so a forgotten
  run leaves a stale date, not a failure.
- Shared code (components, the calculation engine) isn't counted, so a
  change there doesn't move every page's date.
- A new page needs a row in the script's `TOOL_DIR` if its tool's folder
  isn't `tools/<slug>`.

### T1.5 Internal links — Agent  [~] partly done 2026-10-13

- ~~`/tools` page: a "Withdrawal strategies" group.~~ Ruled out by the owner:
  the strategy pages are the Drawdown Simulator set up for one strategy, not
  separate tools, so they don't belong in the tool list (and the site's tool
  count doesn't include them).
- ~~Links from the compare view's table.~~ Not built: the table is filled in
  by the worker after the page loads, so its links wouldn't be in the HTML a
  crawler reads. `/drawdown`'s own article already links all eight strategy
  pages (checked on the live site).
- [x] The eight strategy articles had no "Related tools" section (and four had
  no internal links at all); each now has one with four links.
- [x] Every other article already had a "Related tools" or "Go further" list.
- [ ] Homepage link to the strategy pages: owner's call; leaning no, for the
  same reason as `/tools`.

### T1.6 More structured data — Agent  [~] breadcrumbs done 2026-10-13

In `web/lib/seo.ts`:
- [x] `BreadcrumbList` on every page except home and Privacy (`crumbs()` in
  `seo.ts`). Strategy pages sit under the Drawdown Simulator
  (RetCalc › Retirement Withdrawal Calculator › VPW Calculator), not under
  Tools, since they aren't separate tools; `/72t` and `/rmd` under the tool
  they open; Advanced and Stages under the Calculator; other tools under
  Tools. Check with Google's Rich Results Test once live.
- `Organization` on the homepage (name, url, logo `https://retcalc.app/icon-512.png`,
  `sameAs` with any profiles the owner has, e.g. the GitHub repo).
- When articles get dates (T2.3), add `dateModified` to the page's
  `WebApplication` entry, or a `WebPage` entry with `dateModified` and
  `reviewedBy` / `author` once T2.1 exists.
- Keep `FAQPage`. Google stopped showing FAQ results for most sites in 2023,
  so it won't change how results look, but it costs nothing and AI answer
  engines read it.
- Never add `aggregateRating` or `review` without real reviews.

Check with Google's Rich Results Test and validator.schema.org (paste the
HTML from a local production build).

### T1.7 Speed and Core Web Vitals — Agent  [ ]

After T0.4 gives real numbers: if any page fails Core Web Vitals on phones
(Search Console → Core Web Vitals, or PageSpeed Insights), fix the worst
measure first. Likely places, to confirm with measurements, not assume:
- INP (tap responsiveness) on the heavy tools (`/drawdown` and its strategy
  pages, `/optimizer`): long tasks when inputs change; move work to the
  existing worker or defer it.
- LCP on the homepage: the hero text's reveal animation
  (`useHomeMotion` sets `data-rv="pre"` before revealing); make sure the
  `<h1>` is shown immediately (no opacity 0 on first paint).
Use the `vercel-react-best-practices` skill. Don't change any calculated
figure; the baselines in CI must still pass.

### T1.8 Stale facts from one place — closed 2026-10-13, replaced

Looked at before building. The facts that change on a schedule already live
in one place, `web/lib/engine/math.js`, which the tools and the articles'
test both read, and with T1.10 every figure an article quotes is checked
against it. Change a constant and `tests/run.py --web` fails on the exact
article sentence that quotes the old value. A `{{placeholder}}` layer would
only hide that, because the derived figures (a withdrawal rate at today's
CAPE, a dollar amount at a bracket) have to be rewritten by hand anyway.
Instead there is a checklist: see "Yearly update checklist" under C4.

### T1.9 404 and stray addresses — Agent  [x] 2026-10-13, all passed

Checked on the live site: unknown addresses return a real 404 (and the 404
page is `noindex`); a trailing slash (`/drawdown/`) redirects to `/drawdown`;
`http://` redirects to `https://`; `www` redirects to the bare domain; the
old `.html` addresses and `/single` redirect to their new pages. All are
permanent (308) redirects. Nothing to fix.

### T1.10 Test the new site's articles — Agent  [x] 2026-10-13

`tests/run.py --web` now reads `web/content/articles/*.html` (the
calculator's article is still called `home` in the tests, as on the old
site). All 939 checks pass against the live articles, and a deliberately
changed figure in `72t.html` made it fail, so the check is reading them.

---

## 5. Phase 2: Trust signals (weeks 2–6, free)

Probably the biggest single lever, because Google holds money advice to its
strictest standard.

### T2.1 Who runs RetCalc — Owner decision → Agent  [ ]

Ask the owner: what name (real name or a consistent pen name), a one-line
background, an optional photo, and a contact email. Then add to the About
page (`web/tools/about/About.tsx`) a short "Who builds RetCalc" section:
who, why it exists, that it's free and independent, no ads or affiliate
links (if true), and how to report an error.

### T2.2 Sources in every article — Agent  [ ]

Add a short "Sources" list at the end of each article in
`web/content/articles/`, linking primary sources, and link them where the
claim is made. Starting points:

| Topic | Source |
| --- | --- |
| 4% rule | Bengen, "Determining Withdrawal Rates Using Historical Data" (1994); the Trinity study (Cooley, Hubbard, Walz, 1998) |
| Guardrails | Guyton & Klinger, "Decision Rules and Maximum Initial Withdrawal Rates" (2006) |
| VPW | Bogleheads wiki, "Variable percentage withdrawal" |
| Ratchet | Kitces, on ratcheting safe withdrawal rates |
| CAPE | Shiller's online data (Yale); Early Retirement Now's safe withdrawal rate series |
| Vanguard dynamic spending | Vanguard's research paper on dynamic spending |
| RMDs | IRS Publication 590-B; the Uniform Lifetime Table |
| 72(t) | IRS Notice 2022-6; IRS "Substantially equal periodic payments" page |
| Social Security | ssa.gov (claiming ages, full retirement age) |
| Medicare, IRMAA | cms.gov and medicare.gov for the year's premiums and brackets |
| ACA subsidies | healthcare.gov; IRS Form 8962 instructions |
| Taxes, limits | IRS yearly announcements (brackets, standard deduction, 401(k) and IRA limits) |
| Market data | The data series the engine uses, named exactly as in the About page |

Check each link resolves and says what's claimed. Prefer the primary
document over a news article about it.

### T2.3 Dates on articles — Agent  [ ]

Show "Last reviewed {Month YYYY}" at the top of each article's body, from a
per-article date (a map in `web/lib/articles.ts` or a `data-reviewed`
attribute on the `<article>`). Use it for `dateModified` (T1.6) and the
sitemap's `lastmod` (T1.4). Update a date only when the article is
actually reviewed.

### T2.4 Methodology page section — Agent  [ ]

The About page already explains the data and assumptions. Make sure it has,
under clear headings: data sources and their date range, what the tools
assume (fees, rebalancing, inflation, taxes), what they don't model, and
how corrections are made. Link to it from each tool's footer line.

### T2.5 "Educational, not advice" — Agent  [ ]

One short line near each tool's results, linking to the fine print on the
About page. Use `PRODUCT.md`'s voice; no alarming legal language.

### T2.6 Public changelog — Agent  [ ]

A `/changes` page (or a section of About) listing dated user-visible
changes and corrections. Add it to `page-meta.json` so it gets a title and
sitemap entry. It shows the site is kept up.

---

## 6. Phase 3: New pages (months 2–6, free, the main source of growth)

Before building any new page, check search demand: Search Console queries
(once T0.1 has data), Google Keyword Planner (free with a Google Ads account,
no spend needed), Google Trends, and the "People also ask" box. Record the
target query and why in §11's content list.

### C1. Seven more strategy pages — Agent  [ ] deferred 2026-10-13

**Deferred by the owner (2026-10-13).** Reasons: 14 existing pages are still
"Discovered, currently not indexed", some of the seven have little demand,
and each page adds upkeep. Revisit once those pages are indexed and Search
Console shows real queries; then build two or three by demand, not all seven.

The engine already runs these. Proposed slugs and targets (confirm demand
first; build the strongest first):

| Strategy (`text.ts` id) | Slug | Target searches |
| --- | --- | --- |
| 95% rule (`clyatt`) | `/95-percent-rule` | 95% rule retirement, Clyatt withdrawal |
| Floor & ceiling (`floorceil`) | `/floor-and-ceiling-withdrawal` | floor and ceiling withdrawal strategy |
| Yale Endowment (`yale`) | `/yale-endowment-withdrawal` | Yale endowment spending rule retirement |
| Fixed % of portfolio (`pct`) | `/fixed-percentage-withdrawal` | constant percentage withdrawal |
| Sensible withdrawals (`sensible`) | `/sensible-withdrawals` | sensible withdrawals strategy |
| Hebeler Autopilot II (`hebeler`) | `/autopilot-withdrawal` | Hebeler autopilot retirement |
| 1/N (`oneovern`) | `/one-over-n-withdrawal` | 1/N withdrawal (low demand; last) |

**Checklist for each new strategy page** (copy the `/vpw` page):
1. `web/lib/page-meta.json`: `title` (≤ 60 chars), `desc` (≤ 155), `h1`.
2. `web/lib/site.ts`: add to `TOOL_SUB` (`"drawdown"`), `STRATEGY_LEDE`, and
   `STRATEGY_PAGES` (sets the order in `StrategyLinks` and T1.5's lists).
3. `web/lib/engine/landing.js`: a `DD_LANDING` entry with the worked
   example's inputs (start each January, 60/40, the strategy's settings).
4. `web/app/<slug>/page.tsx`: same as `web/app/vpw/page.tsx` with the slug.
5. `web/content/articles/<slug>.html`: same structure as `vpw.html`
   (`<article class="seo-a panel about" data-page="<slug>">`, an `<h2>`, a
   `<div class="body">` with: what it is and who devised it; how it works;
   a worked example whose figures come from the preset above; who it suits
   and its catch; questions in `<details><summary>`; sources). Aim for
   600–900 words. Every figure from the calculator.
6. `tests/math.test.js`: `says(...)` checks for the worked example's figures
   (needs T1.10).
7. `web/lib/cards.ts`: a card entry; render `web/public/og/<slug>.jpg` with
   `web/scripts/og/render.mjs` (it launches Chrome by `channel: "chrome"`;
   on Linux pass an `executablePath` instead).
8. The sitemap picks the page up from `SLUGS` automatically. Check `/tools`
   and the strategy links list it.
9. Run all checks in §0, look at the page on phone and desktop, then commit.

### C2. "Can I retire at {age}?" pages — Owner decision → Agent  [ ]

Ages where the rules genuinely differ: **50, 55, 59½, 62, 65, 67**. Each
page explains that age's rules and traps and opens the right tool preset
for it, with a worked example from the engine:
- 50: the bridge to 59½ (Bridge tool); 72(t) and Roth ladder; ACA until 65
- 55: the rule of 55 for 401(k)s; Bridge tool
- 59½: penalty-free withdrawals; Roth conversion window before RMDs
- 62: earliest Social Security and what claiming early costs (Optimizer)
- 65: Medicare, IRMAA, the end of ACA subsidies (Healthcare)
- 67: full retirement age; delaying to 70 (Optimizer)

Ask the owner first: a new page type (`/retire-at-55`), so it needs a home
in the navigation (likely the Guide or Tools) and a look consistent with
`DESIGN.md`. Same checklist as C1, adapted to the tool each page opens.

### C3. Data pages people cite — Agent  [ ]

Built from the historical engine; each has a table, a short explanation,
a chart and a CSV download. These attract links (C3 is the main fuel for
Phase 4).
1. **Safe withdrawal rate tables**, `/safe-withdrawal-rate`: success rate by
   withdrawal rate (3–6%) × length (20–50 years) × stock share (40–100%),
   all US retirements since 1926; plus the highest rate that never failed.
2. **The worst years to retire**, `/worst-years-to-retire`: the starting
   years that came closest to failing at 4%, and why (1929, 1937, 1966,
   1969, 1973, 2000).
3. **Today's CAPE and what it implied**, `/cape-today`: today's value
   (from T1.8's data module), the history, and the CAPE tool's suggested
   rate. Updated monthly.
4. **Sequence-of-returns risk**, `/sequence-of-returns-risk`: two real
   retirees with the same average return and different outcomes.

Compute the tables at build time from the engine (a script writing JSON),
not by hand, and add tests that pin a few cells.

### C4. Yearly reference pages — Agent, on a calendar  [ ]

Heavy seasonal search traffic. Publish within days of the official
announcement, then update the same page each year.

| Page | Slug | Source, usual timing |
| --- | --- | --- |
| 401(k), IRA and HSA limits | `/contribution-limits` | IRS, usually October–November (HSA: May) |
| Tax brackets and standard deduction | `/tax-brackets` | IRS, usually October–November |
| IRMAA brackets and Part B premium | `/irmaa-brackets` | CMS, usually October–November |
| Social Security COLA, bend points, earnings limit | `/social-security-changes` | SSA, usually October |
| RMD age and the Uniform Lifetime Table | covered by `/rmd`'s article | IRS |

Each links to the tool that uses those numbers (Income Tax, Healthcare,
Optimizer). The numbers come from T1.8's data module, so the pages and the
tools update together. Add a reminder to the progress log each year.

#### Yearly update checklist

Everything is in `web/lib/engine/math.js` (search for the name). Change the
constant, run `python3 tests/run.py --web`, and let each failure show which
article sentence to update.

| Fact | Search for | Articles that quote it |
| --- | --- | --- |
| Federal brackets, standard deduction, FICA limits | `FED_2026`, `LTCG_2026` | `incometax`, `roth`, `advanced`, `guide`, `tools` |
| State retirement-income rules | `state retirement rules, tax year` | `incometax`, `roth` |
| Medicare Part B and IRMAA tiers | `2026 Medicare IRMAA` | `healthcare` |
| ACA poverty level, benchmark premiums, subsidy percentages | `Federal poverty level for 2026` | `healthcare` |
| Social Security bend points, tax cap, full retirement age | `SS_BEND1` | `guide`, `optimizer` |
| RMD start age | the function holding `? 75 : 73` | `rmd`, `roth`, `rmd-withdrawal-strategy` |
| Today's CAPE and its date | `CAPE_NOW` | `4-percent-rule`, `cape-withdrawal` (and the figures derived from it) |
| Mortgage rate and its date | `MORT_RATE_ASOF` | `mortgage` |

Then: the year in titles and descriptions (`web/lib/page-meta.json`, e.g.
"2026 Income Tax Calculator" and "2026 taxes"), the year in the articles'
headings, `node web/scripts/lastmod.mjs`, and a note in the progress log.

### C5. Question guides that lead to tools — Agent  [ ]

Short articles (700–1,200 words) answering a common question with a
historical answer and a link into the tool, preset. Pick from Search
Console queries where RetCalc shows at positions 8–30 (the fastest wins).
Candidates: "How long will $1 million last in retirement" (Drawdown);
"Roth conversion ladder" (Bridge); "ACA subsidy cliff" (Healthcare);
"Coast FIRE number" (FIRE); "How much do I need to retire" (Calculator);
"When to claim Social Security" (Optimizer). Where these would live (a
`/learn/...` section, or the Guide) is an owner decision.

### C6. Monthly refresh of existing pages — Agent, ongoing  [ ]

Each month: in Search Console, take the 3 pages with the most impressions
and the lowest click rate. Rework the title and description, make the
article's opening sentence answer the query directly, add or improve the
worked example. Log what changed.

---

## 7. Phase 4: Links and getting the word out (owner, ongoing, free)

Mostly the owner's: these need a person's accounts and judgement. An agent
can draft posts and messages for the owner to send.

- [ ] **L1 Communities.** Bogleheads, r/financialindependence, r/Fire,
  r/retirement, r/personalfinance, r/ChubbyFIRE, r/fatFIRE. Answer real
  questions with a specific result and a link to the exact page ("Here's
  every 1966 retiree at 4.5%: ..."). Read each community's self-promotion
  rules first; most allow a link that answers the question.
- [ ] **L2 Show HN.** "Show HN: A retirement calculator that runs in your
  browser and tests every market since 1926". Post on a weekday morning US
  time; reply to every comment.
- [ ] **L3 Product Hunt and AlternativeTo.** Free listings; AlternativeTo as
  an alternative to cFIREsim, FIRECalc, FICalc, ProjectionLab.
- [ ] **L4 Outreach to the people whose methods the site implements**, once
  C3 exists: Kitces (ratchet), Early Retirement Now (CAPE, safe withdrawal
  series), the Bogleheads VPW community, ChooseFI, the Mad Fientist (Roth
  ladder, 72(t)), Guyton-Klinger write-ups. Template:

  > Hi {name}, I built a free tool that tests {their method} against every
  > US retirement since 1926: {link}. It reproduces your {specific result}
  > and shows {one new finding}. Free, no account needed. If it's useful to your
  > readers, I'd be glad if you linked it; corrections welcome too.

- [ ] **L5 Journalist requests.** Qwoted and Featured.com have free tiers.
  Answer retirement questions with figures from C3's pages.
- [ ] **L6 The GitHub repo.** Set the repo's About text and website link,
  and a README line pointing to retcalc.app.
- [ ] **L7 Later: an embeddable widget** (e.g. a small 4% rule checker) that
  bloggers can paste, with a credit link. A bigger build; only after C3.

---

## 8. Phase 5: Showing up in AI answers (agent, low effort, free)

- [ ] **A1** Keep `robots.txt` open to all crawlers, AI ones included. On
  the live site, check that no Vercel firewall or bot-protection setting
  blocks GPTBot, ClaudeBot, PerplexityBot, Google-Extended or Bingbot.
- [ ] **A2** Make each article's first one or two sentences a direct,
  quotable answer with a number ("At 4%, 95% of 30-year retirements since
  1926 lasted..."). AI Overviews and chat search quote passages like these.
  Do this as part of C6.
- [ ] **A3** Optional: `web/public/llms.txt` listing the tools, the data
  pages and one line on each. The evidence it helps is thin; it costs
  minutes.

---

## 9. Measuring progress

**Monthly routine (owner, or agent if given Search Console exports):**
1. Search Console → Performance, last 28 days vs. the previous 28, grouped
   by page type: homepage, calculator modes, strategy pages, other tools,
   new content.
2. Indexing → Pages: indexed count vs. the sitemap's page count.
3. Ahrefs Webmaster Tools: new referring domains.
4. Core Web Vitals report: any failing pages.
5. Add one row to §12's progress log with the numbers and what changed.

**Targets for 6 months after Phase 1:**
- Every sitemap page indexed.
- The strategy pages on page 1 for their own names (e.g. "VPW calculator",
  "Guyton-Klinger calculator").
- Click rate up on pages whose titles changed (compare 28 days before
  vs. after, same pages).
- C3's data pages with their first 10–20 referring domains.
- All pages passing Core Web Vitals on phones.

---

## 10. Inexpensive extras worth paying for (optional)

None are needed to start; Phases 0–2 alone fix most of what's holding the
site back. Prices are approximate; check current pricing.

| Item | Rough cost | Why |
| --- | --- | --- |
| A credentialed reviewer (CFP or CFA) to check the main articles, credited "Reviewed by {name}, CFP" with the date | A few hundred dollars, once | The strongest trust signal for a money site; pairs with T2.1–T2.3 |
| One month of Ahrefs or Semrush for a keyword sprint before C1–C5, then cancel | About $100–150 | Search volumes, competitors' top pages, questions to target |
| Keywords Everywhere credits (cheaper alternative) | About $10–20 | Search volumes shown while browsing |
| Vercel Pro, only if ads or affiliate links are ever added | About $20/month | Vercel's free Hobby plan is for non-commercial sites only |

---

## 11. Open questions for the owner

| # | Question | Blocks |
| --- | --- | --- |
| Q1 | ~~Visible headings on Calculator, Guide, Tools, About~~ Decided 2026-10-13: leave hidden | T1.3 |
| Q2 | ~~Where strategy pages are linked~~ Not from `/tools` (they aren't separate tools). Homepage link still open, leaning no | T1.5 |
| Q3 | Name or pen name, background line, photo, contact for "Who builds RetCalc" | T2.1 |
| Q4 | ~~Approve the title list in T1.1~~ Done 2026-10-13, home edited by the owner | T1.1 |
| Q5 | "Can I retire at X?" pages: yes/no, and where they sit in the navigation | C2 |
| Q6 | Where question guides live (`/learn`, the Guide, or not at all) | C5 |
| Q7 | Any social or community profiles to list in `Organization.sameAs` | T1.6 |
| Q8 | Is RetCalc staying free of ads and affiliate links? (Affects T2.1's wording and hosting cost) | T2.1 |

**Content list** (fill in as pages are planned; one row per page):

| Page | Target query | Evidence of demand | Status |
| --- | --- | --- | --- |
| | | | |

---

## 12. Progress log

**Baseline** (T0.4):

| Date | Indexed pages | Clicks (28d) | Impressions (28d) | Referring domains | CWV pass (phone) |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

**Log:**

| Date | Task | Commit | What changed / result |
| --- | --- | --- | --- |
| 2026-10-13 | — | — | Plan written from an audit of `main` at `89131a8` |
| 2026-10-13 | T1.1, T1.2 | (this branch) | All 31 titles ≤ 60 characters and descriptions 120–155, in `web/lib/page-meta.json`; `jsonLdFor` names the app from the title without ` \| RetCalc`, else the part before the colon; `seo-compare.mjs` deleted. Home title is "RetCalc: Free Retirement Planning Toolkit" by the owner's choice |
| 2026-10-13 | T1.5 (part) | (this branch) | "Related tools" added to the eight strategy articles; `/tools` group and compare-view links ruled out, see T1.5 |
| 2026-10-13 | T1.4 | (this branch) | `lastmod` in the sitemap, from `web/lib/lastmod.json` (`web/scripts/lastmod.mjs`); test checks every page has a date |
| 2026-10-13 | T0.1–T0.3 | — | Search Console (retcalc account), Bing and Ahrefs set up; sitemap in both; indexing requested for six pages. Baseline (T0.4) not yet recorded |
| 2026-10-13 | T1.3 | — | Closed with no change: headings stay hidden (owner's call); homepage `<h1>` already carries the search words |
| 2026-10-13 | T1.10, T1.8 | (this branch) | `tests/run.py --web` reads the live articles. T1.8's placeholder module not built: the facts are already single-sourced and tested; a yearly checklist replaces it |
| 2026-10-13 | T1.6 (part) | (this branch) | BreadcrumbList on every page but home and Privacy; Organization and dateModified still open (Q7, T2.3) |
| 2026-10-13 | T1.9 | — | Live-site check: 404s, trailing slash, http, www and old addresses all behave; no change needed |
| 2026-10-13 | C1 | — | Deferred by the owner until the baseline and indexing are in |
