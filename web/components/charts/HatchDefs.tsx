/* SVG patterns for the hatched series (lib/hues.ts): the series color with
   diagonal stripes in the chart's surface color. One per hatched color in
   `colors`, ids prefixed so two charts on a page don't collide. */
import { baseColor, isHatched, svgPaint } from "@/lib/hues";

export function HatchDefs({ prefix, colors }: { prefix: string; colors: string[] }) {
  const list = [...new Set(colors.filter(isHatched))];
  if (!list.length) return null;
  return (
    <>
      {list.map((c) => (
        <pattern key={c} id={svgPaint(c, prefix).slice(5, -1)} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <rect width="6" height="6" fill={baseColor(c)} />
          <rect width="2.2" height="6" fill="var(--ds-surface)" fillOpacity="0.7" />
        </pattern>
      ))}
    </>
  );
}
