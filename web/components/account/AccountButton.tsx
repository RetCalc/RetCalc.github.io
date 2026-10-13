"use client";

/* The header's account button. Signed out: "Sign in". Signed in: the first
   name (or email) and a menu with Account and Sign out. On a phone the
   header has no room for both this and the theme button, so this one takes
   the theme button's place and the theme switch moves into its menu. With
   no account service set up, it isn't shown at all. ACCOUNTS_PLAN.md. */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleUserRoundIcon, LogOutIcon, MoonIcon, SunIcon, UserRoundIcon } from "lucide-react";
import { useAccount } from "./AccountProvider";
import { usePopup } from "@/components/shell/Popup";
import { setThemeChoice, useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Whether the screen is phone-sized (the header's tightest layout). */
function usePhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}

export function AccountButton() {
  const { configured, ready, account, sync, setStep, signOut } = useAccount();
  const showPopup = usePopup();
  const router = useRouter();
  const theme = useTheme();
  const phone = usePhone();
  if (!configured) return null;

  const themeItem = !phone ? null : (
    <DropdownMenuItem onClick={() => setThemeChoice(theme === "dark" ? "light" : "dark")}>
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}{theme === "dark" ? "Light theme" : "Dark theme"}
    </DropdownMenuItem>
  );

  if (!account) {
    return (
      <span className="acct-btn" data-ready={ready ? "" : undefined}>
        {!phone ? <Button variant="outline" onClick={() => setStep({ at: "start" })}>Sign in</Button> : (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Sign in or change theme" />}>
            <UserRoundIcon aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" data-acct-menu="">
            <DropdownMenuItem onClick={() => setStep({ at: "start" })}><UserRoundIcon />Sign in</DropdownMenuItem>
            {themeItem}
          </DropdownMenuContent>
        </DropdownMenu>
        )}
      </span>
    );
  }

  const who = account.firstName ?? account.email;
  return (
    <span className="acct-btn">
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" aria-label={`Your account: ${account.email}`} />}>
          <CircleUserRoundIcon data-icon="inline-start" aria-hidden="true" />
          <span className="acct-who">{who}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64" data-acct-menu="">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <span className="acct-hi">{account.firstName ? `Hi, ${account.firstName}` : "Signed in"}</span>
              <span className="acct-mail">{account.email}</span>
              <span className="acct-sync">{sync === "offline" ? "Account sync is unavailable right now" : "Synced to your account"}</span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/account" />} onClick={() => router.prefetch("/account")}><UserRoundIcon />Account</DropdownMenuItem>
          {themeItem}
          <DropdownMenuItem onClick={async () => {
            if (await signOut()) return;
            const c = await showPopup("Your latest changes aren't saved to your account", [
              { label: "Sign out anyway", desc: "Changes since the last sync are lost. Everything else is safe in your account" },
              { label: "Stay signed in", desc: "Try again when you're back online" },
            ]);
            if (c === 0) await signOut(true);
          }}><LogOutIcon />Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
