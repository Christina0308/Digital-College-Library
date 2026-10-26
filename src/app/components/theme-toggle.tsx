"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export type ThemeMode = "light" | "dark";
const STORAGE_KEY = "college_library_theme";

function systemTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStored(): ThemeMode | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current = (document.documentElement.dataset.theme as ThemeMode) || readStored() || systemTheme();
    setTheme(current);
    setMounted(true);
    // Enable colour transitions only after the first paint, so loading isn't animated.
    document.body.classList.add("theme-ready");

    // Follow the system setting until the reader picks a theme explicitly.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => {
      if (readStored()) return;
      const next: ThemeMode = event.matches ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      setTheme(next);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function choose(next: ThemeMode) {
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can be blocked; the attribute still applies for this page session.
    }
  }

  return (
    <div className="theme-toggle" role="group" aria-label="Colour theme">
      <button
        type="button"
        onClick={() => choose("light")}
        aria-pressed={mounted ? theme === "light" : undefined}
        aria-label="Use light theme"
        title="Light theme"
      >
        <Sun aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => choose("dark")}
        aria-pressed={mounted ? theme === "dark" : undefined}
        aria-label="Use dark theme"
        title="Dark theme"
      >
        <Moon aria-hidden="true" />
      </button>
    </div>
  );
}
