"use client";

import { useLayoutEffect } from "react";
import Link from "next/link";
import { readPreferredTheme, setThemeKind } from "@/components/theme-mode";

export function SiteHeader() {
  useLayoutEffect(() => {
    const current = document.documentElement.dataset.theme;
    if (current !== "light" && current !== "dark") {
      document.documentElement.dataset.theme = readPreferredTheme();
    }
  }, []);

  return (
    <header className="site-header">
      <Link className="wordmark" href="/">
        <span className="wordmark-title">Papers a Day</span>
        <span className="wordmark-sub">Visual guides to AI papers</span>
      </Link>
      <div className="header-tools">
        <nav className="header-links" aria-label="Site">
          <Link href="/#about">About</Link>
        </nav>
        <button
          type="button"
          className="theme-toggle"
          aria-label="Toggle color theme"
          onClick={() => {
            const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
            setThemeKind(current === "dark" ? "light" : "dark");
          }}
        >
          <span className="when-light">Dark mode</span>
          <span className="when-dark">Light mode</span>
        </button>
      </div>
    </header>
  );
}
