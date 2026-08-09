"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { AccountPanel } from "./AccountPanel";
import { MusicNote, Plus } from "./icons";
import { ThemeToggle } from "./ThemeToggle";
import { useAccount } from "./useAccount";

export type NavLink = { href: string; label: string };

// Shared top navigation for every page (home, pricing) — brand mark,
// nav links, an optional admin-only slot, the "new song" action, and
// the account panel. Kept in one place so nav structure/behavior never
// drifts between pages.
export function SiteHeader({
  account,
  homeHref = "/",
  navLinks,
  onNewSong,
  adminSlot,
}: {
  account: ReturnType<typeof useAccount>;
  homeHref?: string;
  navLinks: NavLink[];
  onNewSong: () => void;
  adminSlot?: ReactNode;
}) {
  return (
    <nav className="topbar" aria-label="ניווט ראשי">
      <div className="topbar-start">
        <Link className="brand" href={homeHref} aria-label="My Shirli">
          <span className="brand-mark">
            <MusicNote size={20} strokeWidth={2.1} />
          </span>
          <span className="font-wordmark" dir="ltr">
            My Shirli
          </span>
        </Link>

        <div className="topbar-actions">
          {navLinks.map((link) => (
            <Link href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="topbar-end">
        {adminSlot}
        <ThemeToggle />
        <button className="nav-cta" type="button" onClick={onNewSong}>
          <Plus size={16} />
          שיר חדש
        </button>
        <AccountPanel account={account} />
      </div>
    </nav>
  );
}
