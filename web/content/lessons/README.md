# Writing a Learn lesson

Each lesson is one HTML file here, `<slug>.html`, named by its slug in
`lib/learn/catalog.ts`. The site reads it at build time and lays it out:
the lesson column on the left; Your numbers, Try it, Key terms, Go deeper
and "In this lesson" beside it. You write the words and the pictures' data;
the layout is done for you.

## Who it's for and how it sounds

- Readers range from someone who just opened their first 401(k) to someone
  a year from retiring. Explain every term the first time it appears, in
  plain words, without talking down. Assume no finance background, but
  don't stop to explain things a careful adult already knows.
- Casual professional: like a knowledgeable friend who plans for a living,
  writing carefully. Use "you". Short and long sentences mixed. No hype, no
  jokes for their own sake, no scolding.
- US rules and US market history. Say "in the US" only where it matters.
- It must not read as AI-written. Every draft goes through the humanizer
  skill (below) before it's done.

## Length and shape

A deep read, not a summary: usually 1,800 to 3,000 words (10 to 15
minutes). A small topic can be shorter (This year's limits is mostly a
reference table). Go into the details that change the answer: the rules,
the ages and dollar limits, the edge cases, the history, the research by
name and year, the trade-offs, the common mistakes.

A typical lesson, adapted to the topic:

1. A lede: two or three sentences on what this is and why it matters.
2. The idea, shown with a small worked example a reader could check by hand.
3. The full picture, with a chart or table.
4. The details that change the answer: rules, ages, limits, edge cases.
5. What history or research shows, with names and dates.
6. What you can do about it: each option, what it does, what it costs.
7. Seeing it in your own plan: which RetCalc tool, what to change, what to
   watch.
8. Common questions (three to five).
9. In short: four or five lines to take away.

Sections are `<h2>`s; each becomes an entry in "In this lesson", so give
each an `id` and a heading that names what the section holds.

## The file

```html
<article class="lesson" data-slug="sequence-risk" data-reviewed="2026-10-26"
  data-title="Sequence-of-returns risk"
  data-idea="Same average return, different order, different outcome"
  data-tool="backtest" data-try="Run your plan through every past market, with your plan already filled in.">

<p class="lede">...</p>

<h2 id="order">Why withdrawals make the order matter</h2>
<p>...</p>
<h3>A subheading</h3>
<ul><li>...</li></ul>

<!-- data: how the table's figures were worked out -->
<figure>
  <table>
    <thead><tr><th></th><th>Return</th><th>Balance</th></tr></thead>
    <tbody><tr><td>Year 1</td><td class="neg">−20%</td><td>$76,000</td></tr></tbody>
  </table>
  <figcaption>What the table shows, and anything it assumes.</figcaption>
</figure>

<!-- data: how the chart's figures were worked out -->
<figure data-chart='{"type":"line","x":[0,5,10],"xLabel":"Year","y":"money","series":[{"name":"Bad years first","tone":"bad","values":[1480000,720000,490000]}]}'>
  <figcaption>...</figcaption>
</figure>

<p data-yours></p>

<h2 id="questions">Common questions</h2>
<details><summary>A question a reader would ask?</summary><p>The answer.</p></details>

<section class="insum"><h2 id="short">In short</h2><ul><li>...</li></ul></section>

<footer>
  <ul class="points"><li>What the reader will learn, 1</li><li>2</li><li>3</li></ul>
  <ul class="terms"><li data-term="Real return">A return after inflation. 7% growth with 3% inflation is about a 4% real return.</li></ul>
  <ul class="deeper"><li><a href="https://...">Title of the page</a> <span>Who publishes it</span></li></ul>
</footer>
</article>
```

The article's attributes:

- `data-title`: the lesson's title, sentence case, at most about 40
  characters.
- `data-idea`: one line, under 70 characters, shown under the title in the
  track's list.
- `data-tool`: the RetCalc page the Try it button opens (a slug from the
  list below), and `data-try`: one sentence on what it does there, ending
  ", with your plan already filled in." when the tool takes the plan.
- `data-reviewed`: today's date, once every figure has been checked.

The footer:

- `points`: exactly three, under 60 characters each, what the reader will
  learn ("Why the order of returns matters once you withdraw"). Shown when
  the lesson is suggested.
- `terms`: two to four key terms with a one or two sentence definition.
- `deeper`: two to eight outside links (most lessons need four or five), primary or trusted sources only (SSA,
  IRS, Medicare.gov, HealthCare.gov, Investor.gov, the Federal Reserve,
  the original papers, Bogleheads wiki, Early Retirement Now, Kitces,
  Morningstar). Every study or researcher the text names must be listed
  here. Check each link opens.

Inline HTML allowed in text: `<b>`, `<i>`, `<a>` and `<sub>`. Link other
lessons as `<a href="/learn/<slug>">` and RetCalc tools as `<a href="/<slug>">`.
No other tags, classes or inline styles.

## Pictures

Every lesson has at least one picture; most have two or three.

- **Tables** (`<figure><table>`): worked examples, comparisons, rules by
  age or income. Put `class="neg"` on a cell with a loss or negative figure.
- **Charts** (`<figure data-chart='...'>`): a line, bar or area chart from
  your data, as JSON:
  - `type`: "line", "area" or "bar" (bars are grouped by series).
  - `x`: the x values (numbers or short labels); `xLabel`: what x is
    ("Age", "Year", "Years invested"); `xFormat`: "money" or "pct" to
    write numeric x values as $150K or 4% (keep them numbers, so marks
    and spacing work).
  - `y`: "money", "pct" (values as 0.04 for 4%) or "num".
  - `series`: up to four, each `{"name", "values", "tone"}`; tone is "good",
    "bad", "accent", "neutral" or "muted"; `"dash": true` for a dotted line, `"step": true` for a value that
    holds until the next point and then jumps (tax brackets).
  - Optional `marks`: `[{"x": 62, "label": "Retire at 62"}]`, vertical lines;
    `band`: `{"from": 57, "to": 72, "label": "Most exposed"}`, a shaded span.
  - Keep JSON inside single quotes; no apostrophes inside it (write
    "Today" not "Today's").
- **Widgets**: a few lessons have an interactive picture built for them
  (`<figure data-widget="...">`): `sequence` (sequence-risk), `compound`
  (compound-growth), `fees` (fees-and-index-funds), `claim-age`
  (when-to-claim). Use the one your lesson has, with a caption.

Before every table or chart, an HTML comment says how its figures were
worked out: the formula, the engine function and inputs, or the source.

## Your numbers

Lessons with a Your numbers panel show it beside the text, built from the
reader's plan (or a sample household, Sam and Jordan with their daughter
Nora, when they have none). If your lesson has one (`YOURS` in `lib/learn/catalog.ts` lists them),
place `<p data-yours></p>` once, right after the passage it applies to; it
becomes one sentence applying the lesson to the reader's own plan. Don't
write the figures yourself. Lessons without a key have no `data-yours`.

## Getting the facts right

This is the part that matters most. A wrong figure in a lesson is worse
than no lesson.

- **Current rules and limits** come from the site's own figures, so lessons
  and tools agree: `lib/engine/data/2026.js` (tax brackets, standard
  deduction, contribution limits, IRA phase-outs, Social Security wage
  base and bend points, Medicare premiums and IRMAA tiers, ACA figures,
  state taxes), `lib/engine/data/tables.js` (RMD tables, mortgage rate),
  `lib/engine/math.js` (RMD start ages). Name the year ("for 2026").
- **Market history** comes from the site's data and engine
  (`lib/engine/data/history.js`, CAPE_NOW is today's CAPE) or from the
  tool articles in `content/articles/`, whose figures the engine produced.
  Which years a tool covers (since 1871, since 1926) differs by tool: check
  the tool's article before saying.
- **Anything else** (research findings, laws, program rules, history):
  check it against a primary or trusted source on the web before writing
  it, and list that source in `deeper` when the text leans on it. If you
  can't confirm something, leave it out or say less.
- You can run the engine: `node` is at `~/.local/node/bin/node`; the engine
  is `lib/engine/index.js` (ES modules). Compute chart data rather than
  inventing it. Simple arithmetic is fine too; show it in the comment.
- No made-up statistics, quotes or examples presented as real. Worked
  examples are clearly hypothetical.

## Copy rules

- "per year" and "per month", never "a year" or "a month" ("$40,000 per
  year"). Two figures on one table must not read alike.
- Name what a figure is; never refer to the site's internals ("the Guide's
  costs", "the full RetCalc tool"). Tools are named by their page names:
  the Calculator, the Backtest, the Drawdown Simulator, the Social Security
  Calculator, Income Tax, Healthcare, Roth Conversions, the Bridge, FIRE,
  Mortgage, Rent vs. Buy, College Savings, Budget (Paycheck), Debt Payoff,
  Withdrawal Order (Optimizer).
- Sample people are Sam, Jordan and Nora, or other made-up names. Never
  Erik or Peyton.
- Sentence-case headings. No em dashes; en dashes only in number ranges
  (1973–74, ages 62–70). "−" (minus) for negative numbers. Numbers: $1,480,000
  or $1.48 million; percentages as 4%.
- Not advice: explain how things work and what the trade-offs are; don't
  tell a reader what they personally should buy.

## The humanizer

After the draft is complete and checked, run the humanizer skill on it
(file mode: prose only, keep the HTML, attributes, JSON and comments
exactly). The rules above win where they differ (keep "per year"; number
ranges keep their en dash). Then check again that no figure, name, date or
claim was dropped or changed.

## RetCalc pages for Try it and links

`calculator`, `advanced`, `stages`, `guide`, `backtest`, `drawdown`,
`4-percent-rule`, `guardrails`, `vpw`, `ratcheting-withdrawal`,
`risk-based-guardrails`, `vanguard-dynamic-spending`, `rmd-withdrawal-strategy`,
`cape-withdrawal`, `optimizer`, `roth`, `rmd`, `bridge`, `72t`, `fire`,
`healthcare`, `social-security`, `incometax`, `budget`, `mortgage`,
`rentbuy`, `college`, `debt`, `compare`.
