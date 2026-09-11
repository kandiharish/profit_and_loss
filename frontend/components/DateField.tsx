"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { fromUsDate, toUsDate } from "@/lib/reportPeriods";

/**
 * A QuickBooks-style date box: MM/DD/YYYY, with a calendar picker.
 *
 * Why not <input type="date">. That control renders in the BROWSER's locale,
 * so the same page showed DD-MM-YYYY here and MM/DD/YYYY in the US, and the
 * format cannot be set. The client reads QuickBooks all day and expects
 * MM/DD/YYYY everywhere, so the visible field is a text box we format
 * ourselves.
 *
 * The native picker is still available: a zero-size type="date" input sits
 * behind the calendar button and is opened with showPicker(). That keeps the
 * OS date picker (and its keyboard support) without letting it dictate the
 * display format.
 */
export default function DateField({
  value,
  onChange,
  min,
  ariaLabel,
}: {
  /** ISO yyyy-mm-dd. */
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(toUsDate(value));
  const picker = useRef<HTMLInputElement>(null);

  // Follow the value when a preset or Reset changes it underneath us.
  useEffect(() => {
    setText(toUsDate(value));
  }, [value]);

  /** Only commit a real date; otherwise snap back to the last good one. */
  const commit = () => {
    const iso = fromUsDate(text);
    if (iso && iso !== value) onChange(iso);
    else setText(toUsDate(value));
  };

  return (
    <div
      className="relative flex items-center rounded border bg-[var(--color-input)]"
      style={{ borderColor: "var(--color-line)" }}
    >
      <input
        type="text"
        inputMode="numeric"
        aria-label={ariaLabel}
        placeholder="MM/DD/YYYY"
        className="w-[108px] bg-transparent px-2 py-1.5 text-sm focus:outline-none"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setText(toUsDate(value));
        }}
      />
      <button
        type="button"
        aria-label={`Choose ${ariaLabel ?? "date"}`}
        className="px-2 py-1.5 text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        onClick={() => {
          const el = picker.current;
          if (!el) return;
          // showPicker() is not in every browser; focus+click is the fallback.
          if (typeof el.showPicker === "function") el.showPicker();
          else el.click();
        }}
      >
        <Calendar size={15} />
      </button>
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        min={min}
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="pointer-events-none absolute bottom-0 right-2 h-0 w-0 opacity-0"
      />
    </div>
  );
}
