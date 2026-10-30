"use client";

/* Accounts: what the household has (left) and owes (right), with net worth
   above them and a picture of both: today, or entry by entry over time.
   Read-only until Edit; "Save as new entry" records a dated entry (one a
   day: a second save the same day replaces it), and the plan reads the
   latest one. */

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type Modifier } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, PencilIcon, PlusIcon, Trash2Icon, WalletIcon, LandmarkIcon, CalendarDaysIcon, ChartBarIcon, XIcon, HourglassIcon, ReceiptIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { Affixed } from "@/components/fields/Field";
import { MoneyInput, NumberInput } from "@/components/fields/NumberInput";
import { groupDigits, parseNum } from "@/lib/format";
import { useNarrow } from "@/components/charts/useNarrow";
import { useWidth } from "./charts";
import { Frame } from "./Frame";
import { longDate, money, shortMoney } from "./format";
import { ASSET_GROUPS, ASSET_KINDS, BASIS_KINDS, DEBT_GROUPS, DEBT_KINDS, groupOf, kindName, ownerOf, type Group } from "./kinds";
import { Tile, TipLabel } from "./ui";
import { ReadyToSpend, TaxMix, WhoseFilter, WorthOverTime, only, touchRead, whoName, type Who } from "./networth";
import { pctTxt, useTyped } from "./fields";
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
  // A phone gives the bars the room the names don't need.
  const phone = useNarrow();
  const L = phone ? 64 : 120, R = phone ? 64 : 90, bh = 34, gap = 22, H = bh * 2 + gap + 8;
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
          return <rect key={gr.id} className={"dsh-seg dsh-g-" + gr.id} x={at} y={y} width={Math.max(0, w - 2)} height={bh} rx={4} onMouseEnter={() => setHover(label)} onMouseLeave={() => setHover(null)} aria-label={label} data-read={label} />;
        })}
        <text className="dsh-bar-v" x={W - R + 10} y={y + bh / 2 + 5}>{shortMoney(total)}</text>
      </g>
    );
  };
  return (
    <div ref={ref}>
      <svg className="dsh-bars" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Assets ${money(have)}, debts ${money(owe)}`} {...touchRead((r) => setHover(r))}>
        {row("asset", ASSET_GROUPS, 0)}
        {row("debt", DEBT_GROUPS, bh + gap)}
      </svg>
      <div className="dsh-cap dsh-hoverline" aria-live="polite">{hover ?? <><span className="dsh-mouse">Point at a part of a bar for its amount.</span><span className="dsh-touch">Tap a part of a bar, or drag along it, for its amount.</span></>}</div>
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

const whoText = (names: [string, string], w: 0 | 1 | null) => (w == null ? "Shared" : whoName(names, w));

/** One side's list, read-only, under its column names. */
function List({ items, side, names }: { items: Item[]; side: Item["side"]; names: [string, string] | null }) {
  const rows = items.filter((i) => i.side === side);
  const debt = side === "debt";
  return (
    <table className="dsh-tbl dsh-ltbl">
      <thead><tr><th>Name</th><th>{debt ? "Type" : <TipLabel text="Type" id="assetType" />}</th><th>{debt ? "Amount owed" : "Amount"}</th>{debt ? <th><TipLabel text="Interest rate" id="debtRate" /></th> : null}</tr></thead>
      <tbody>
        {rows.length ? rows.map((i) => (
          <tr key={i.id}>
            <td><i className={"dsh-sw dsh-g-" + groupOf(i.kind)} aria-hidden="true" />{i.name || kindName(i.kind)}</td>
            <td className="dsh-muted dsh-kind">{kindName(i.kind)}{names ? " · " + whoText(names, ownerOf(i, names)) : ""}</td>
            <td>{money(i.value)}{!debt && BASIS_KINDS[i.kind] && i.basis != null ? <Gain item={i} /> : null}</td>
            {debt ? <td>{i.rate != null ? (i.rate * 100).toFixed(2).replace(/\.?0+$/, "") + "%" : "—"}</td> : null}
          </tr>
        )) : <tr><td colSpan={debt ? 4 : 3} className="dsh-muted">{debt ? "No debts. If that's right, you're set." : "Nothing added yet."}</td></tr>}
      </tbody>
      <tfoot><tr><td>Total</td><td /><td>{money(sum(items, side))}</td>{debt ? <td /> : null}</tr></tfoot>
    </table>
  );
}

/** A brokerage account's gain or loss on what was paid in (a Roth's
    growth past its contributions), after its amount. */
function Gain({ item }: { item: Item }) {
  const d = item.value - (item.basis ?? 0), what = item.kind === "roth" ? "growth past your contributions" : d >= 0 ? "gain" : "loss";
  return <span className={d >= 0 ? "dsh-basis dsh-up" : "dsh-basis dsh-dn"} title={`${money(Math.abs(d))} ${what}`}>({d >= 0 ? "+" : "−"}{money(Math.abs(d))})</span>;
}

/** A field in an editable row, with its column's name over it on a phone
    (wider screens name the columns once, above the rows). */
function F({ l, children }: { l: string; children: React.ReactNode }) {
  return <div className="dsh-ef"><span className="dsh-efl" aria-hidden="true">{l}</span>{children}</div>;
}

/** Rows move up and down only. */
const upDown: Modifier = ({ transform }) => ({ ...transform, x: 0 });

/** One side's rows, editable, each dragged by its grip to reorder: a
    mouse drags at once, a finger after a touch and hold (so the page still
    scrolls), and a keyboard picks one up with Space and moves it with the
    arrows. */
function EditList({ items, side, names, onChange }: { items: Item[]; side: Item["side"]; names: [string, string] | null; onChange: (items: Item[]) => void }) {
  const kinds = side === "asset" ? ASSET_KINDS : DEBT_KINDS;
  const put = (id: string, v: Partial<Item>) => onChange(items.map((i) => (i.id === id ? { ...i, ...v } : i)));
  const rows = items.filter((i) => i.side === side);
  // The row last removed, and where it was, so it can be put back.
  const [gone, setGone] = useState<{ item: Item; at: number } | null>(null);
  const removeRow = (i: Item) => { setGone({ item: i, at: items.indexOf(i) }); onChange(items.filter((x) => x.id !== i.id)); };
  const undo = () => { if (!gone) return; const next = items.slice(); next.splice(Math.min(gone.at, next.length), 0, gone.item); onChange(next); setGone(null); };
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const move = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onChange(arrayMove(items, items.findIndex((i) => i.id === active.id), items.findIndex((i) => i.id === over.id)));
  };
  const nameOf = (id: unknown) => { const i = items.find((x) => x.id === id); return i ? i.name || kindName(i.kind) : ""; };
  const at = (id: unknown) => rows.findIndex((x) => x.id === id) + 1;
  const debt = side === "debt", whose = !!names;
  const row = "dsh-erow " + (debt ? "dsh-erow-debt" : "dsh-erow-asset") + (whose ? " dsh-erow-whose" : "");
  return (
    <div className="dsh-elist">
      {/* The column names are for the eye (each field has its own label),
          except the tip on what you put in. */}
      <div className={row + " dsh-ehead"}>
        <span /><span aria-hidden="true">Name</span><span aria-hidden="true">Type</span>{whose ? <span aria-hidden="true">Whose</span> : null}<span aria-hidden="true">{debt ? "Amount owed" : "Amount"}</span>{debt ? <span aria-hidden="true">Interest rate</span> : <span><TipLabel text="What you put in" id="putIn" /></span>}<span />
      </div>
      <DndContext id={useId()} sensors={sensors} collisionDetection={closestCenter} modifiers={[upDown]} onDragEnd={move}
        accessibility={{ screenReaderInstructions: { draggable: "To move a row, press Space, use the up and down arrows, then press Space again to drop it, or Escape to cancel." },
          announcements: {
            onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
            onDragOver: ({ active, over }) => (over ? `${nameOf(active.id)} is now at position ${at(over.id)} of ${rows.length}.` : undefined),
            onDragEnd: ({ active, over }) => (over ? `${nameOf(active.id)} dropped at position ${at(over.id)} of ${rows.length}.` : `${nameOf(active.id)} dropped.`),
            onDragCancel: ({ active }) => `Move cancelled. ${nameOf(active.id)} is back where it was.`,
          } }}>
        <SortableContext items={rows.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {rows.map((i) => (
            <EditRow key={i.id} item={i} className={row} kinds={kinds} names={names} onPut={(v) => put(i.id, v)} onRemove={() => removeRow(i)} />
          ))}
        </SortableContext>
      </DndContext>
      {gone ? <p className="dsh-cap" role="status">Removed {gone.item.name || kindName(gone.item.kind)}. <Button variant="link" size="inline" onClick={undo}>Undo</Button></p> : null}
      <Button variant="outline" size="sm" onClick={() => { setGone(null); onChange([...items, { id: newId(), side, kind: kinds[0].kind, name: "", value: 0, ...(side === "debt" ? { rate: null } : {}) }]); }}>
        <PlusIcon aria-hidden="true" />{side === "asset" ? "Add an asset" : "Add a debt"}
      </Button>
      {debt ? null : <p className="dsh-cap">What you put in is optional: for a brokerage account its <TipLabel text="cost basis" id="costBasis" />, for a Roth <TipLabel text="your own contributions" id="rothContrib" />. A 457(b) is its own type because it can be drawn from without the 10% penalty once you leave that job.{whose ? " Say whose each retirement account is, since each opens at its owner's 59½. Shared counts half each." : ""}</p>}
    </div>
  );
}

/** One editable row, with the grip that drags it. */
function EditRow({ item: i, className, kinds, names, onPut, onRemove }: { item: Item; className: string; kinds: { kind: Item["kind"]; name: string }[]; names: [string, string] | null; onPut: (v: Partial<Item>) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: i.id });
  const debt = i.side === "debt", label = i.name || kindName(i.kind);
  return (
    <div ref={setNodeRef} className={className + " dsh-sortrow" + (isDragging ? " dsh-dragging" : "")}
      style={{ "--dsh-drag": CSS.Translate.toString(transform) ?? "none", "--dsh-drag-t": transition ?? "none" } as React.CSSProperties}>
      <span className="dsh-grip"><Button ref={setActivatorNodeRef} variant="ghost" size="icon" {...attributes} {...listeners} aria-label={"Move " + label}><GripVerticalIcon aria-hidden="true" /></Button></span>
      <F l="Name"><Input aria-label="Name" value={i.name} placeholder={kindName(i.kind)} onChange={(e) => onPut({ name: e.target.value })} /></F>
      <F l="Type"><NativeSelect aria-label="Kind" value={i.kind} onChange={(e) => onPut({ kind: e.target.value as Item["kind"], ...(BASIS_KINDS[e.target.value] ? {} : { basis: undefined }) })}>
        {kinds.map((k) => <option key={k.kind} value={k.kind}>{k.name}</option>)}
      </NativeSelect></F>
      {names ? (
        <F l="Whose"><NativeSelect aria-label="Whose" value={String(ownerOf(i, names) ?? "")} onChange={(e) => onPut({ owner: e.target.value === "" ? null : (Number(e.target.value) as 0 | 1) })}>
          <option value="0">{whoName(names, 0)}</option>
          <option value="1">{whoName(names, 1)}</option>
          <option value="">Shared</option>
        </NativeSelect></F>
      ) : null}
      <F l={debt ? "Amount owed" : "Amount"}><Affixed prefix="$"><MoneyInput aria-label="Amount" nonNeg value={i.value ? groupDigits(i.value, true) : ""} onValueChange={(v) => onPut({ value: parseNum(v) })} /></Affixed></F>
      {debt ? <F l="Interest rate"><RateInput rate={i.rate ?? null} onRate={(rate) => onPut({ rate })} /></F>
        : BASIS_KINDS[i.kind] ? <F l={BASIS_KINDS[i.kind]!.name + " (optional)"}><Affixed prefix="$"><MoneyInput aria-label={BASIS_KINDS[i.kind]!.name + " (optional)"} nonNeg placeholder={BASIS_KINDS[i.kind]!.name}
          value={i.basis != null ? groupDigits(i.basis, true) : ""} onValueChange={(v) => onPut({ basis: v.trim() === "" ? null : parseNum(v) })} /></Affixed></F>
        : <span className="dsh-muted dsh-ena" aria-hidden="true">—</span>}
      <span className="dsh-erm"><Button variant="ghost" size="icon" aria-label={"Remove " + label} onClick={onRemove}><Trash2Icon aria-hidden="true" /></Button></span>
    </div>
  );
}

export function Accounts() {
  const { data, update } = useDashboard();
  // A couple says whose each asset and debt is.
  const names: [string, string] | null = data.profile.who === "couple" ? [data.profile.p1.name, data.profile.p2.name] : null;
  const last = data.entries[data.entries.length - 1] ?? entryFrom(data.profile);
  const [mode, setMode] = useState<"today" | "time">("today");
  // Whose things the pictures show, for a couple; the lists show everything.
  const [who, setWho] = useState<Who>("all");
  const view = (it: Item[]) => only(it, names, who);
  const [draft, setDraft] = useState<{ date: string; items: Item[] } | null>(null);
  // The entry asked about before it's deleted, by its date.
  const [removing, setRemoving] = useState<string | null>(null);
  const remove = () => { const date = removing; update((d) => ({ ...d, entries: d.entries.filter((e) => e.date !== date) })); setRemoving(null); };
  const items = draft?.items ?? last?.items ?? [];
  const startEdit = () => setDraft({ date: today(), items: (last?.items ?? []).map((i) => ({ ...i })) });
  const saveEntry = () => {
    if (!draft) return;
    const kept = draft.items.filter((i) => i.value > 0 || i.name.trim());
    update((d) => ({ ...d, entries: withEntry(d.entries, { date: draft.date || today(), items: kept, from: "accounts" }) }));
    setDraft(null);
  };
  const shown = draft ? items : view(items);
  const have = sum(shown, "asset"), owe = sum(shown, "debt");
  const prev = data.entries[data.entries.length - 2];
  const nwOf = (e: Entry) => sum(view(e.items), "asset") - sum(view(e.items), "debt");
  const actions = draft
    ? <><Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button><Button onClick={saveEntry}>Save as new entry</Button></>
    : <Button onClick={startEdit}><PencilIcon aria-hidden="true" />Update balances</Button>;

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
    <Frame current="accounts" title="Net worth" sub={last ? (draft ? "Editing. Saving adds a new entry." : "As of " + longDate(last.date)) : "Nothing entered yet"}>
      {names && !draft ? <WhoseFilter names={names} who={who} onWho={setWho} /> : null}
      <Tile id="picture" icon={ChartBarIcon} title={mode === "time" && !draft ? "Net worth over time" : "Assets and debts"} right={draft ? null :
        <Segmented aria-label="Today or over time">
          <SegmentedItem pressed={mode === "today"} onPressedChange={() => setMode("today")}>Today</SegmentedItem>
          <SegmentedItem pressed={mode === "time"} onPressedChange={() => setMode("time")}>Over time</SegmentedItem>
        </Segmented>
      }>
        {mode === "time" && !draft ? <WorthOverTime entries={data.entries} view={view} /> : <>
          <div className="dsh-stats">
            <div className="dsh-stat"><div className="dsh-label">Net worth</div><div className="dsh-fig dsh-key">{money(have - owe)}</div>
              {prev && last && !draft ? <div className="dsh-cap dsh-mt6"><span className={nwOf(last) >= nwOf(prev) ? "dsh-chg dsh-up" : "dsh-chg dsh-dn"}>{nwOf(last) >= nwOf(prev) ? "↑" : "↓"} {money(Math.abs(nwOf(last) - nwOf(prev)))}</span> since {longDate(prev.date)}</div> : null}</div>
            <div className="dsh-stat"><div className="dsh-label">Assets</div><div className="dsh-fig dsh-md">{money(have)}</div></div>
            <div className="dsh-stat"><div className="dsh-label">Debts</div><div className="dsh-fig dsh-md">{money(owe)}</div></div>
          </div>
          <div className="dsh-mt">
            <TodayBars items={shown} />
          </div>
          <Legend />
        </>}
      </Tile>

      {draft ? (
        <div className="dsh-asof">
          <label htmlFor="dshAsOf" className="dsh-label">As of</label>
          <Input id="dshAsOf" type="date" value={draft.date} max={today()} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
          <span className="dsh-cap">{data.entries.some((e) => e.date === draft.date) ? "Replaces the entry already saved for this day." : "Saving adds this as a new point on your net worth line."}</span>
        </div>
      ) : null}

      {/* Editing, each side takes the full width, so every field has room. */}
      <div className={draft ? "dsh-grid dsh-r4" : "dsh-grid dsh-two"}>
        <Tile id="assets" icon={WalletIcon} title="Assets" right={<span className="dsh-cap">{money(sum(items, "asset"))}</span>}>
          {draft ? <EditList items={draft.items} side="asset" names={names} onChange={(it) => setDraft({ ...draft, items: it })} /> : <List items={items} side="asset" names={names} />}
        </Tile>
        <Tile id="debts" icon={LandmarkIcon} title="Debts" right={<span className="dsh-cap">{money(sum(items, "debt"))}</span>}>
          {draft ? <EditList items={draft.items} side="debt" names={names} onChange={(it) => setDraft({ ...draft, items: it })} /> : <List items={items} side="debt" names={names} />}
        </Tile>
      </div>

      {/* While editing, the page is the editor: these come back on saving. */}
      {draft ? null : (
        <div className="dsh-grid dsh-two">
          <Tile id="spend" icon={HourglassIcon} title="When you can spend it" tip="readySpend">
            <ReadyToSpend items={view(items)} pr={data.profile} names={names} />
          </Tile>
          <Tile id="taxed" icon={ReceiptIcon} title="How it's taxed" tip="taxMix">
            <TaxMix items={view(items)} />
          </Tile>
        </div>
      )}
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
          <div className="dsh-scrollx"><table className="dsh-tbl dsh-etbl">
            <thead><tr><th>Date</th><th>Assets</th><th>Debts</th><th>Net worth</th><th>Change</th><th><span className="sr-only">Delete</span></th></tr></thead>
            <tbody>
              {data.entries.slice().reverse().map((e, i, arr) => {
                const before = arr[i + 1], ch = before ? netWorth(e) - netWorth(before) : null;
                return (
                  <tr key={e.date}><td>{longDate(e.date)}</td><td data-l="Assets">{money(sum(e.items, "asset"))}</td><td data-l="Debts">{money(sum(e.items, "debt"))}</td><td data-l="Net worth">{money(netWorth(e))}</td>
                    <td data-l="Change">{ch == null ? <span className="dsh-muted">First entry</span> : <span className={ch >= 0 ? "dsh-chg dsh-up" : "dsh-chg dsh-dn"}>{ch >= 0 ? "+" : "-"}{money(Math.abs(ch))}</span>}</td>
                    <td className="dsh-del"><Button variant="ghost" size="icon-xs" aria-label={"Delete the entry from " + longDate(e.date)} onClick={() => setRemoving(e.date)}><XIcon aria-hidden="true" /></Button></td></tr>
                );
              })}
            </tbody>
          </table></div>
        </Tile>
      ) : null}
      <Dialog open={!!removing} onOpenChange={(o) => { if (!o) setRemoving(null); }}>
        <DialogContent aria-labelledby="dshDelTitle">
          <h2 id="dshDelTitle" className="dsh-dlg-h">Delete the entry from {removing ? longDate(removing) : ""}?</h2>
          <p className="dsh-cap">Its balances come off your net worth history{data.entries.length === 1 ? ", and with no entries left your net worth goes back to what setup gave" : ""}. This can&apos;t be undone.</p>
          <div className="dsh-navbtns dsh-wrapbtns">
            <Button variant="destructive" onClick={remove}>Delete entry</Button>
            <Button variant="outline" onClick={() => setRemoving(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Frame>
  );
}

/** A debt's interest rate, in percent, keeping a half-typed "6." as typed. */
function RateInput({ rate, onRate }: { rate: number | null; onRate: (r: number | null) => void }) {
  const [text, setText] = useTyped(pctTxt(rate));
  return (
    <Affixed suffix="%">
      <NumberInput aria-label="Interest rate" nonNeg step={0.25} max={40} value={text}
        onValueChange={(v) => { setText(v); onRate(v.trim() === "" ? null : parseNum(v) / 100); }} />
    </Affixed>
  );
}
