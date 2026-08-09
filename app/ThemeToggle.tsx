"use client";

import { MoonIcon, SunIcon } from "./icons";

// Both icons always render — CSS ([data-theme] on <html>, set by the
// no-FOUC script in app/layout.tsx) decides which one is visible. This
// keeps server and client markup identical (no hydration mismatch) and
// needs no React state at all: the click handler reads/writes the DOM
// attribute directly.
export function ThemeToggle() {
  const toggle = () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    window.localStorage.setItem("theme", next);
  };

  return (
    <button aria-label="החלפת ערכת נושא" className="theme-toggle" onClick={toggle} type="button">
      <SunIcon className="theme-toggle-icon theme-toggle-icon--sun" size={18} />
      <MoonIcon className="theme-toggle-icon theme-toggle-icon--moon" size={18} />
    </button>
  );
}
