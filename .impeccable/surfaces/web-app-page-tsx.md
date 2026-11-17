---
version: 1
slug: "web-app-page-tsx"
primary_target: "web/app/page.tsx"
related_targets: []
---

Scope: the homepage at `/` (web/app/page.tsx). Visitor mode: Persuade. This brief covers the ground-up redesign on branch `homepage-v3` (2026-11-17), a preview the owner has not yet accepted; the live page is still the age timeline (mock F, seed 2d07a1a5). Owner's answers for this round: follows the light/dark switch; a mix of real Dashboard screens in 3D layers and drawn charts; the Nov 2 black-hero redesign was dropped as "just not better".

## Direction contract

THESIS: Scroll to age one household. The page pins a single chart of a whole life, 32 to 95, and the scroll is the age: the tools come forward at the ages you'd use them. It refuses the split hero over a row of equal feature cards.

OWN-WORLD: Clear Glass as the rest of the site (system sans, amber key figure, ground and surface tokens) in both themes. A deck of frosted panes in real perspective over an amber savings line that opens, at 65, into every retirement since 1926 in steel with the failures in red; a soft light behind the deck that goes gold, jade, steel with the life stage.

STORY: A visitor learns it is a free retirement toolkit, watches one plan lived from saving to RMDs with each tool named at its age, sees the Dashboard that keeps it together and is asked to open it, scans every tool, sees the record plans are tested on, and leaves through My Dashboard, the Calculator or the Guide.

FIRST VIEWPORT: Headline top left at up to 92px with the lede and three buttons (My Dashboard primary); right, the pane deck tilted in 3D with the Calculator in front; along the bottom 42%, the whole life drawn faint with the dot at 32 and a dot per tool on the age line.

FORM: Pinned age scrub (the dealt lead, third on the ordered list), seed key d194d95e, code-led. Signature interaction: scrolling advances the age; the line draws, the balance counts, panes hold the front then fly past. Raised from the declined deep-dive challenger: one axis rules everything, and the age line always shows where now is. Phones get their own composition: stacked scene, two iPhones, tool cards to swipe.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
