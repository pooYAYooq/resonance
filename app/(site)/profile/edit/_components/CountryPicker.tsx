/**
 * Optional searchable country picker for the profile editor.
 *
 * A labelled select button opens a searchable country list. Typing filters the
 * approved country list by name, arrow keys move the active option, Enter
 * selects it, and Escape closes without changing the selection. Only the
 * two-letter code is stored; the display name resolves from the same shared
 * allowlist, so an unknown code is never rendered as a placeholder. The clear
 * control removes the stored code rather than writing a fake value.
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { PROFILE_COUNTRIES } from "@/lib/constants/profile-countries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const NAME_BY_CODE = new Map(
  PROFILE_COUNTRIES.map((country) => [country.code, country.name]),
);

function CountryFlag({ code }: { code: string }) {
  if (code === "IR") {
    return (
      <span className="inline-flex h-4 w-7 shrink-0 items-center justify-center">
        <Image
          src="/flags/iran-lion-sun.png"
          alt=""
          aria-hidden="true"
          width={21}
          height={16}
          className="h-4 w-[21.333px] object-fill"
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`fi fi-${code.toLocaleLowerCase()} h-4 w-7 shrink-0`}
      style={{ height: 16, width: 28 }}
    />
  );
}

export type CountryPickerProps = {
  id: string;
  label: string;
  value: string | null;
  onChange: (code: string | null) => void;
  description?: string;
  invalid?: boolean;
  error?: string;
};

export function CountryPicker({
  id,
  label,
  value,
  onChange,
  description,
  invalid,
  error,
}: CountryPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (term === "") return PROFILE_COUNTRIES;
    return PROFILE_COUNTRIES.filter(
      (country) =>
        country.name.toLocaleLowerCase().includes(term) ||
        country.aliases?.some((alias) =>
          alias.toLocaleLowerCase().includes(term),
        ),
    );
  }, [query]);

  const options = query.trim()
    ? filtered
    : [{ code: null, name: "No country" }, ...filtered];

  const listboxId = `${id}-listbox`;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [description ? `${id}-description` : undefined, errorId]
      .filter(Boolean)
      .join(" ") || undefined;

  const selectedName = value ? (NAME_BY_CODE.get(value) ?? "") : "";
  const selectedFlag = value ? value : "";
  const activeCountry =
    open && activeIndex >= 0 ? options[activeIndex] : undefined;
  const activeDescendant = activeCountry
    ? `${id}-option-${activeCountry.code ?? "none"}`
    : undefined;

  useEffect(() => {
    if (activeDescendant) {
      document
        .getElementById(activeDescendant)
        ?.scrollIntoView?.({ block: "nearest" });
    }
  }, [activeDescendant]);

  function closeList() {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
  }

  function selectCountry(code: string | null) {
    onChange(code);
    closeList();
    triggerRef.current?.focus();
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, options.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return;
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      if (open) {
        // Never let Enter submit the surrounding profile form while the
        // listbox is open. Select the active option, or the first match when
        // the author typed a query but has not arrowed to an option.
        event.preventDefault();
        const target =
          activeCountry ?? (query.trim() ? filtered[0] : undefined);
        if (target) selectCountry(target.code);
      }
      return;
    }
    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        closeList();
        triggerRef.current?.focus();
      }
      return;
    }
    if (event.key === "Tab" && open) {
      closeList();
    }
  }

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <div
          ref={pickerRef}
          className="relative min-w-0 flex-1"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              closeList();
            }
          }}
        >
          <Button
            id={id}
            ref={triggerRef}
            type="button"
            variant="outline"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            aria-label={`${label}: ${selectedName || "No country selected"}`}
            className="h-auto min-h-9 w-full justify-between py-2 font-normal"
            onClick={() => {
              if (open) closeList();
              else {
                setOpen(true);
                setQuery("");
                setActiveIndex(-1);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setOpen(true);
                setQuery("");
                setActiveIndex(-1);
              }
            }}
          >
            <span
              className={cn(
                "flex min-w-0 items-center gap-2 text-left whitespace-normal",
                !selectedName && "text-muted-foreground",
              )}
            >
              {selectedFlag && <CountryFlag code={selectedFlag} />}
              <span className="min-w-0 break-words">
                {selectedName || "Choose a country"}
              </span>
            </span>
            <ChevronsUpDown
              aria-hidden="true"
              className="ml-2 size-4 shrink-0 text-muted-foreground"
            />
          </Button>
          {open && (
            <div className="absolute top-full left-0 z-50 mt-1 w-full max-w-100 rounded-md border bg-popover text-popover-foreground shadow-md">
              <div className="border-b p-2">
                <Input
                  ref={searchRef}
                  role="combobox"
                  aria-label={`Search ${label.toLocaleLowerCase()}`}
                  aria-expanded="true"
                  aria-controls={listboxId}
                  aria-activedescendant={activeDescendant}
                  aria-autocomplete="list"
                  autoComplete="off"
                  autoFocus
                  placeholder="Search countries"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActiveIndex(-1);
                  }}
                  onKeyDown={handleSearchKeyDown}
                />
              </div>
              <ul
                id={listboxId}
                role="listbox"
                aria-label={label}
                className="max-h-60 overflow-y-auto p-1"
              >
                {options.map((country, index) => (
                  <li
                    key={country.code ?? "none"}
                    id={`${id}-option-${country.code ?? "none"}`}
                    role="option"
                    aria-selected={country.code === value}
                    className={cn(
                      "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                      index === activeIndex &&
                        "bg-accent text-accent-foreground",
                    )}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectCountry(country.code)}
                  >
                    {country.code ? (
                      <CountryFlag code={country.code} />
                    ) : (
                      <span aria-hidden="true" className="w-7 shrink-0" />
                    )}
                    <span className="min-w-0 break-words">{country.name}</span>
                  </li>
                ))}
              </ul>
              {filtered.length === 0 && (
                <p
                  role="status"
                  className="px-3 py-2 text-sm text-muted-foreground"
                >
                  No countries match your search.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {description && (
        <FieldDescription id={`${id}-description`}>
          {description}
        </FieldDescription>
      )}
      <div className="min-h-5">
        {error && <FieldError id={errorId}>{error}</FieldError>}
      </div>
    </Field>
  );
}
