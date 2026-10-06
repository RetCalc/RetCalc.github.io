"use client";

/* The masthead's saved-scenario picker and its Save, Share and Reset
   buttons. They act on whichever tool is open (components/tools/ToolState).
   Ported from src/js/app/23-scenarios.js, 21-share-links.js and
   25-share-card.js. The Share menu offers what the page hands it
   (share.ts): its summary and image card, where it has them. */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { encodeShare, readScenarios, useActiveTool, writeScenarios, type Scenario } from "@/components/tools/ToolState";
import { usePopup, type PopupOption } from "./Popup";
import { canShareSheet, copyCard, saveCard, sendLink, shareKit, type CardData } from "./share";
import { printSheet } from "./Sheet";
import { useToast } from "./Toast";
import { compareNav } from "@/lib/compare-nav";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function ScenarioBar() {
  const tool = useActiveTool();
  const showPopup = usePopup();
  const toast = useToast();
  const router = useRouter();
  // Which saved scenario is loaded, per tool, and its inputs when loaded.
  const [loaded, setLoaded] = useState<Record<string, { name: string; data: unknown }>>({});
  // Re-read the list after a save or delete.
  const [, setRev] = useState(0);

  const id = tool?.def.id;
  const list: Scenario[] = id ? readScenarios(id) : [];
  const cur = id ? loaded[id] : undefined;
  const edited = !!cur && !!tool && !same(tool.state, cur.data);

  const save = () => {
    if (!tool || !id) return;
    const name = prompt(`Name this ${tool.def.noun}:`, cur?.name ?? "");
    if (!name?.trim()) return;
    const trimmed = name.trim();
    const i = list.findIndex((s) => s.name === trimmed);
    // Re-saving over the loaded scenario is the normal way to update it.
    if (i >= 0 && trimmed !== cur?.name &&
        !confirm(`"${trimmed}" already exists as a saved ${tool.def.noun}. Overwrite it?`)) return;
    const entry = { name: trimmed, data: tool.state };
    const next = i >= 0 ? list.map((s, j) => (j === i ? entry : s)) : [...list, entry];
    writeScenarios(id, next);
    setLoaded((l) => ({ ...l, [id]: entry }));
    setRev((r) => r + 1);
    toast("Saved " + trimmed);
  };

  const remove = () => {
    if (!tool || !id) return;
    if (!cur) {
      toast(`Pick a saved ${tool.def.noun} first`);
      return;
    }
    if (!confirm(`Delete ${cur.name}?`)) return;
    writeScenarios(id, list.filter((s) => s.name !== cur.name));
    setLoaded((l) => ({ ...l, [id]: undefined as never }));
    setRev((r) => r + 1);
    toast("Deleted " + cur.name);
  };

  const share = () => {
    if (!tool || !id) return;
    const hash = encodeShare(id, tool.state);
    history.replaceState(history.state, "", hash);
    sendLink(location.origin + location.pathname + hash, "Link copied; it opens with these exact numbers", toast);
  };

  return (
    <div className="scgroup">
      <select id="scenarioPick" aria-label="Saved scenarios" value={cur?.name ?? ""} disabled={!tool}
        onChange={(e) => {
          if (!tool || !id) return;
          const s = list.find((x) => x.name === e.target.value);
          if (!s) {
            setLoaded((l) => ({ ...l, [id]: undefined as never }));
            return;
          }
          tool.load(s.data as never);
          setLoaded((l) => ({ ...l, [id]: { name: s.name, data: { ...tool.def.defaults, ...(s.data as object) } } }));
        }}>
        {list.length ? (
          <>
            <option value="">Unsaved</option>
            {list.map((s) => (
              <option key={s.name} value={s.name}>{s.name === cur?.name && edited ? `${s.name} (edited)` : s.name}</option>
            ))}
          </>
        ) : (
          <option value="">No saved scenarios</option>
        )}
      </select>
      <button className="btn" id="btnScenario" type="button" aria-label="Save or delete a scenario" title="Save or delete"
        onClick={async () => {
          if (!tool) return;
          const c = await showPopup("Scenario", [
            { label: "Save", desc: "Save the current inputs under a name" },
            { label: "Delete", desc: "Remove the selected saved scenario" },
            { label: "Compare", desc: "Put saved retirement scenarios side by side" },
          ]);
          if (c === 0) save();
          else if (c === 1) remove();
          else if (c === 2) {
            Object.assign(compareNav, { from: tool.def.id, path: location.pathname });
            router.push("/compare");
          }
        }}>
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 3.5h9.5l2.5 2.5v10.5H4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M7 3.5v4h6v-4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M7 16.5v-5h6v5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
      </button>
      <button className="btn" id="btnShareMenu" type="button" aria-label="Share" title="Share"
        onClick={async () => {
          if (!tool || !id) return;
          const kit = shareKit(id), sheetOK = canShareSheet();
          const acts: [PopupOption, () => void][] = [[
            kit?.link ? { label: sheetOK ? "Share link" : "Copy link", desc: kit.link.desc[sheetOK ? 0 : 1] }
              : sheetOK ? { label: "Share link", desc: "Text or send a link with all your inputs" } : { label: "Copy link", desc: "Copy a shareable URL with all your inputs" },
            kit?.link ? kit.link.run : share]];
          if (kit?.sheet) acts.push([{ label: kit.sheetLabel?.[0] ?? "Summary", desc: kit.sheetLabel?.[1] ?? "One-page printable overview (Save as PDF)" }, () => {
            const s = kit.sheet!();
            if (typeof s === "string") { if (s) toast(s); } else printSheet(s);
          }]);
          if (kit?.card) {
            const card = (f: (d: CardData, t: (m: string) => void) => void) => () => {
              const d = kit.card!();
              if (typeof d === "string") toast(d); else f(d, toast);
            };
            acts.push([{ label: "Save image card", desc: "A square PNG of your headline numbers" }, card(saveCard)]);
            acts.push([{ label: "Copy image card", desc: "Put that image straight on the clipboard" }, card(copyCard)]);
          }
          const c = await showPopup(kit?.link?.title ?? "Share", acts.map((x) => x[0]));
          if (c >= 0) acts[c][1]();
        }}>
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 12.5V3M6.5 6.2L10 2.8l3.5 3.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M6.5 9H5v8h10V9h-1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <button className="btn" id="btnReset" type="button" aria-label="Reset to defaults" title="Reset"
        onClick={() => {
          if (!tool) return;
          // The button sits close to the tabs on a phone, so ask first.
          if (!same(tool.state, tool.def.defaults) &&
              !confirm(`Reset the ${tool.def.label} inputs to their defaults? Your saved ${tool.def.noun}s won't be affected.`)) return;
          tool.load(tool.def.defaults);
        }}>
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4.2 8.2A6 6 0 1 1 4 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M3.6 4v4.4H8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </div>
  );
}
