"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Country } from "@/lib/types";

type Props = {
  countries: Country[];
  /** Name of the hidden `<input>` so the value is submitted with the form. */
  name: string;
  /** Selected country code (controlled). Empty string = nothing selected. */
  value: string;
  onChange: (code: string) => void;
  required?: boolean;
  placeholder?: string;
  /** Show "— coming soon" suffix on rows where is_supported=false. */
  showComingSoon?: boolean;
  /** Show "— auto-ingested" suffix on rows where is_supported=true. */
  showAutoIngested?: boolean;
  className?: string;
};

const REGION_ORDER = ["Europe", "Americas", "Asia", "Africa", "Oceania"] as const;

export function CountryCombobox({
  countries,
  name,
  value,
  onChange,
  required = false,
  placeholder = "Search countries…",
  showComingSoon = true,
  showAutoIngested = false,
  className = "",
}: Props) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Record<string, HTMLLIElement | null>>({});

  const selectedCountry = useMemo(
    () => countries.find((c) => c.code === value) ?? null,
    [countries, value],
  );

  // Filter + group + sort within each region (supported floats to top).
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? countries.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.code.toLowerCase().includes(q) ||
            c.iso3.toLowerCase().includes(q),
        )
      : countries;

    const byRegion = new Map<string, Country[]>();
    for (const c of matches) {
      if (!byRegion.has(c.region)) byRegion.set(c.region, []);
      byRegion.get(c.region)!.push(c);
    }
    for (const list of byRegion.values()) {
      list.sort((a, b) => {
        if (a.is_supported !== b.is_supported) return a.is_supported ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    }
    return REGION_ORDER.filter((r) => byRegion.has(r)).map(
      (r) => [r, byRegion.get(r)!] as const,
    );
  }, [countries, query]);

  // Flat list for keyboard navigation indexing.
  const flat = useMemo(() => grouped.flatMap(([, list]) => list), [grouped]);

  // Keep highlight in range as the filtered list changes.
  useEffect(() => {
    if (highlight >= flat.length) setHighlight(Math.max(0, flat.length - 1));
  }, [flat.length, highlight]);

  // When the popover opens, scroll the highlighted/selected row into view.
  useEffect(() => {
    if (!open) return;
    const target = flat[highlight];
    if (!target) return;
    const el = optionRefs.current[target.code];
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [open, highlight, flat]);

  // Click-outside closes the popover.
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        e.target !== inputRef.current
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const pick = useCallback(
    (c: Country) => {
      onChange(c.code);
      setQuery("");
      setOpen(false);
      // Return focus to the input so keyboard users keep flow.
      inputRef.current?.focus();
    },
    [onChange],
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setHighlight((h) => Math.min(flat.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      if (open && flat[highlight]) {
        e.preventDefault();
        pick(flat[highlight]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery("");
    } else if (e.key === "Tab") {
      // Soft-close on tab so the user can move on; don't preventDefault.
      setOpen(false);
    }
  }

  // What the input shows: the selected name when closed, the live query when open.
  const displayValue = open
    ? query
    : selectedCountry
      ? selectedCountry.name
      : "";

  return (
    <div className={`relative ${className}`}>
      {/* Real form value — hidden, but submitted with the form. */}
      <input
        type="hidden"
        name={name}
        value={value}
        required={required}
      />

      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={displayValue}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
          setHighlight(0);
        }}
        onKeyDown={onKeyDown}
        className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-base text-zinc-900 outline-none ring-emerald-500/40 placeholder:text-zinc-400 focus:ring-2 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
      />

      {open && (
        <div
          ref={popoverRef}
          className="absolute left-0 right-0 z-20 mt-1 max-h-80 overflow-auto rounded-xl border border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-zinc-900"
        >
          {flat.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No countries match &ldquo;{query}&rdquo;.
            </div>
          ) : (
            <ul
              id={`${id}-listbox`}
              role="listbox"
              className="py-1"
            >
              {grouped.map(([region, list]) => (
                <li key={region} className="py-1">
                  <div className="px-4 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {region}
                  </div>
                  <ul>
                    {list.map((c) => {
                      const idx = flat.indexOf(c);
                      const isHighlighted = idx === highlight;
                      const isSelected = c.code === value;
                      return (
                        <li
                          key={c.code}
                          ref={(el) => {
                            optionRefs.current[c.code] = el;
                          }}
                          role="option"
                          aria-selected={isSelected}
                          onMouseEnter={() => setHighlight(idx)}
                          // Use mousedown so it fires before the input blur
                          // would otherwise close the popover.
                          onMouseDown={(e) => {
                            e.preventDefault();
                            pick(c);
                          }}
                          className={
                            "flex cursor-pointer items-center justify-between px-4 py-2 text-sm " +
                            (isHighlighted
                              ? "bg-emerald-50 text-zinc-900 dark:bg-emerald-950/40 dark:text-zinc-100"
                              : "text-zinc-800 dark:text-zinc-200")
                          }
                        >
                          <span className="flex items-baseline gap-2">
                            <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-400">
                              {c.code}
                            </span>
                            <span>{c.name}</span>
                          </span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            {showAutoIngested && c.is_supported
                              ? "auto-ingested"
                              : showComingSoon && !c.is_supported
                                ? "coming soon"
                                : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
