/* Chart data writes the four data hues as the dark theme's hex. Where one of
   them colors a swatch, a bar or a label, this hands back the theme variable
   instead, so it deepens on the light theme like the charts do (see
   styles/13-chart-ink-logo.css). Any other color passes through. */
const THEMED: Record<string, string> = {
  "#e9b872": "var(--gold)",
  "#4fbf95": "var(--jade)",
  "#7d9fd6": "var(--steel)",
  "#e2795f": "var(--coral)",
};

export const themed = (color: string): string => THEMED[color.toLowerCase()] ?? color;
