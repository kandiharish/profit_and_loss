"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export type SelectOption = {
  value: string;
  label: string;
};

export default function Select({
  value,
  options,
  onChange,
  placeholder = "Select…",
  icon,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm w-full min-w-[160px] transition-all duration-150"
        style={{
          background: "var(--color-input)",
          borderColor: open ? "var(--neo-accent)" : "var(--color-line)",
          color: "var(--color-ink)",
          boxShadow: open ? "0 0 0 3px rgba(6,182,212,0.12)" : "none",
        }}
      >
        {icon && (
          <span className="flex-shrink-0 opacity-60">{icon}</span>
        )}
        <span className="flex-1 text-left truncate">
          {selected?.label ?? <span style={{ color: "var(--color-muted)" }}>{placeholder}</span>}
        </span>
        <ChevronDown
          className="h-3.5 w-3.5 flex-shrink-0 transition-transform duration-200"
          style={{
            color: "var(--color-muted)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute z-50 mt-1.5 min-w-full rounded-xl border shadow-xl overflow-hidden"
          style={{
            background: "var(--color-card)",
            borderColor: "var(--color-line)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)",
            animation: "dropdownIn 120ms ease-out",
          }}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className="flex items-center justify-between w-full px-3 py-2 text-sm text-left transition-colors duration-100"
                style={{
                  background: isSelected ? "rgba(6,182,212,0.08)" : "transparent",
                  color: isSelected ? "var(--neo-accent)" : "var(--color-ink)",
                  fontWeight: isSelected ? 600 : 400,
                }}
                onMouseEnter={(e) => {
                  if (!isSelected)
                    (e.currentTarget as HTMLElement).style.background = "var(--color-input)";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected)
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <span>{opt.label}</span>
                {isSelected && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes dropdownIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
