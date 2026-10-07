/* Lesson 1's figure: the two clocks on one line, from today to the end of
   the plan. The saving years, then the years the savings pay for, with the
   ages the law fixes marked over them. Drawn in HTML, so its words stay
   sharp at any width; labels alternate above and below so close ages
   (62, 65, 67) never collide. */

const LAW = [
  { age: 59.5, label: "59½" }, { age: 62, label: "62" }, { age: 65, label: "65" },
  { age: 67, label: "67" }, { age: 70, label: "70" }, { age: 75, label: "75" },
];
const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.5$/, "½"));

export function Timeline({ age, retire, end }: { age: number; retire: number; end: number }) {
  const x0 = Math.floor(age), x1 = Math.max(end, retire + 1);
  const pct = (v: number) => (((Math.min(x1, Math.max(x0, v)) - x0) / Math.max(1, x1 - x0)) * 100).toFixed(2);
  const save = retire - age, fund = x1 - retire;
  const marks = LAW.filter((m) => m.age > x0 && m.age < x1);
  return (
    <div className="gd-tl" role="img" aria-label={`Saving from ${fmt(age)} to ${fmt(retire)}, ${fmt(save)} years; then the savings pay for ${fmt(fund)} years, to ${fmt(x1)}. Marked: ${marks.map((m) => m.label).join(", ")}.`}>
      <div className="gd-tl-row" aria-hidden="true">{marks.map((m, i) => i % 2 ? null : <span key={m.label} className="gd-tl-lab" style={{ "--x": pct(m.age) } as React.CSSProperties}>{m.label}</span>)}</div>
      <div className="gd-tl-bar" aria-hidden="true">
        <span className="save" style={{ "--a": "0", "--b": pct(retire) } as React.CSSProperties}></span>
        <span className="fund" style={{ "--a": pct(retire), "--b": "100" } as React.CSSProperties}></span>
        {marks.map((m) => <i key={m.label} style={{ "--x": pct(m.age) } as React.CSSProperties}></i>)}
      </div>
      <div className="gd-tl-row" aria-hidden="true">{marks.map((m, i) => i % 2 ? <span key={m.label} className="gd-tl-lab" style={{ "--x": pct(m.age) } as React.CSSProperties}>{m.label}</span> : null)}</div>
      <div className="gd-tl-key" aria-hidden="true">
        <span><s className="save"></s>Saving, {fmt(age)} to {fmt(retire)}: {fmt(save)} {save === 1 ? "year" : "years"}</span>
        <span><s className="fund"></s>Paying for retirement, to {fmt(x1)}: {fmt(fund)} years</span>
      </div>
    </div>
  );
}
