"use client";

/* /account: your name, what your account holds, and the two promises the
   welcome email makes: download your data, delete your account. Deleting
   runs in the delete-account Edge Function (supabase/functions), which signs
   every device out first; the secret key never reaches the browser.
   ACCOUNTS_PLAN.md, step 5. */

import { useEffect, useState } from "react";
import { DownloadIcon, Trash2Icon } from "lucide-react";
import { useAccount } from "./AccountProvider";
import { pullAll, type AccountItem } from "@/lib/sync/account";
import { usePopup } from "@/components/shell/Popup";
import { useToast } from "@/components/shell/Toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/** What each synced key is, in words. */
function label(key: string): string {
  if (key === "household") return "Your household";
  if (key === "guide") return "Your Retirement Readiness Guide";
  if (key.startsWith("scenarios-")) return "Saved scenarios: " + key.slice("scenarios-".length);
  return key;
}

export function AccountPage() {
  const { configured, ready, account, client, setStep, setFirstName, signOut, sync } = useAccount();
  const showPopup = usePopup();
  const toast = useToast();
  const [items, setItems] = useState<AccountItem[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the saved name once the session is read
    setName(account?.firstName ?? "");
  }, [account?.firstName]);

  useEffect(() => {
    if (!client || !account) return;
    let live = true;
    pullAll(client).then((r) => { if (live) setItems(r); }, () => { if (live) setItems([]); });
    return () => { live = false; };
  }, [client, account, sync]);

  if (!configured) {
    return <Card><CardHeader><CardTitle>Accounts aren&apos;t available here</CardTitle><CardDescription>Everything you save stays in this browser.</CardDescription></CardHeader></Card>;
  }
  if (!ready) return null;
  if (!account) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>You&apos;re not signed in</CardTitle>
          <CardDescription>An account is optional. It keeps your household, saved scenarios and Guide on any device.</CardDescription>
        </CardHeader>
        <CardContent><Button onClick={() => setStep({ at: "start" })}>Sign in</Button></CardContent>
      </Card>
    );
  }

  const download = () => {
    const blob = new Blob([JSON.stringify({ email: account.email, firstName: account.firstName, exported: new Date().toISOString(), items }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "retcalc-account.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const remove = async () => {
    if (!client) return;
    const c = await showPopup("Delete your account?", [
      { label: "Delete my account and its data", desc: "Signs out every device and erases your account. This can't be undone. What's saved in this browser stays here." },
    ]);
    if (c !== 0) return;
    setBusy(true);
    const { error } = await client.functions.invoke("delete-account", { method: "POST" });
    setBusy(false);
    if (error) { toast("Couldn't delete the account. Try again in a minute.", "warn"); return; }
    await signOut(true);
    toast("Your account is deleted");
  };

  return (
    <div className="acct-page">
      <Card>
        <CardHeader>
          <CardTitle>{account.firstName ? `Hi, ${account.firstName}` : "Your account"}</CardTitle>
          <CardDescription>Signed in as {account.email}. {sync === "offline" ? "Account sync is unavailable right now; everything still saves in this browser." : "Your household, saved scenarios and Guide sync to this account."}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="acct-form" onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const err = await setFirstName(name || null);
            setBusy(false);
            toast(err ?? "Saved");
          }}>
            <label htmlFor="acctPageName">First name (optional)</label>
            <div className="acct-row">
              <Input id="acctPageName" autoComplete="given-name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
              <Button type="submit" variant="outline" disabled={busy}>Save</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What your account holds</CardTitle>
          <CardDescription>Stored with Supabase in the US. Never sold or shared.</CardDescription>
        </CardHeader>
        <CardContent>
          {items === null ? <p className="acct-fine">Loading…</p> : items.length === 0 ? <p className="acct-fine">Nothing yet. It fills in as you use the tools.</p> : (
            <ul className="acct-items">
              {items.map((it) => <li key={it.key}><span>{label(it.key)}</span><span>{new Date(it.at).toLocaleDateString()}</span></li>)}
            </ul>
          )}
          <div className="acct-row">
            <Button variant="outline" onClick={download} disabled={!items}><DownloadIcon data-icon="inline-start" />Download my data</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delete your account</CardTitle>
          <CardDescription>Signs out every device and erases your account and everything synced to it. This browser keeps its own copy until you clear it.</CardDescription>
        </CardHeader>
        <CardContent><Button variant="destructive" onClick={remove} disabled={busy}><Trash2Icon data-icon="inline-start" />Delete my account</Button></CardContent>
      </Card>
    </div>
  );
}
