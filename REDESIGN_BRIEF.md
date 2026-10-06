# RetCalc redesign brief

## Product
RetCalc (retcalc.app): a free, privacy-first retirement and financial
planning suite built around a compound interest calculator, with ~20
connected tools. Everything runs in the browser. No logins, no database,
no payments. Tagline: "Know your number."

## Audience
1. DIY savers aged 25-45 who want a quick answer (Basic tab, Guide).
2. Advanced self-directed planners (FIRE, Bogleheads-style) who use
   Drawdown, Optimizer, and Roth tools and want rigor.
Design for both: simple on first screen, depth on demand.

## Tone
Precise, calm, trustworthy, numbers-first. A serious instrument, not a
fintech app. Never: hype, gamification, confetti, stock photos of
retirees, money emoji, gradient washes, glassmorphism, three identical
feature cards, centered-everything layouts.

## References
ProjectionLab (category), Stripe or Linear (restraint, typography),
FT or Observable (chart clarity).

## Design priorities
1. The key result on every tool is unmistakable.
2. Dense tables and charts are easy to read, including on phones
   (tables scroll sideways inside their own container).
3. Navigating 20+ tools is obvious.
4. Dark and light both polished.

## Color tokens (final; do not propose alternatives)
Dark (primary)
- bg #0E1116, surface #151A21, raised #1C222B, border #2A313C
- text #E8EBF0, muted #9AA4B2
- accent #E3A93B (text on accent #0E1116)
- gain #4CC38A, loss #F0716A
Light (derived from dark)
- bg #FAF9F6, surface #FFFFFF, raised #F3F1EC, border #E3E0D8
- text #17191C, muted #5B636E
- accent #9A6200 (text on accent #FFFFFF)
- gain #17704A, loss #B02F29
Chart series (dark / light)
- plan = accent
- sky #5AA9E6 / #2F7FC4, teal #46B9A6 / #1F8F7E
- rose #E0749B, lavender #9C8CE0, gray #8A94A3
- bands = series color at 15-25% opacity

## Color rules
- Dark first; light derived from the same tokens.
- Accent only on: the key result, the primary button, the active tab,
  and "your plan" in charts.
- Never use color alone for meaning. Pair gain/loss with an icon and a
  label.
- Text 4.5:1 contrast minimum in both modes, including text on tinted
  pills. Write a contrast-check script for every text/background pair
  and fix failures.
- Tabular numerals on every number.
- Font: start with IBM Plex Sans; propose a better one only if it
  clearly helps.

## Decisions already made
- Palette: graphite neutrals with a single amber accent (chosen over a
  blue alternative).
- Work happens on the redesign branch, one page at a time, shared pieces
  first (tokens, type, nav, footer), then the homepage.
- Review each page with screenshots (desktop and phone, both themes)
  before moving on.

## Must keep (restyle only, don't rebuild)
- The RetCalc name, tagline, disclaimers, and the "nothing leaves your
  browser" statement.
- All existing URLs and routes.
- The existing System / Dark / Light toggle and its behavior.
- Household bar, saved scenarios, Compare, Share (link, summary, image
  card), print summary, CSV export, and the Guide's step flow.
- Load fonts with next/font (self-hosted, no layout shift); add no heavy
  new JS or images.
- Print summary and share image card colors are separate from the screen
  theme; handle them deliberately, not by accident.

## Hard constraint
Change only styling, layout, and markup. Do not modify any calculation,
tax, simulation, or data files, any formulas, or any numbers shown. The
baseline check (node scripts/baseline/numbers.mjs check, from web/) must
pass after every batch of changes; any difference means stop and fix.
