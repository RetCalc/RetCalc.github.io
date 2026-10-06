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
