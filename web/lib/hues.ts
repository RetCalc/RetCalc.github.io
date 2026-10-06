/* Every chart's colors, in one place. Each is a design-system token as a CSS
   variable (app/globals.css), so a chart drawn under one theme follows the
   other without being redrawn, and the light theme's deeper hues apply on
   their own. DESIGN.md, Colors > Chart series:
   - plan: the visitor's own plan or setting, and only that (amber);
   - sky, teal, rose, lavender, gray: everything else, in that order;
   - gain and loss: only for series that are a gain or a loss, or a
     plan lasting or running out;
   - guide: reference lines and their labels (a target, a comfort line).
   Bands are a series color at low opacity. Charts never rely on color
   alone: every series also has a legend entry, a direct label or a marker.
   The share card and print summary map these same names to their own fixed
   colors (components/shell/share.ts). */
export const SERIES = {
  plan: "var(--ds-series-plan)",
  sky: "var(--ds-series-sky)",
  teal: "var(--ds-series-teal)",
  rose: "var(--ds-series-rose)",
  lavender: "var(--ds-series-lavender)",
  gray: "var(--ds-series-gray)",
  gain: "var(--ds-gain)",
  loss: "var(--ds-loss)",
  guide: "var(--ds-muted)",
} as const;

/** The inner (25th to 75th) band of a fan, as its legend and tooltip show it. */
export const BAND_INNER = "color-mix(in srgb, var(--ds-series-teal) 55%, transparent)";

/* A hatched variant of a series: the same color with stripes, for a chart
   with more categories than series (a second shade of a family: Roth
   ladder rungs beside Roth contributions, say). The stripes are the
   non-color cue, so the two never rely on hue alone. Written
   "hatch:<color>"; HTML swatches and bars take the `hatch` class and the
   base color (hatchClass, baseColor), SVG shapes paint with a pattern (HatchDefs). */
export const hatched = (color: string) => `hatch:${color}`;
export const isHatched = (c: string) => c.startsWith("hatch:");
export const baseColor = (c: string) => (isHatched(c) ? c.slice(6) : c);

/** The class an HTML swatch or bar adds when `c` is hatched. */
export const hatchClass = (c: string) => (isHatched(c) ? " hatch" : "");

/** The SVG paint for `c` within a chart whose patterns were declared by
    <HatchDefs> under `prefix`. */
export const svgPaint = (c: string, prefix: string) =>
  isHatched(c) ? `url(#${prefix}-${baseColor(c).replace(/[^a-z0-9]/gi, "")})` : c;
