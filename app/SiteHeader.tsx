"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { AccountPanel } from "./AccountPanel";
import { Plus } from "./icons";
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
  navAriaLabel = "ניווט ראשי",
  newSongLabel = "שיר חדש",
}: {
  account: ReturnType<typeof useAccount>;
  homeHref?: string;
  navLinks: NavLink[];
  onNewSong: () => void;
  adminSlot?: ReactNode;
  // Optional locale overrides — default to Hebrew so every existing
  // caller (all of them, today) renders byte-identical to before these
  // props existed. Used by the English order flow to avoid any Hebrew
  // text/aria-label appearing on that page.
  navAriaLabel?: string;
  newSongLabel?: string;
}) {
  return (
    <nav className="topbar" aria-label={navAriaLabel}>
      <div className="topbar-start">
        <Link className="brand" href={homeHref} aria-label="Shirli">
          <span className="brand-mark">
            <img src="/logo.png" alt="Shirli" />
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
        <button className="nav-cta" type="button" onClick={onNewSong}>
          <Plus size={16} />
          {newSongLabel}
        </button>
        <AccountPanel account={account} />
      </div>
    </nav>
  );
}
