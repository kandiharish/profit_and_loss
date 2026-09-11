"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export type Theme = "light" | "dark";

const KEY = "pnl-theme";

/** What the OS is asking for, when the user has expressed no preference. */
function systemTheme(): Theme {
  return typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Light / dark switch.
 *
 * The theme lives as data-theme on <html> and is applied before first paint
 * by the inline script in layout.tsx — this component only has to keep the
 * attribute and localStorage in step. Reading the DOM for the initial state
 * rather than re-deriving it is what keeps the two from disagreeing on the
 * first render.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const current =
      (document.documentElement.dataset.theme as Theme | undefined) ??
      systemTheme();
    setTheme(current);
    setReady(true);
  }, []);

  const apply = (next: Theme) => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private browsing can refuse storage. The toggle still works for
      // this session; it just will not be remembered.
    }
    setTheme(next);
  };

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => apply(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      title={isDark ? "Light mode" : "Dark mode"}
      className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-sm transition-colors"
      style={{
        borderColor: "var(--color-line)",
        background: "var(--color-card)",
        color: "var(--color-muted)",
        // Until the effect has read the DOM the label could contradict the
        // painted theme, so hold the icon back for that first tick.
        visibility: ready ? "visible" : "hidden",
      }}
    >
      {isDark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
