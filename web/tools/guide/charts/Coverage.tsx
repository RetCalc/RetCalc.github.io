/* Lesson 14's figure: where a typical year's income comes from, savings at
   4%, Social Security and a pension, against what the year costs with its
   tax. Each part named with its dollars, and the need line in words. */

import { money } from "@/lib/format";

export function Coverage({ port, ss, pen, need }: { port: number; ss: number; pen: number; need: number }) {
  const sc = Math.max(need, port + ss + pen) || 1, w = (v: number) => ((v / sc) * 100).toFixed(1) + "%";
  return (
    <div className="gd-cover">
      <div className="gd-cover-bar" role="img" aria-label={"From savings at 4%: " + money(port) + " a year; Social Security " + money(ss) + (pen ? "; pension " + money(pen) : "") + "; against " + money(need) + " a year with its tax"}>
        <i className="w-(--w) bg-series-teal" style={{ "--w": w(port) } as React.CSSProperties}></i>
        <i className="w-(--w) bg-series-sky" style={{ "--w": w(ss) } as React.CSSProperties}></i>
        {pen ? <i className="w-(--w) bg-series-gray" style={{ "--w": w(pen) } as React.CSSProperties}></i> : null}
        <span className="need left-(--x)" style={{ "--x": "calc(" + ((need / sc) * 100).toFixed(1) + "% - 1px)" } as React.CSSProperties}></span>
      </div>
      <div className="gd-cover-key" aria-hidden="true"><span><s className="bg-series-teal"></s>Savings at 4%: <b>{money(port)}</b></span>
        <span><s className="bg-series-sky"></s>Social Security: <b>{money(ss)}</b></span>
        {pen ? <span><s className="bg-series-gray"></s>Pension: <b>{money(pen)}</b></span> : null}
        <span><s className="bg-text w-0.5"></s>A year&apos;s spending and its tax: <b>{money(need)}</b></span></div>
    </div>
  );
}
