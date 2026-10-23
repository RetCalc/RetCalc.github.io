"use client";

/* Tools: every RetCalc tool, grouped as the tool list groups them, for a
   closer look at one part of the plan. */

import Link from "next/link";
import { CalculatorIcon } from "lucide-react";
import { TOOL_GROUPS } from "@/lib/tools";
import { Frame } from "./Frame";
import { Tile } from "./ui";

export function Tools() {
  return (
    <Frame current="tools" title="Tools" sub="A closer look at any one part of your plan">
      {TOOL_GROUPS.map((g, i) => (
        <div className={i ? "dsh-r4" : undefined} key={g.title}>
          <Tile icon={CalculatorIcon} title={g.title} right={<span className="dsh-cap">{g.sub}</span>}>
            <div className="dsh-toolgrid">
              {g.cards.map((c) => (
                <Link key={c.sub} href={"/" + c.path} className="dsh-tool"><b>{c.name}</b><span>{c.q}</span></Link>
              ))}
            </div>
          </Tile>
        </div>
      ))}
      <p className="dsh-cap dsh-r4">Each tool opens with its own inputs. Your dashboard&apos;s numbers stay here.</p>
    </Frame>
  );
}
