/* Privacy: what RetCalc keeps, where, and your controls. Written for the
   optional accounts (ACCOUNTS_PLAN.md, step 6). Keep it true: anything that
   changes what's stored or who handles it changes this page too. */
import Link from "next/link";
import { metadataFor } from "@/lib/seo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = metadataFor("privacy");

const UPDATED = "October 12, 2026";

export default function PrivacyPage() {
  return (
    <div className="privacy">
      <h1 id="pageH1">Privacy</h1>
      <p className="privacy-lede">RetCalc is free and works without an account. Every calculation runs in your browser. An account is optional, and only exists so your plans can follow you to another device.</p>

      <Card>
        <CardHeader><CardTitle>Without an account</CardTitle></CardHeader>
        <CardContent>
          <p>Everything you type stays in your browser. Your household, saved scenarios and Guide answers are kept in your browser&apos;s own storage on this device. RetCalc has no copy of them, so clearing your browser&apos;s data, or using another device, starts you fresh.</p>
          <p>Share links carry a tool&apos;s inputs in the part of the address after <code>#</code>, which your browser never sends to a server. Whoever you share the link with can see those numbers.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>With an account (optional)</CardTitle></CardHeader>
        <CardContent>
          <p>If you sign in, we keep:</p>
          <ul>
            <li>your email address, and your first name if you give one;</li>
            <li>your household (ages, retirement age, state, savings, monthly saving, income, spending);</li>
            <li>your saved scenarios in each tool;</li>
            <li>your Retirement Readiness Guide answers and plan;</li>
            <li>when each of those was last changed.</li>
          </ul>
          <p>We don&apos;t keep numbers you type into a tool and don&apos;t save, your browsing, or anything else about you. Calculations still run in your browser either way.</p>
          <p>Signing out removes your synced data from that browser; your account keeps it until you sign in again.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Who handles it</CardTitle></CardHeader>
        <CardContent>
          <ul>
            <li><b>Supabase</b> stores accounts and synced data, in the United States (US East). The database only lets you reach your own data.</li>
            <li><b>Google</b>, if you choose &ldquo;Continue with Google&rdquo;, confirms who you are and shares your email address and name with us. We don&apos;t get access to anything else in your Google account.</li>
            <li><b>Resend</b> sends the sign-in code to your email address.</li>
            <li><b>Vercel</b> and <b>Cloudflare</b> host and deliver the site. Like any website, they handle basic request details such as your IP address to serve pages.</li>
            <li><b>Cloudflare Web Analytics</b> counts visits without cookies and without identifying you.</li>
          </ul>
          <p>We never sell your data, share it with advertisers, or use it for ads. There are no ads on RetCalc.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Your controls</CardTitle></CardHeader>
        <CardContent>
          <p>On your <Link href="/account">account page</Link> you can download everything your account holds, change your name, or delete your account. Deleting signs out every device and erases your account and its data. It can&apos;t be undone.</p>
          <p>Questions, or something to fix? Use the email address at the bottom of every page.</p>
        </CardContent>
      </Card>

      <p className="privacy-fine">Last updated {UPDATED}. If this changes, the date above changes with it.</p>
    </div>
  );
}
