"use client";

/* Accounts: what the household has (left) and owes (right), with net worth
   above them and a picture of both: today, or entry by entry over time.
   Read-only until Edit; "Save as new entry" records a dated entry (one a
   day: a second save the same day replaces it), and the plan reads the
   latest one. */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PencilIcon, PlusIcon, Trash2Icon, WalletIcon, LandmarkIcon, CalendarDaysIcon, ChartBarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { Affixed } from "@/components/fields/Field";
import { MoneyInput, NumberInput } from "@/components/fields/NumberInput";
import { groupDigits, parseNum } from "@/lib/format";
import { useWidth } from "./charts";
import { Frame } from "./Frame";
import { longDate, money, shortMoney } from "./format";
import { ASSET_GROUPS, ASSET_KINDS, DEBT_GROUPS, DEBT_KINDS, groupOf, kindName, type Group } from "./kinds";
import { Tile } from "./ui";
import { entryFrom, netWorth, newId, sum, today, useDashboard, withEntry, type Entry, type Item } from "./store";

const byGroup = (items: Item[], side: Item["side"]) => {
  const out: Partial<Record<Group, number>> = {};
  items.filter((i) => i.side === side).forEach((i) => { const g = groupOf(i.kind); out[g] = (out[g] ?? 0) + (i.value || 0); });
  return out;
};

/** Today: what you have and what you owe as two bars on one scale. */
export function TodayBars({ items }: { items: Item[] }) {
  const [ref, W] = useWidth(800);
  const [hover, setHover] = useState<string | null>(null);
  const have = sum(items, "asset"), owe = sum(items, "debt"), max = Math.max(have, owe, 1);
  const L = 120, R = 90, bh = 34, gap = 22, H = bh * 2 + gap + 8;
  const row = (side: Item["side"], groups: { id: Group; name: string }[], y: number) => {
    const g = byGroup(items, side), total = side === "asset" ? have : owe;
    const shown = groups.filter((gr) => (g[gr.id] ?? 0) > 0);
    const widths = shown.map((gr) => ((g[gr.id] ?? 0) / max) * (W - L - R));
    const starts = widths.map((_, k) => L + widths.slice(0, k).reduce((s2, w) => s2 + w, 0));
    return (
      <g>
        <text className="dsh-bar-k" x={0} y={y + bh / 2 + 4}>{side === "asset" ? "Assets" : "Debts"}</text>
        <rect className="dsh-bar-track" x={L} y={y} width={W - L - R} height={bh} rx={6} />
        {shown.map((gr, k) => {
          const w = widths[k], at = starts[k];
          const label = `${gr.name}: ${money(g[gr.id] ?? 0)}, ${Math.round(((g[gr.id] ?? 0) / Math.max(total, 1)) * 100)}% of your ${side === "asset" ? "assets" : "debts"}`;
          return <rect key={gr.id} className={"dsh-seg dsh-g-" + gr.id} x={at} y={y} width={Math.max(0, w - 2)} height={bh} rx={4} onMouseEnter={() => setHover(label)} onMouseLeave={() => setHover(null)} aria-label={label} />;
        })}
        <text className="dsh-bar-v" x={W - R + 10} y={y + bh / 2 + 5}>{shortMoney(total)}</text>
      </g>
    );
  };
  return (
    <div ref={ref}>
      <svg className="dsh-bars" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Assets ${money(have)}, debts ${money(owe)}`}>
        {row("asset", ASSET_GROUPS, 0)}
        {row("debt", DEBT_GROUPS, bh + gap)}
      </svg>
      <div className="dsh-cap dsh-hoverline" aria-live="polite">{hover ?? "Point at a part of a bar for its amount."}</div>
    </div>
  );
}

/** Over time: one column per entry, what you have above the line and what
    you owe below, with net worth marked. */
function OverTime({ entries }: { entries: Entry[] }) {
  const [ref, W] = useWidth(800);
  const [hover, setHover] = useState<number | null>(null);
  const H = 240, L = 56, B = 22, T = 10;
  const tops = entries.map((e) => sum(e.items, "asset")), bottoms = entries.map((e) => sum(e.items, "debt"));
  const up = Math.max(...tops, 1), down = Math.max(...bottoms, 0);
  const span = up + down, zero = T + (up / span) * (H - T - B);
  const Y = (v: number) => zero - (v / span) * (H - T - B);
  const n = entries.length, slot = (W - L) / Math.max(n, 1), bw = Math.min(56, slot * 0.6);
  const e = hover != null ? entries[hover] : null;
  return (
    <div ref={ref}>
      <svg className="dsh-bars" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Assets and debts at each entry">
        <line className="dsh-gl" x1={L} x2={W} y1={zero} y2={zero} />
        <text className="dsh-axis" x={L - 8} y={Y(up) + 4} textAnchor="end">{shortMoney(up)}</text>
        <text className="dsh-axis" x={L - 8} y={zero + 4} textAnchor="end">$0</text>
        {down > 0 ? <text className="dsh-axis" x={L - 8} y={Y(-down) + 4} textAnchor="end">-{shortMoney(down)}</text> : null}
        {entries.map((en, i) => {
          const x = L + i * slot + (slot - bw) / 2;
          const a = byGroup(en.items, "asset"), d = byGroup(en.items, "debt"), px = (H - T - B) / span;
          // Each group's height, and where it starts: assets stack up from
          // the line, debts down from it.
          const ah = ASSET_GROUPS.map((g) => (a[g.id] ?? 0) * px), dh = DEBT_GROUPS.map((g) => (d[g.id] ?? 0) * px);
          const atop = ah.map((h, k) => zero - ah.slice(0, k + 1).reduce((s2, v) => s2 + v, 0));
          const dtop = dh.map((_, k) => zero + dh.slice(0, k).reduce((s2, v) => s2 + v, 0));
          return (
            <g key={en.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect className="dsh-hit" x={L + i * slot} y={0} width={slot} height={H - B} />
              {ASSET_GROUPS.map((g, k) => (ah[k] > 0 ? <rect key={g.id} className={"dsh-seg dsh-g-" + g.id} x={x} y={atop[k]} width={bw} height={Math.max(0, ah[k] - 1)} /> : null))}
              {DEBT_GROUPS.map((g, k) => (dh[k] > 0 ? <rect key={g.id} className={"dsh-seg dsh-g-" + g.id} x={x} y={dtop[k] + 1} width={bw} height={Math.max(0, dh[k] - 1)} /> : null))}
              <line className="dsh-nwmark" x1={x - 4} x2={x + bw + 4} y1={Y(netWorth(en))} y2={Y(netWorth(en))} />
              <text className="dsh-axis" x={x + bw / 2} y={H - 6} textAnchor="middle">{en.date.slice(5, 7) + "/" + en.date.slice(2, 4)}</text>
            </g>
          );
        })}
      </svg>
      <div className="dsh-cap dsh-hoverline" aria-live="polite">
        {e ? <>{longDate(e.date)}: assets <b>{money(sum(e.items, "asset"))}</b>, debts <b>{money(sum(e.items, "debt"))}</b>, net worth <b>{money(netWorth(e))}</b></> : "The amber mark is net worth. Point at an entry for its figures."}
      </div>
    </div>
  );
}

export function Legend() {
  return (
    <div className="dsh-legend dsh-mt">
      {[...ASSET_GROUPS, ...DEBT_GROUPS].map((g) => <span key={g.id}><i className={"dsh-sw dsh-g-" + g.id} />{g.name}</span>)}
    </div>
  );
}

/** One side's list, read-only, under its column names. */
function List({ items, side }: { items: Item[]; side: Item["side"] }) {
  const rows = items.filter((i) => i.side === side);
  const kinds = side === "asset" ? ASSET_KINDS : DEBT_KINDS, debt = side === "debt";
  const sorted = rows.slice().sort((a, b) => kinds.findIndex((k) => k.kind === a.kind) - kinds.findIndex((k) => k.kind === b.kind));
  return (
    <table className="dsh-tbl dsh-ltbl">
      <thead><tr><th>Name</th><th>Type</th><th>{debt ? "Amount owed" : "Amount"}</th>{debt ? <th>Interest rate</th> : null}</tr></thead>
      <tbody>
        {sorted.length ? sorted.map((i) => (
          <tr key={i.id}>
            <td><i className={"dsh-sw dsh-g-" + groupOf(i.kind)} aria-hidden="true" />{i.name || kindName(i.kind)}</td>
            <td className="dsh-muted">{kindName(i.kind)}</td>
            <td>{money(i.value)}</td>
            {debt ? <td>{i.rate != null ? (i.rate * 100).toFixed(2).replace(/\.?0+$/, "") + "%" : "—"}</td> : null}
          </tr>
        )) : <tr><td colSpan={debt ? 4 : 3} className="dsh-muted">{debt ? "No debts. If that's right, you're set." : "Nothing added yet."}</td></tr>}
      </tbody>
      <tfoot><tr><td>Total</td><td /><td>{money(sum(items, side))}</td>{debt ? <td /> : null}</tr></tfoot>
    </table>
  );
}

/** One side's rows, editable. */
function EditList({ items, side, onChange }: { items: Item[]; side: Item["side"]; onChange: (items: Item[]) => void }) {
  const kinds = side === "asset" ? ASSET_KINDS : DEBT_KINDS;
  const put = (id: string, v: Partial<Item>) => onChange(items.map((i) => (i.id === id ? { ...i, ...v } : i)));
  const rows = items.filter((i) => i.side === side);
  return (
    <div className="dsh-elist">
      <div className={side === "debt" ? "dsh-erow dsh-erow-debt dsh-ehead" : "dsh-erow dsh-ehead"} aria-hidden="true">
        <span>Name</span><span>Type</span><span>{side === "debt" ? "Amount owed" : "Amount"}</span>{side === "debt" ? <span>Interest rate</span> : null}<span />
      </div>
      {rows.map((i) => (
        <div key={i.id} className={side === "debt" ? "dsh-erow dsh-erow-debt" : "dsh-erow"}>
          <Input aria-label="Name" value={i.name} placeholder={kindName(i.kind)} onChange={(e) => put(i.id, { name: e.target.value })} />
          <NativeSelect aria-label="Kind" value={i.kind} onChange={(e) => put(i.id, { kind: e.target.value as Item["kind"] })}>
            {kinds.map((k) => <option key={k.kind} value={k.kind}>{k.name}</option>)}
          </NativeSelect>
          <Affixed prefix="$"><MoneyInput aria-label="Amount" nonNeg value={i.value ? groupDigits(i.value, true) : ""} onValueChange={(v) => put(i.id, { value: parseNum(v) })} /></Affixed>
          {side === "debt" ? <Affixed suffix="%"><NumberInput aria-label="Interest rate" nonNeg step={0.25} max={40} value={i.rate != null ? String(Math.round(i.rate * 10000) / 100) : ""} onValueChange={(v) => put(i.id, { rate: v.trim() === "" ? null : parseNum(v) / 100 })} /></Affixed> : null}
          <Button variant="ghost" size="icon" aria-label={"Remove " + (i.name || kindName(i.kind))} onClick={() => onChange(items.filter((x) => x.id !== i.id))}><Trash2Icon aria-hidden="true" /></Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange([...items, { id: newId(), side, kind: kinds[0].kind, name: "", value: 0, ...(side === "debt" ? { rate: null } : {}) }])}>
        <PlusIcon aria-hidden="true" />{side === "asset" ? "Add an asset" : "Add a debt"}
      </Button>
    </div>
  );
}

export function Accounts() {
  const { data, update } = useDashboard();
  const last = data.entries[data.entries.length - 1] ?? entryFrom(data.profile);
  const [view, setView] = useState<"today" | "time">("today");
  const [draft, setDraft] = useState<{ date: string; items: Item[] } | null>(null);
  const items = draft?.items ?? last?.items ?? [];
  const startEdit = () => setDraft({ date: today(), items: (last?.items ?? []).map((i) => ({ ...i })) });
  const saveEntry = () => {
    if (!draft) return;
    const kept = draft.items.filter((i) => i.value > 0 || i.name.trim());
    update((d) => ({ ...d, entries: withEntry(d.entries, { date: draft.date || today(), items: kept, from: "accounts" }) }));
    setDraft(null);
  };
  const have = sum(items, "asset"), owe = sum(items, "debt");
  const prev = data.entries[data.entries.length - 2];
  const actions = draft
    ? <><Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button><Button onClick={saveEntry}>Save as new entry</Button></>
    : <Button onClick={startEdit}><PencilIcon aria-hidden="true" />Edit</Button>;

  /* Leaving with changes not saved: asked first, inside the site; the
     browser asks on a reload or a closed tab. */
  const router = useRouter();
  const dirty = !!draft && JSON.stringify(draft.items) !== JSON.stringify(last?.items ?? []);
  const [leaving, setLeaving] = useState<string | null>(null);
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    const click = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || e.metaKey || e.ctrlKey) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      e.preventDefault(); e.stopPropagation();
      setLeaving(url.pathname + url.search);
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", click, true); };
  }, [dirty]);
  const leave = (save: boolean) => { if (save) saveEntry(); else setDraft(null); const to = leaving!; setLeaving(null); router.push(to); };

  return (
    <Frame current="accounts" title="Net worth" sub={last ? (draft ? "Editing; saving adds a new entry" : "As of " + longDate(last.date)) : "Nothing entered yet"}>
      <Tile icon={ChartBarIcon} title="Assets and debts" right={
        <Segmented aria-label="Today or over time">
          <SegmentedItem pressed={view === "today"} onPressedChange={() => setView("today")}>Today</SegmentedItem>
          <SegmentedItem pressed={view === "time"} onPressedChange={() => setView("time")}>Over time</SegmentedItem>
        </Segmented>
      }>
        <div className="dsh-stats">
          <div className="dsh-stat"><div className="dsh-label">Net worth</div><div className="dsh-fig dsh-key">{money(have - owe)}</div>
            {prev && last && !draft ? <div className="dsh-cap dsh-mt6"><span className={netWorth(last) >= netWorth(prev) ? "dsh-chg dsh-up" : "dsh-chg dsh-dn"}>{netWorth(last) >= netWorth(prev) ? "↑" : "↓"} {money(Math.abs(netWorth(last) - netWorth(prev)))}</span> since {longDate(prev.date)}</div> : null}</div>
          <div className="dsh-stat"><div className="dsh-label">Assets</div><div className="dsh-fig dsh-md">{money(have)}</div></div>
          <div className="dsh-stat"><div className="dsh-label">Debts</div><div className="dsh-fig dsh-md">{money(owe)}</div></div>
        </div>
        <div className="dsh-mt">
          {view === "today" ? <TodayBars items={items} /> : data.entries.length > 1 ? <OverTime entries={data.entries} /> : <p className="dsh-cap">Each time you save a new entry, a column joins this view. You have {data.entries.length || "no"} so far.</p>}
        </div>
        <Legend />
      </Tile>

      {draft ? (
        <div className="dsh-asof">
          <label htmlFor="dshAsOf" className="dsh-label">As of</label>
          <Input id="dshAsOf" type="date" value={draft.date} max={today()} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
          <span className="dsh-cap">{data.entries.some((e) => e.date === draft.date) ? "Replaces the entry already saved for this day." : "Saving adds this as a new point on your net worth line."}</span>
        </div>
      ) : null}

      <div className="dsh-grid dsh-two">
        <Tile id="assets" icon={WalletIcon} title="Assets" right={<span className="dsh-cap">{money(have)}</span>}>
          {draft ? <EditList items={draft.items} side="asset" onChange={(it) => setDraft({ ...draft, items: it })} /> : <List items={items} side="asset" />}
        </Tile>
        <Tile id="debts" icon={LandmarkIcon} title="Debts" right={<span className="dsh-cap">{money(owe)}</span>}>
          {draft ? <EditList items={draft.items} side="debt" onChange={(it) => setDraft({ ...draft, items: it })} /> : <List items={items} side="debt" />}
        </Tile>
      </div>
      <div className="dsh-editbar">{actions}</div>
      <Dialog open={!!leaving} onOpenChange={(o) => { if (!o) setLeaving(null); }}>
        <DialogContent aria-labelledby="dshLeaveTitle">
          <h2 id="dshLeaveTitle" className="dsh-dlg-h">You have unsaved changes to your balances</h2>
          <p className="dsh-cap">Save them as a new entry before you go?</p>
          <div className="dsh-navbtns dsh-wrapbtns">
            <Button onClick={() => leave(true)}>Save as new entry</Button>
            <Button variant="outline" onClick={() => leave(false)}>Discard</Button>
            <Button variant="link" onClick={() => setLeaving(null)}>Keep editing</Button>
          </div>
        </DialogContent>
      </Dialog>

      {data.entries.length ? (
        <Tile id="entries" icon={CalendarDaysIcon} title="Your entries" className="dsh-r4" right={<span className="dsh-cap">{data.entries.length} so far</span>}>
          <table className="dsh-tbl">
            <thead><tr><th>Date</th><th>Assets</th><th>Debts</th><th>Net worth</th><th>Change</th></tr></thead>
            <tbody>
              {data.entries.slice().reverse().map((e, i, arr) => {
                const before = arr[i + 1], ch = before ? netWorth(e) - netWorth(before) : null;
                return (
                  <tr key={e.date}><td>{longDate(e.date)}</td><td>{money(sum(e.items, "asset"))}</td><td>{money(sum(e.items, "debt"))}</td><td>{money(netWorth(e))}</td>
                    <td>{ch == null ? <span className="dsh-muted">First entry</span> : <span className={ch >= 0 ? "dsh-chg dsh-up" : "dsh-chg dsh-dn"}>{ch >= 0 ? "+" : "-"}{money(Math.abs(ch))}</span>}</td></tr>
                );
              })}
            </tbody>
          </table>
        </Tile>
      ) : null}
    </Frame>
  );
}
