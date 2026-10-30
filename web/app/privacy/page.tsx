/* Privacy: what RetCalc keeps, where, and your controls. Written for the
   optional accounts (ACCOUNTS_PLAN.md, step 6). Keep it true: anything that
   changes what's stored or who handles it changes this page too. */
import Link from "next/link";
import { metadataFor } from "@/lib/seo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = metadataFor("privacy");

const UPDATED = "October 29, 2026";

export default function PrivacyPage() {
  return (
    <div className="privacy">
      <h1 id="pageH1">Privacy</h1>
      <p className="privacy-lede">RetCalc is free and works without an account. Every calculation runs in your browser. An account is optional, and only exists so your plans can follow you to another device.</p>

      <Card>
        <CardHeader><CardTitle>Without an account</CardTitle></CardHeader>
        <CardContent>
          <p>Everything you type stays in your browser. Your household, saved scenarios, Guide and Paycheck to Retirement answers, Dashboard and the lessons you&apos;ve read are kept in your browser&apos;s own storage on this device. RetCalc has no copy of them, so clearing your browser&apos;s data, or using another device, starts you fresh.</p>
          <p>Share links carry a tool&apos;s inputs in the part of the address after <code>#</code>, which your browser never sends to a server. Whoever you share the link with can see those numbers.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>With an account (optional)</CardTitle></CardHeader>
        <CardContent>
          <p>If you sign in, we keep:</p>
          <ul>
            <li>your email address, and your first name if you give one;</li>
            <li>your household (single or married, ages, retirement age, state, savings, monthly saving, income, spending);</li>
            <li>your saved scenarios in each tool;</li>
            <li>your Retirement Readiness Guide answers and plan, and your Paycheck to Retirement plan;</li>
            <li>your Dashboard, and which lessons you&apos;ve read;</li>
            <li>whether you&apos;ve turned on the monthly check-in email, and when each one was sent;</li>
            <li>when each of those was last changed.</li>
          </ul>
          <p>Numbers you type into a tool and don&apos;t save aren&apos;t kept. Your account holds nothing else about you. Calculations still run in your browser either way.</p>
          <p>On your Dashboard you can choose to get a monthly check-in email. It&apos;s off unless you turn it on. It comes when your balances haven&apos;t been updated for a month, and says when you last updated them, with a link to your Dashboard. It never includes your figures or your plan&apos;s results, which are worked out in your browser. Every email has a link that turns it off, and so does your Dashboard&apos;s Profile.</p>
          <p>Signing out removes your synced data from that browser. Your account keeps it, and it comes back when you sign in.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Who handles it</CardTitle></CardHeader>
        <CardContent>
          <ul>
            <li><b>Supabase</b> stores accounts and synced data, in the United States (US East). The database only lets you reach your own data.</li>
            <li><b>Google</b>, if you choose &ldquo;Continue with Google&rdquo;, confirms who you are and shares your email address and name with us. We don&apos;t get access to anything else in your Google account. Google&apos;s sign-in button loads only when you open Sign in, never on an ordinary page view.</li>
            <li><b>Resend</b> sends the sign-in code to your email address, and the monthly check-in email if you turn it on.</li>
            <li><b>Vercel</b> and <b>Cloudflare</b> host and deliver the site. Like any website, they handle basic request details such as your IP address to serve pages.</li>
            <li><b>Cloudflare Web Analytics</b> counts visits without cookies and without identifying you.</li>
            <li><b>Vercel Web Analytics</b> also counts visits and which pages are viewed, without cookies and without storing your IP address.</li>
            <li><b>Sentry</b> receives a report when a page fails with an error: what broke, the page&apos;s address without anything after <code>?</code> or <code>#</code>, and your browser and device type. It never receives the numbers you enter, your account, or your IP address.</li>
          </ul>
          <p>We never sell your data or share it with advertisers. There are no ads on RetCalc.</p>
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
