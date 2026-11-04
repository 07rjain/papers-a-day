"use client";

import { useSyncExternalStore } from "react";

export type ThemeKind = "light" | "dark";

const STORAGE_KEY = "pad-theme";

function subscribe(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function getSnapshot(): ThemeKind {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function getServerSnapshot(): ThemeKind {
  return "light";
}

export function useThemeKind(): ThemeKind {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setThemeKind(kind: ThemeKind) {
  document.documentElement.dataset.theme = kind;
  try {
    localStorage.setItem(STORAGE_KEY, kind);
  } catch {
    /* Storage can throw in private mode. The attribute still updates this tab. */
  }
}

export function readPreferredTheme(): ThemeKind {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* ignore */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
