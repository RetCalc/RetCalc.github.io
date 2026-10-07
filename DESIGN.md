---
name: RetCalc
description: Know your number.
colors:
  graphite-ground: "#0E1116"
  graphite-surface: "#151A21"
  graphite-raised: "#1C222B"
  graphite-rule: "#2A313C"
  graphite-rule-strong: "#626E7D"
  graphite-text: "#E8EBF0"
  graphite-muted: "#9AA4B2"
  signal-amber: "#E3A93B"
  on-signal-amber: "#0E1116"
  gain: "#4CC38A"
  loss: "#F0716A"
  paper-ground: "#FAF9F6"
  paper-surface: "#FFFFFF"
  paper-raised: "#F3F1EC"
  paper-rule: "#E3E0D8"
  paper-rule-strong: "#818995"
  paper-text: "#17191C"
  paper-muted: "#5B636E"
  signal-amber-deep: "#9A6200"
  on-signal-amber-deep: "#FFFFFF"
  gain-deep: "#17704A"
  loss-deep: "#B02F29"
  series-sky: "#5AA9E6"
  series-sky-deep: "#2F7FC4"
  series-teal: "#46B9A6"
  series-teal-deep: "#1F8F7E"
  series-rose: "#E0749B"
  series-rose-deep: "#C2467A"
  series-lavender: "#9C8CE0"
  series-lavender-deep: "#7B68C9"
  series-gray: "#8A94A3"
  series-gray-deep: "#808A99"
  brand-gold: "#e9b872"
  brand-jade: "#4fbf95"
  brand-steel: "#7d9fd6"
  brand-gold-deep: "#B0813A"
  brand-jade-deep: "#219B73"
  brand-steel-deep: "#6A8BC1"
typography:
  display:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "35px"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\""
  headline:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "23px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  body:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"tnum\""
  label:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 500
    lineHeight: 1.4
  eyebrow:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.08em"
rounded:
  control: "10px"
  card: "14px"
  panel: "16px"
  pill: "999px"
spacing:
  field-gap: "13px"
  panel-y: "16px"
  panel-x: "18px"
  grid-gap: "20px"
  gutter-sm: "20px"
  gutter: "26px"
components:
  button-primary:
    backgroundColor: "{colors.signal-amber}"
    textColor: "{colors.on-signal-amber}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.graphite-text}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "36px"
  input:
    backgroundColor: "{colors.graphite-ground}"
    textColor: "{colors.graphite-text}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  panel:
    backgroundColor: "{colors.graphite-surface}"
    textColor: "{colors.graphite-text}"
    rounded: "{rounded.panel}"
    padding: "16px 18px"
  readout-key:
    textColor: "{colors.signal-amber}"
    typography: "{typography.display}"
  readout-secondary:
    textColor: "{colors.graphite-text}"
    typography: "{typography.display}"
  tab:
    textColor: "{colors.graphite-muted}"
    typography: "{typography.body}"
  tab-active:
    textColor: "{colors.graphite-text}"
    typography: "{typography.body}"
  table-header:
    backgroundColor: "{colors.graphite-surface}"
    textColor: "{colors.graphite-muted}"
    typography: "{typography.label}"
  table-cell:
    textColor: "{colors.graphite-text}"
    typography: "{typography.body-sm}"
  menu:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.graphite-text}"
    rounded: "{rounded.card}"
    padding: "6px"
  badge:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.graphite-text}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
---

<!-- TARGET SYSTEM. This file describes where the redesign is going, set by
     REDESIGN_BRIEF.md (colors, font, color rules are final there) and the
     structure the current code already has and the brief keeps. As of
     2026-10-06 the code still runs the previous system; a snapshot of it is
     in redesign-baseline/DESIGN.before.md (local, gitignored). Re-run
     /impeccable document once the shared pieces have landed. -->

# Design System: RetCalc

## Overview

**Creative North Star: "The Quiet Instrument"**

RetCalc is a precision instrument for one question: will the money last? The system's job is to make the reading unmistakable and then get out of the way. Graphite surfaces sit flat and close in tone, type is exact and unhurried, and a single amber signal marks the one thing on the screen you came for. Everything else (inputs, tables, the rest of the chart) is set in neutral ink so the signal has no competition.

The previous system already called itself "The Instrument", and that idea stays. What goes is the showmanship: indigo ground, glowing numerals, bevelled keys, lit edges, and gradient washes behind the page. The quiet version earns trust by restraint, the way a good annual report or an FT chart does. It is dense where the data is dense (year-by-year tables, simulation charts) and spare everywhere else. The first screen of every tool answers a quick question for a saver in their thirties; depth is one step away for the planner who wants to check the math.

Dark is the primary mode and is designed first. Light is derived from the same roles, not repainted: every Graphite token has a Paper counterpart that plays the same part.

**Key Characteristics:**
- One amber signal per view, on a graphite field.
- Flat, tonal depth: ground, surface, raised, separated by hairline rules. No shadows at rest.
- IBM Plex Sans throughout, tabular numerals on every figure.
- Controls that feel like firm keys: clear fills, real hit areas, a small press on click.
- Data-first layout: inputs in a sticky left column, computed results to the right, the key result at the top of the results.
- Small, playful motion around the numbers, never in them; the bow and arrow is the brand's moving sign.

## Colors

Graphite neutrals with a single Signal Amber accent, plus a fixed gain/loss pair and a restrained chart series set. All values are final per the brief; do not propose alternatives.

### Primary
- **Signal Amber** (dark) / **Signal Amber Deep** (light): the accent. It appears in exactly four places: the key result in the headline readout, the primary button, the active tab's indicator, and the "your plan" series in charts. Text set on an amber fill uses On Signal Amber (graphite ground in dark, white in light).

### Neutral (dark, primary mode)
- **Graphite Ground**: the page background, and the fill of input fields (one step below the panel they sit in, so a field reads as a place to type without any inset shadow).
- **Graphite Surface**: panels and cards, the sticky tab rail once pinned, table header cells.
- **Graphite Raised**: one step up from surface. Secondary buttons, menus, tooltips, dialogs, row hover, selected segment.
- **Graphite Rule**: borders on panels and cards, dividers, chart gridlines.
- **Graphite Rule Strong** (border-strong): the edge of anything that must be seen as a control: input fields, selects, the segmented switch's track, checkboxes and toggles. At least 3:1 against Surface, Raised and the input fill.
- **Graphite Text**: primary text and all figures that are not the key result.
- **Graphite Muted**: labels, hints, table column headers, axis labels, inactive tabs.

### Neutral (light, derived)
- **Paper Ground**, **Paper Surface**, **Paper Raised**, **Paper Rule**, **Paper Rule Strong**, **Paper Text**, **Paper Muted**: one-to-one counterparts of the Graphite roles above. A light-mode screen is the dark-mode screen with every Graphite token swapped for its Paper twin and every accent/semantic swapped for its Deep twin.

### Semantic
- **Gain** / **Gain Deep** and **Loss** / **Loss Deep**: money that grows or shrinks, a plan that lasts or runs out. Never on their own (see the Never Alone Rule).

### Chart series
- **Your plan** is always Signal Amber (Deep in light).
- **Sky** and **Teal** (each with a Deep variant for light) are the first comparison series.
- **Rose**, **Lavender** and **Gray** follow, each with a Deep variant for light mode (the dark values fall below 3:1 on Paper).
- Every series line clears 3:1 against Surface and Raised in its mode.
- **Bands** (percentile ranges, better/worse cases) are the series color at 15 to 25% opacity.

### Brand mark
- **Brand Gold**, **Brand Jade**, **Brand Steel**: the bow-and-arrow logo (`web/components/shell/Brandmark.tsx`). In dark mode it stays exactly as it is today: same shape, same three colors. It is a brand mark, not UI, so it is exempt from the palette and from the Four Places Rule. Don't redraw it, and don't use the brand colors anywhere else in the UI.
- **Brand Gold Deep**, **Brand Jade Deep**, **Brand Steel Deep**: the light-mode logo. Same shape, drawn in darker shades of the same three hues (same OKLCH hue and chroma, lower lightness) so each clears 3:1 on Paper Ground, Surface and Raised. The original colors measure 1.7 to 2.7:1 on paper.
- The jade glow behind the mark in the masthead and its drop shadow are presentation, not the mark; they follow the No Wash and Flat Rest rules like everything else.
- The same three colors also draw the bow-and-arrow brand motif's bow and arrow today; in the redesign the motif uses its own colors (see Brand Motif).

### Print and share
- The printed summary and the share image card use their own fixed palettes, separate from the screen theme. They are restyled in a separate, later pass; until then a theme change must never leak into them by accident.

### Named Rules
**The Four Places Rule.** Amber appears only on the key result, the primary button, the active tab, and "your plan" in charts. Not on links, headings, hover states, icons, focus rings, or decoration. If a fifth place seems to need it, it doesn't. Two exemptions, and only these: the brand mark keeps its own colors, and the brand motif's bullseye turns amber at the moment it is hit.

**The Never Alone Rule.** Color never carries meaning by itself. Gain and loss always pair with a sign or arrow glyph and a word or column header that says what it is ("Lasted", "Ran out", "Growth").

**The 4.5 Rule.** Every text/background pair, in both modes, including text on tinted pills and badges, clears 4.5:1. A contrast-check script covers every pair and runs before a page is called done. As checked on 2026-10-06, every plain pair passes (the tightest is Signal Amber Deep on Paper Raised, 4.51:1); semantic text on a semantic tint passes only at a 15% tint on Surface, which is why badges are specified that way. Non-text marks that carry meaning (control edges, chart lines, the logo) clear 3:1. `node scripts/contrast/contrast.mjs check` (from `web/`) checks every pair against the tokens in this file.

## Typography

**Body Font:** IBM Plex Sans (with system-ui, sans-serif), self-hosted through next/font.
**Numerals:** IBM Plex Sans with tabular figures (`font-variant-numeric: tabular-nums`). No monospace face; the previous system's IBM Plex Mono figures are retired.

**Character:** One family, set carefully. Plex Sans has the engineered, slightly technical feel of an instrument face while staying calm at reading sizes, and its tabular figures keep money columns aligned without the typewriter look of a mono.

### Hierarchy
- **Display** (500, 35px, 1.05): the headline readout figures only. Size carried over from the current readout; weight and tracking get a final check when the readout is rebuilt.
- **Headline** (600, 23px, 1.15): the tool's name in the tool header.
- **Title** (600, 14px, 1.35): panel and card headings ("Balance over time", "Year by year").
- **Body** (400, 15px, 1.5): default text, tabs, written explanations. Articles cap at about 78ch.
- **Body small** (400, 13px, 1.5): table cells, key/value rows, secondary text, field values.
- **Label** (500, 11.5px, 1.4): field hints, readout labels, table column headers, legend entries, axis labels.
- **Eyebrow** (600, 11px, 0.08em, uppercase): group headings in the tool picker and menus. The only uppercase text in the system.

The wordmark ("RetCalc", 700, 26px) and the tagline are brand elements, sized in the masthead pass.

### Named Rules
**The Tabular Rule.** Every number on screen is set with tabular numerals: readouts, tables, inputs, axis labels, tooltips, inline figures in sentences. A number that shifts width as it changes is a bug.

**The Sentence Case Rule.** Headings, buttons, labels and tabs are in sentence case. Uppercase is reserved for the small eyebrow group headings.

## Layout

The page is a centered column up to 1330px wide, with a page gutter of 26px (20px at 900px and below) that also respects the device's safe-area insets. The masthead, the tab rail and the content all align to that same gutter.

Tool pages use a two-column grid: a 340px input column on the left and a fluid results column on the right, 20px apart. The input column is sticky under the tab rail and scrolls on its own when it is taller than the viewport. Results stack vertically, 20px apart, starting with the headline readout. Pages without inputs (the tool picker, About) use a single centered column at a comfortable measure rather than stretching edge to edge.

Breakpoints: at 900px and below, the input column moves above the results and stops being sticky. At 640px and below, the phone layout takes over: menus become full-width sheets with thumb-sized rows, and the readout's figures stack.

Navigation is a sticky tab rail (Guide, Calculator, Tools, About) directly under the masthead. Calculator is a tab with a mode menu (Basic, Advanced, Stages). The other ~20 tools are reached from the Tools picker, grouped by the kind of question they answer, and each tool page carries a back link and a header with its icon, name and one-line description.

Dense tables live inside their own scroll container. On phones they scroll sideways within that container; the page itself never scrolls horizontally.

Spacing rhythm: 13px between fields, 16px by 18px inside panels, 20px between panels and grid columns.

## Elevation & Depth

The system is flat. Depth comes from three tonal steps (Ground, Surface, Raised) and 1px Rule borders, never from shadows, gradients, glows or inset bevels. A panel sits on the ground because it is one tone lighter and has a hairline edge; a menu sits above a panel because it is one more tone up and casts a shadow.

### Shadow Vocabulary
- **Float** (dark: `0 12px 32px -12px rgba(0,0,0,.6)`; light: `0 12px 32px -14px rgba(23,25,28,.18)`; starting values, tuned in the shared-pieces pass): menus, select lists, tooltips, toasts, dialogs and the pinned tab rail. Nothing else.
- **Float Up** (`--ds-float-up`; dark: `0 -12px 32px -12px rgba(0,0,0,.6)`; light: `0 -12px 32px -14px rgba(23,25,28,.18)`): the Float shadow cast upward, for the one bar fixed to the bottom of the screen, the installed web app's tab bar.

### Scrim
- **Scrim** (`--ds-scrim`; dark: Graphite Ground at 60%, `color-mix(in srgb, var(--ds-ground) 60%, transparent)`; light: Paper Text at 30%, `color-mix(in srgb, var(--ds-text) 30%, transparent)`): dims the page under a dialog, the phone Calculator menu and the phone select sheet. A flat tint, no blur. Light mode dims with the Text tone, since a Ground tint would lighten the page instead.

### Named Rules
**The Flat Rest Rule.** Surfaces are flat at rest. A shadow means "this is floating above the page and will go away". If it doesn't float, it doesn't get a shadow.

**The No Wash Rule.** No gradient washes, radial glows, glassmorphism, text glows or lit edges, on the page background or on any component.

## Shapes

Gently rounded, consistent by role. Controls (buttons, inputs, selects, segmented switches) use 10px. Cards inside a panel, menus, tooltips and toasts use 14px. Panels use 16px. Badges and pills are fully round. An element nested flush inside another takes the outer radius less the border so the curves run parallel. Borders are always 1px: Rule on panels, cards and dividers, Rule Strong on controls that need a visible boundary. There are no double borders, colored side stripes, or accent edges.

## Components

Firm and tactile: controls read as keys you press, with clear fills, real hit areas and a small physical response, but without bevels or glow.

### Buttons
- **Shape:** gently rounded (10px), 36px tall; 44px on coarse pointers.
- **Touch targets:** every control is at least 44px tall under a finger (`pointer: coarse`). Where a control has to stay small (a CSV button, a link in a sentence, a "?" dot), its hit area grows to 44px without moving anything.
- **Primary:** Signal Amber fill, On Signal Amber text, 600 weight. One per view at most; it is one of amber's four places.
- **Secondary:** Raised fill, Rule border, Text color. The default for every other action (Save, Share, CSV, Reset). In light mode the edge is Rule Strong: on white, a Raised fill inside a Rule edge read as disabled.
- **Ghost / quiet:** no fill or border; Muted text that turns Text color on hover. For footer links and in-sentence actions.
- **Hover:** fill shifts one small step (toward Text in dark, toward Ground in light); border shifts to Muted. No lift.
- **Active:** presses down 1px.
- **Focus:** 2px ring in Text color at 2px offset. Never amber.
- **Disabled:** 50% opacity, no pointer events.

### Inputs / Fields
- **Style:** Ground fill inside a Surface panel, 1px Rule Strong border, 10px radius, 36px tall. Values in tabular figures, right-aligned for money and percentages, with the unit ($, %) as a muted prefix or suffix inside the field.
- **Label:** above the field in Body, a hint below in Label/Muted.
- **Hover:** border to Muted. **Focus:** border to Text plus the 2px focus ring.
- **Selects** share the field's style, with a Muted chevron.
- **Error:** Loss border and a written message under the field, with an icon.

### Segmented switch
- A Ground track with a Rule Strong edge and a Raised thumb that slides to the selected option. Selected text in Text color; others Muted. Used for view switches (Selected year / All years, chart modes).

### Cards / Panels
- **Corner Style:** 16px for panels, 14px for cards inside them.
- **Background:** Surface; nested cards and callouts use Raised.
- **Shadow Strategy:** none (Flat Rest Rule).
- **Border:** 1px Rule.
- **Internal Padding:** 16px by 18px. A panel's title row sits on a Rule divider.

### Headline readout (signature)
The key result, and the reason the page exists. It opens the results column as the top band of the first panel: up to three figures side by side on desktop, stacked on phones, each with a Label above and a short Muted note below. Exactly one figure, the answer to the tool's question, is Signal Amber; the others are Text. Figures are Display size, tabular, never wrapped. Flat: no glass, glow, or gradient, just the Surface tone and a Rule divider beneath.

**Hero reading (variant).** Where a page's main result clearly dominates (the homepage's value at retirement, a tool whose one question has one answer), the readout is a single reading instead of peers: the main figure alone at about twice Display size (58px on desktop, 44px on phones, stepping down as the figure gets longer, through `BigValue`'s `scale`), with its Label above and note below, and the secondary figures at Display size (35px; 30px on phones), in Text, each with its note. From 1100px wide the top of the reading is two zones: the main figure, its Label and note on the left; behind a 1px Rule, the secondary figures side by side, centered across the rest of the width and vertically against the main figure (they wrap under each other only if a long figure leaves no room). Below 1100px the secondary figures sit under the main figure, side by side, behind a Rule above. The main figure is Signal Amber when it is the page's answer; when it is a rating it takes the rating's color (Gain, Loss, or Text for the middle band), as the three-figure readout does. Where results are genuinely equal (three figures that each answer a different question), keep the three-figure readout. On screens narrower than 1024px a compact copy of the reading (the main figure and one secondary) leads the inputs and stays pinned under the tab rail while they are in view. Optionally, a thin composition bar under the reading shows what a total is made of (Rule Strong, Muted, and Gain only for real growth), with a matching swatch on each part's label. Built as `HeroReading`, `PinnedReading` and `CompositionBar` in `web/components/common/Reading.tsx`; the homepage was the first to use it.

### Tables
- Column headers in Label/Muted on Surface, sticky at the top of their scroll container.
- Cells in Body small, tabular; numbers right-aligned, the first column left-aligned.
- Rows divided by Rule; hover fills the row with Raised.
- Gain/loss cells use the semantic colors with a sign, under a header that names them.
- On phones the table scrolls sideways inside its own container, with its first column pinned. Where the last column is the answer (the homepage's Balance), it's pinned too, and a column that repeats another (Year beside Age) steps out on phones; the CSV keeps every column.

### Charts
- Plan line in Signal Amber, ending in the logo's arrowhead. Comparison series in Sky, Teal, then Rose, Lavender, Gray. Ranges as bands at 15 to 25% opacity of their series.
- Gridlines in Rule; axis labels in Label/Muted, tabular.
- Legend below the chart: swatch plus text. Toggleable entries fade and strike through when off.
- Tooltips: Raised fill, Rule border, 14px radius, Float shadow, tabular figures.

### Navigation
- **Tab rail:** sticky under the masthead, transparent until pinned, then Surface with a Rule bottom edge and the Float shadow. Tabs in Body, Muted at rest, Text on hover and when selected.
- **Active tab:** marked by the logo's arrow under its name in Signal Amber, which slides in from the left (within the Motion timings); a faint Muted arrow previews it on hover.
- **Calculator tab:** the open mode reads as the second half of the tab's name, "Calculator | Basic": regular weight at 13px behind a hairline, Muted, not a small bold word beside it.
- **Masthead controls in the pinned rail (desktop):** once the rail is pinned and the masthead has scrolled away, the scenario picker, Save/Share/Reset and the household and theme buttons ride in the rail's empty right side, centered on it, with a short fade; scrolling back up returns them to the masthead. From 1024px wide; phones keep them in the masthead. They are the masthead's own controls held in place, not copies. Tried on the homepage first (2026-10-06), then applied to every page.
- **Calculator mode menu:** drops from the tab on desktop (Raised, 14px, Float); on phones it is a full-width sheet with 58px rows over a dimmed page. The current mode gets a check mark and Text weight, not amber.
- **Tool picker:** a visible "Tools" header (Headline, one Muted line), then cards grouped under Eyebrow headings, two columns from 900px across the full content width; cards in a row share one height, and a group's odd last card spans the row. Each card has a top row of icon tile (42px; 36px on phones), name (600, 15px) and the logo's arrow at the right, which steps forward on hover and focus; the tool's short description (the same text as its header) runs the card's full width below, one or two lines on desktop. Each picker icon acts out its tool in a short animation; they stay (see Motion).

### Badges
- Pill shape, Label type, with a glyph and a word (never color alone).
- **Neutral:** Raised fill, Text color.
- **Semantic:** a 15% tint of Gain or Loss over Surface, with the semantic color as the text. Stronger tints, or the same tint on Raised, drop below 4.5:1 in one mode or the other; on Raised, use the neutral badge with a semantic glyph instead.
- Never amber unless the badge is the key result.

## Motion

The site should feel alive in small ways: a tool icon that acts out what it does, a tab marker that slides, a key that gives under the finger. Motion is a moment of play around the numbers, never in them.

### Rules
- **Timing:** 150 to 250ms per animation, staggered parts included, easing `cubic-bezier(.2,.7,.3,1)`. The brand motif has its own timings (see Brand Motif).
- **Properties:** transform and opacity only. No animating width, height, left/top, margins, or stroke drawing; nothing that shifts layout.
- **Never in the way:** an animation never blocks or delays interaction. Content is clickable and readable the moment it appears; nothing waits for an animation to finish. The one exception is the Plan Optimizer's minimum flight, which is deliberate and can always be skipped (see Brand Motif).
- **No endless loops,** except loading states.
- **Every input gets it:** an animation that plays on hover also plays on keyboard focus (`:focus-visible`) and on tap. Nothing is hover-only.
- **Reduced motion:** under `prefers-reduced-motion: reduce`, every animation becomes a plain color or border change (for a tool card: the icon tile's border turns Muted and the name turns Text). Nothing moves.
- **Numbers stay still,** with one exception: table cells, totals, inline figures and chart values update in place, with no counting up, rolling digits or tweened values. A chart may fade in once when it first appears; it never animates a change in its data. The exception is the headline readout's count (below), which stays as it is.

### The headline count (kept as is)
The large figures in the headline readouts count from their old value to the new one when an input changes. It is `BigValue` (`web/components/common/BigValue.tsx`), used through `Readout` by every tool's headline and by Advanced, Stages, Backtest, Fire and Drawdown directly. How it works today, to be kept exactly:
- The new text is written first, then a `requestAnimationFrame` loop counts over 240ms with a cubic ease-out (`1 - (1 - k)^3`), so an interrupted count never leaves an old figure on screen.
- The count matches the number inside the text (`$`, commas and decimals kept to the new value's format, and any suffix such as " years" carried along), and only runs when the old and new text share the same prefix.
- It does nothing on the first render, when the value is unchanged, when the figure is hidden, or under `prefers-reduced-motion: reduce`, where the new value simply appears.
- Separately, its type steps down as the text gets longer (29px for up to 11 characters, then 26, 23, 20, 17 and 15px), so a long result fits its column.

### Where motion is welcome
- Tab switches: the amber arrow sliding under the new tab, and the incoming pane rising a few pixels as it fades in.
- Button press: the 1px press-down.
- Panels opening and closing (About cards, "show the math" details, menus and sheets), and the segmented switch's thumb.
- Page transitions: the pane enter animations and the tool icon gliding from the picker card into the tool header.
- Toasts arriving and leaving.
- The tool-picker icons.

### Where it isn't
- Figures of any kind (tables, chart values, totals), other than the headline count above.
- Inputs while someone is typing, and validation (no shaking fields).
- Table rows and list items arriving on every update.
- Scroll-linked effects, parallax, ambient or background motion.
- Anything that moves to attract attention.

### Tool-picker icons
**One style for all of them: "one beat, acting out the verb".** On hover, focus or tap, one part of the icon (never the whole tile) performs the tool's verb in a single small gesture and settles back to rest: at most about 3px of travel, 10° of rotation, or 10% of scale, eased out, finished inside 250ms including any stagger. The tile itself only changes its border color. The arrow at the right of the card steps forward a few pixels at the same time.

As built: the beats live in `web/styles/04-tool-icons-header.css` (the class on each SVG part, in `web/components/tools/ToolIcon.tsx`, picks the part that moves). Every beat is a single out-and-back transform keyframe peaking at 40%, eased `cubic-bezier(.2,.7,.3,1)` and played once, so nothing loops. It plays on real hover (`@media (hover:hover)`, so a phone tap never leaves a card lit), on `:focus-visible`, and on tap: a touch or pen `pointerdown` gives the card `.is-beat` for 260ms (`ToolCardLink.tsx`). The card's edge and fill step up a tone, the tile's edge turns Rule Strong, and the arrow turns Text and steps 7px forward. Nothing lifts, scales or glows. Only cards play it (the /tools picker and the 404 page's four cards); the tool header's tile stays still. Under reduced motion nothing moves: the tile's edge turns Muted, the arrow turns Text in place, and the name is Text as always. The card keeps its separate press acknowledgement (`.toolcard:active`, scale .988, off under reduced motion).

| Tool | The beat | Duration |
|---|---|---|
| Plan Optimizer | The arrow draws back 2.5px and looses into the target | 240ms |
| Drawdown | The projection line and its two points dip 2.5px and recover | 240ms |
| Income Tax | The magnifier passes 3px over the return | 240ms |
| Roth | The arrowhead pushes 2px down into the Roth bucket | 240ms |
| Mortgage | The roof lifts 3px | 240ms |
| College | The cap and tassel hop 3px | 240ms |
| Rent vs. Buy | The beam tips 8° and levels | 240ms |
| Budget | The coin is tossed 3px, turning (scaleX .9) | 240ms |
| Debt Payoff | The four balances are knocked down 10%, biggest first | 180ms + 60ms stagger |
| Backtest | The three bars grow 10% from the axis, left to right | 180ms + 60ms stagger |
| Healthcare | The cross gives one heartbeat (scale 1.1); was a full spin | 240ms |
| Bridge | The arch and its cables spring up 10% from the deck; was a stroke-drawn arch and a walking dot | 240ms |
| FIRE | The flame flares once (scaleY 1.1 from its base); was an endless flicker | 240ms |

The old stroke drawing (Drawdown, Roth, Bridge), the fine-pointer-only gate and the endless FIRE flicker are gone. The icon SVG has `overflow: visible` so a beat that reaches past the 40-unit drawing (the flame's tip) isn't clipped.

## Brand Motif

The bow and arrow is RetCalc's own sign: the logo is a bow with an arrow nocked, and the same drawing comes alive in two places. These are brand elements and they stay. They are not gamification: there are no points, badges, streaks or confetti, only an arrow showing how far along you are.

### Rules
- **Real progress.** On the Guide, the arrow's position reflects real progress through the steps, alongside a visible step label ("Step 3 of 8"). The bar is exposed as `role="progressbar"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow` and an `aria-valuetext` that matches the step label.
- **The Optimizer's minimum flight is intentional.** Every run shows a full shot, lasting at least 5 seconds, even when the search finishes sooner. It signals that the calculation is doing real work. Around that minimum:
  - **Skippable:** a tap or click on the loader, Enter, or Escape skips to the results at any time. If the search has finished, they show at once; if not, they show the moment it does. The Stop button still cancels the search.
  - **Reduced motion:** under `prefers-reduced-motion`, there is no flight. The results show as soon as the search finishes.
  - **No extra hold:** if the real search takes longer than the minimum, the arrow lands when it finishes, and only the target-hit moment (about 400ms) comes between landing and results. Nothing else is added.
  - **Shorter after the first run:** after the first run in a session, the minimum drops to about 2 seconds.
  - **Real progress:** the arrow follows the real search within the minimum. It loops only when real progress isn't available, and the final shot lands as the results appear.
- **A quick hit.** The target-hit moment (impact, the target's reaction, the arrow settling) is over in under 400ms, on both the Guide and the Optimizer.
- **Phones.** The motif scales down cleanly: smaller bow, arrow and target, nothing clipped, the track still readable.
- **Reduced motion.** `prefers-reduced-motion` removes the flight and the bounce: the arrow simply jumps to its position, and the target changes color on hit.
- **Colors.** Bow and arrow in Text; the track in Rule; the target's rings in Muted; the bullseye in Signal Amber at the moment it is hit (the one approved exception to the Four Places Rule).

### Guide progress bar (today)
- **Where:** the `Top` component in `web/tools/guide/Guide.tsx`; styles in `web/styles/12-guide.css` (`.gd-prog-wrap`, `.gd-track`, `.gd-bow`, `.gd-arrow`, `.gd-goal`, `.gd-seg`).
- **How it's built:** inline SVGs (the bow's limb and two string paths, one at rest and one drawn back; the logo's arrow; a target of two rings and a bullseye) laid over six chapter segments, each a button with a fill bar. One set of measures on `.gd-prog-wrap` places everything: `--gap` between the bars, `--tail` (room for the target) and `--goal` (the target's centre past the track's end). The track spans the bars only and is a size container, so the arrow's tip sits at `(100cqw - 5 gaps) / 6 × position + chapters passed × gap`, exactly where the fill of the chapter it's in ends; measured to within 1px at 320, 390, 768, 1024 and 1440. The arrow moves with `transform: translateX()` and each fill grows with `transform: scaleX()`, both over 520ms in `cubic-bezier(.2,.7,.3,1)`. Transitions switch on (`.ready`) only after the saved progress is drawn, so loading the page just places the arrow.
- **Flight and hit:** a move forward adds `.fly` for the length of the flight: a small arc (3px rise, 4° tip, transform only), and on the first release the string twangs once (300ms, translateX). A fresh finish holds the bullseye in Muted (`.inflight`) until the arrow's transition ends, then `.impact`: the bullseye turns amber, the target gives once (scale 1.12, 240ms) and the arrow shivers where it stuck (280ms). Timed in the page: impact to last animation end 283ms. No delay, streak or burst ring.
- **Progress:** real. The arrow's position comes from completed steps per chapter (the furthest chapter with any step done). The track is `role="progressbar"` ("Guide progress") with `aria-valuemin` 0, `aria-valuemax` the number of steps, `aria-valuenow` the current step and `aria-valuetext` the same "Step N of M" shown in the header ("Not started" on the intro, where the header shows no count). The chapter buttons keep their labels ("Cash flow: 2 of 4 done") and are reached by Tab.
- **Colors:** bow and arrow in Text, the bars in Rule with a Muted fill, the target's rings in Muted. The bullseye turns Signal Amber on the hit and stays amber while the guide is finished (that is the hit state; a page loaded already finished shows it amber).
- **Phones:** at 640px and below the bow scales to 75%, the arrow shrinks to 38px, the target to 15px and its tail room to 26px, and the chapter names hide. Nothing clips at 320px and the page never scrolls sideways.
- **Reduced motion:** no transitions or keyframes and no scripted states: the arrow and fills jump, and the bullseye changes colour in the same frame.
- **Rough edges:** the arrow's position and the step label measure different things (completed steps vs. the step you're on), as the Rules ask; going back a step moves the label but not the arrow. On the hit the arrowhead sits over the target's rings, as the logo's arrow did before.

### Plan Optimizer loading bar (today)
- **Where:** `web/tools/optimizer/Progress.tsx` (the animation loop, the skip, the announcements), `web/tools/optimizer/run.ts` (pacing, worker messages, `skipFlight`), styles in `web/styles/15-optimizer.css` (`.op-run`, `.op-shot`, `.op-bow`, `.op-lane`, `.op-fill`, `.op-arrow`, `.op-target`). Used on /optimizer and in the Guide's Optimizer step.
- **How it's built:** the Guide's bow, arrow and target, larger, laid out the Guide's way. One set of measures on `.op-run` places everything (`--bw` bow, `--gap`, `--al`/`--ah` arrow, `--ts` target, `--nock` where the tip rests on the string, `--draw` how far the string comes back). The lane is a size container, so the arrow's tip sits at `--nock + p × (lane − --nock)` and the fill (Muted, in a clipped Rule track) ends exactly under it. A `requestAnimationFrame` loop sets only two custom properties, `--p` (how far it has flown) and `--pull` (the draw); the arrow moves with `translateX`, the fill with `translateX` inside its clip, and the drawn string bends with `scaleX` (no path rewriting, no `left`/`width`). The string draws back over 700ms and holds 260ms; at the release the straight string twangs once (300ms) and the bow kicks (240ms).
- **Pacing:** the first shot in a session lasts at least 5 seconds (`OP_MIN_MS`); every later one about 2 seconds (`OP_MIN_AGAIN_MS`), with the draw and hold scaled to 60%. "Session" is the tab's session storage (`rc-op-shot`, set when a result is shown), so a reload keeps it; where storage is blocked, a module flag. The minimum is display pacing only: the search runs at its own speed and its result is the same. Timed in the page with a quick search: landing at 4,992ms on the first run, 2,022ms on the second.
- **Progress:** real. The arrow follows the worker's real fraction, held back only by the minimum's clock; with no progress yet it simply waits at the string, with no bob or shake. If the search outlasts the minimum, the arrow lands when it finishes. The counters ("plans tried", "retirements simulated", "best so far") follow the arrow and show the engine's real values; "best so far" is Text.
- **The hit:** at the end of the lane the arrow strikes into the bullseye (100ms), then the bullseye turns amber, the target gives once (scale 1.12, 240ms) and the arrow shivers where it stuck (240ms); the answer replaces the bar at once. Timed in the page: landing to answer 376 to 386ms. No glow, gradient, trail or burst ring. The answer's reveal is a 180ms rise with a stagger of up to 70ms (250ms in all) and is readable and clickable from the first frame.
- **Skip:** a click or tap anywhere on the loader (except Stop), Enter on the loader, or Escape anywhere in it skips: the answer shows at once if the search is done, or the moment it is. Starting a run moves focus to the loader (it is `tabIndex=0`, a group named "Plan Optimizer search", described by "Press Enter or Escape to skip"), so a keyboard user can skip straight away; if focus falls to the page, Enter or Escape still skip. A quiet line under the commentary says "Click or press Enter to skip ahead" ("Tap to skip ahead" on touch screens). Stop still cancels and discards the search. If the page isn't being watched (the loader unmounted), the answer is shown when it's in.
- **Accessibility:** the drawing is `role="progressbar"` ("Search progress", 0 to 100, `aria-valuenow` and "N% searched" updated per whole percent). The block is not a live region; a separate polite status beside it says "Searching every plan." at the start and "Found the best plan. The answer is below." at the end.
- **Colors:** bow and arrow in Text, the track in Rule with a Muted fill, the target's rings in Muted, the bullseye Signal Amber from the impact.
- **Phones:** below 560px the measures shrink (bow 30px, arrow 70px, target 40px, gap 8px) and the counters drop to 15px. Nothing clips at 320px or 390px and the page never scrolls sideways.
- **Reduced motion:** no minimum, no draw and no flight: the answer shows as soon as the search is done (measured 18 to 26ms after). While it runs, the arrow jumps in tenths of the real progress, and no keyframe or transition plays. The skip line and the loader's focus stop are left out, as there is nothing to skip.
- **Rough edges:** the estimate beside the run button ("about N seconds") still has the 5-second minimum as its floor on later runs; it's a shown figure, so it was left as is. On the hit the arrowhead sits over the target's rings, as on the Guide.

## Do's and Don'ts

### Do:
- **Do** put the key result at the top of the results column, in Display size, as the only amber figure on the screen.
- **Do** set every number with tabular numerals in IBM Plex Sans.
- **Do** separate surfaces with tone (Ground, Surface, Raised) and 1px Rule borders.
- **Do** derive every light-mode color from its dark-mode role (Graphite to Paper, accent to Deep).
- **Do** pair gain and loss colors with a sign or icon and a label.
- **Do** keep tables in their own scroll container so phones scroll the table, not the page.
- **Do** check every text/background pair for 4.5:1 in both modes with the contrast script.
- **Do** keep the bow-and-arrow brand motif on the Guide and the Plan Optimizer, driven by real progress.
- **Do** give every tool-picker icon one short beat of motion on hover, focus and tap, with a color-only fallback under reduced motion.

### Don't:
- **Don't** use amber outside its four places: key result, primary button, active tab, your plan.
- **Don't** use gradient washes, radial glows, glassmorphism, text glows, lit edges or bevelled keys.
- **Don't** put shadows on anything that doesn't float.
- **Don't** use hype, gamification (points, badges, streaks, confetti), money emoji, or stock photos of retirees. The bow-and-arrow brand motif is not gamification.
- **Don't** animate figures (no counting up, rolling digits or tweened values) other than the headline readout's existing count.
- **Don't** redraw, recolor or restyle the brand mark.
- **Don't** lay out three identical feature cards or center everything.
- **Don't** bring back the previous system's indigo ground, jade and gold UI accents (the brand mark keeps its own colors), Instrument Sans, or monospace figures.
- **Don't** let the print summary or share card inherit the screen theme by accident.
