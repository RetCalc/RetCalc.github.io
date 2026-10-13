/* A link-preview card, 1200 by 630: the brand, what the tool is and one
   plain line about it on the left, an illustration on a panel that runs off
   the right edge. Fixed dark theme. Drawn by app/og-card (development only)
   and saved as an image by scripts/og/render.mjs; the words are in
   lib/cards.ts, the pictures in art.tsx. */

import { Brandmark } from "@/components/shell/Brandmark";
import type { HomeData } from "@/components/home/data";
import type { Card } from "@/lib/cards";
import { Art } from "./art";
import s from "./og.module.css";

export function OgCard({ card, data }: { card: Card; data: HomeData }) {
  const home = card.title.startsWith("Know your");
  return (
    <div className={s.card} data-og-card="">
      <div className={s.copy}>
        <div className={s.brand}><Brandmark /><span>RetCalc</span></div>
        <div className={s.mid}>
          {home
            ? <h1 className={s.display}>Know your <em>number.</em></h1>
            : <h1 className={s.title}>{card.title}</h1>}
          <p className={s.text}>{card.text}</p>
        </div>
        <div className={s.foot}><b>retcalc.app</b><span>Free, no account needed</span></div>
      </div>
      <div className={s.art}><Art art={card.art} data={data} /></div>
    </div>
  );
}
