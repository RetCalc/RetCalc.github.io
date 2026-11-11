"use client";

/* Profiles, on the Profile tab: the Dashboards this account keeps (a
   couple's and one person's, or someone being shown how it works), which
   is open, and adding, renaming and deleting them. With only one, it's
   just a New profile button in Household's header; with more, a box
   above Household. A new profile starts fresh, through setup, or as a
   copy of one already there. Each is its own synced item (store.ts,
   lib/sync/merge.ts). */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ContactRoundIcon, CopyIcon, EllipsisIcon, PencilIcon, PlusIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Field, SelectField } from "@/components/fields/Field";
import { Choice } from "./fields";
import { addProfile, deleteProfile, openProfile, profileLabel, readProfile, renameProfile, useDashboard, useProfiles } from "./store";
import { Tile } from "./ui";

/** Under a profile's name: who's in it, and whether setup is finished. */
function aboutOf(id: string, named: boolean): string {
  const d = readProfile(id), p = d.profile;
  const names = [p.p1.name.trim(), p.who === "couple" ? p.p2.name.trim() : ""].filter(Boolean).join(" and ");
  const parts = [named ? names : "", p.who === "couple" ? "Couple" : p.who === "single" ? "Single" : "", d.done ? "" : "Setup not finished"].filter(Boolean);
  return parts.join(" · ") || "Nothing filled in yet";
}

type Ask = { at: "rename"; id: string } | { at: "delete"; id: string } | null;

/** Adds a profile: the button and its dialog. */
export function NewProfileButton() {
  const [on, setOn] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOn(true)}><PlusIcon aria-hidden="true" />New profile</Button>
      <Dialog open={on} onOpenChange={setOn}>
        <DialogContent aria-labelledby="dshProfTitle">{on ? <NewProfile close={() => setOn(false)} /> : null}</DialogContent>
      </Dialog>
    </>
  );
}

/** The profiles, once there's more than one (nothing before that). */
export function Profiles() {
  useDashboard(); // re-render as the open profile's names change
  const { list, open } = useProfiles();
  const [ask, setAsk] = useState<Ask>(null);
  const close = () => setAsk(null);
  const label = (id: string) => profileLabel(list.find((p) => p.id === id)!);
  if (list.length < 2) return null;
  return (
    <Tile id="profiles" icon={ContactRoundIcon} title="Profiles" right={<NewProfileButton />}>
      <ul className="dsh-profiles" aria-label="Your profiles">
        {list.map((p) => {
          const on = p.id === open;
          return (
            <li key={p.id} className="dsh-readonly" data-on={on ? "" : undefined}>
              <div className="dsh-profile-t">
                <b>{profileLabel(p)}</b>
                <span className="dsh-cap">{aboutOf(p.id, !!p.name.trim())}</span>
              </div>
              <span className="dsh-inline dsh-profile-b">
                {on ? <Badge variant="outline">Current</Badge> : <Button variant="outline" size="sm" onClick={() => { openProfile(p.id); window.scrollTo({ top: 0 }); }}>Open</Button>}
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`More for ${profileLabel(p)}`} />}>
                    <EllipsisIcon aria-hidden="true" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setAsk({ at: "rename", id: p.id })}><PencilIcon />Rename</DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => setAsk({ at: "delete", id: p.id })}><Trash2Icon />Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </span>
            </li>
          );
        })}
      </ul>
      <Dialog open={ask != null} onOpenChange={(o) => { if (!o) close(); }}>
        <DialogContent aria-labelledby="dshProfTitle">
          {ask?.at === "rename" ? <Rename id={ask.id} name={label(ask.id)} close={close} />
            : ask?.at === "delete" ? <Delete id={ask.id} name={label(ask.id)} close={close} />
            : null}
        </DialogContent>
      </Dialog>
    </Tile>
  );
}

/** Name it, then start fresh (setup, nothing filled in) or copy one. */
function NewProfile({ close }: { close: () => void }) {
  const { list, open } = useProfiles();
  const router = useRouter();
  const [name, setName] = useState("");
  const [how, setHow] = useState<"fresh" | "copy">("fresh");
  const [from, setFrom] = useState(open);
  const fromName = profileLabel(list.find((p) => p.id === from) ?? list[0]);
  const create = () => {
    if (how === "fresh") {
      addProfile(name.trim() || "New profile");
      close();
      router.push("/dashboard/setup");
    } else {
      addProfile(name.trim() || `${fromName} (copy)`, from);
      close();
      window.scrollTo({ top: 0 });
    }
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); create(); }}>
      <h2 id="dshProfTitle" className="dsh-dlg-h">New profile</h2>
      <div className="dsh-fields dsh-fields-sm">
        <Field id="dshProfName" label="Name"><Input id="dshProfName" value={name} placeholder={how === "copy" ? `${fromName} (copy)` : "For example, Just me"} autoFocus onChange={(e) => setName(e.target.value)} /></Field>
        <div className="dsh-choices">
          <Choice on={how === "fresh"} icon={<SparklesIcon aria-hidden="true" />} title="Start fresh" sub="Go through setup with nothing filled in" onClick={() => setHow("fresh")} />
          <Choice on={how === "copy"} icon={<CopyIcon aria-hidden="true" />} title={list.length > 1 ? "Start from a copy" : `Copy ${fromName}`} sub="Everything as it is now, to change on Profile" onClick={() => setHow("copy")} />
        </div>
        {how === "copy" && list.length > 1 ? (
          <SelectField id="dshProfFrom" label="Copy of" value={from} onChange={setFrom}>
            {list.map((p) => <option key={p.id} value={p.id}>{profileLabel(p)}</option>)}
          </SelectField>
        ) : null}
      </div>
      <p className="dsh-cap">Your other profiles stay exactly as they are. Switch between them here.</p>
      <div className="dsh-navbtns dsh-wrapbtns">
        <Button type="button" variant="outline" onClick={close}>Cancel</Button>
        <Button type="submit">{how === "fresh" ? "Create and start setup" : "Create the copy"}</Button>
      </div>
    </form>
  );
}

function Rename({ id, name, close }: { id: string; name: string; close: () => void }) {
  const [v, setV] = useState(name);
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (v.trim()) renameProfile(id, v); close(); }}>
      <h2 id="dshProfTitle" className="dsh-dlg-h">Rename profile</h2>
      <div className="dsh-fields dsh-fields-sm">
        <Field id="dshProfRename" label="Name"><Input id="dshProfRename" value={v} autoFocus onFocus={(e) => e.currentTarget.select()} onChange={(e) => setV(e.target.value)} /></Field>
      </div>
      <div className="dsh-navbtns dsh-wrapbtns">
        <Button type="button" variant="outline" onClick={close}>Cancel</Button>
        <Button type="submit" disabled={!v.trim()}>Save</Button>
      </div>
    </form>
  );
}

function Delete({ id, name, close }: { id: string; name: string; close: () => void }) {
  return (
    <>
      <h2 id="dshProfTitle" className="dsh-dlg-h">Delete {name}?</h2>
      <p className="dsh-cap">Its answers, net worth history and everything set on each tab will be deleted, here and in your account. This can&apos;t be undone. Your other profiles aren&apos;t affected.</p>
      <div className="dsh-navbtns dsh-wrapbtns">
        <Button variant="outline" onClick={close}>Keep it</Button>
        <Button variant="destructive" onClick={() => { deleteProfile(id); close(); }}>Delete profile</Button>
      </div>
    </>
  );
}
