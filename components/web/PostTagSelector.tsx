"use client";

import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { MAX_POST_TAGS, POST_TAGS } from "@/lib/constants/post-tags";
import { cn } from "@/lib/utils";

interface PostTagSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
}

/**
 * Renders a controlled selector for choosing post tags. When an author tries
 * to exceed the limit, the guide nudges in place instead of adding a sixth
 * tag or stacking a second message under the grid.
 *
 * @param value - The currently selected tags
 * @param onChange - Called with the updated tag selection
 * @returns The tag selection fieldset
 */
export function PostTagSelector({ value, onChange }: PostTagSelectorProps) {
  const [limitPulse, setLimitPulse] = useState(0);

  useEffect(() => {
    if (!limitPulse) return;
    const timeout = window.setTimeout(() => setLimitPulse(0), 700);
    return () => window.clearTimeout(timeout);
  }, [limitPulse]);

  function handleChange(tag: string, checked: boolean) {
    if (checked && value.length >= MAX_POST_TAGS) {
      setLimitPulse((current) => current + 1);
      return;
    }

    onChange(
      checked ? [...value, tag] : value.filter((selected) => selected !== tag),
    );
  }

  return (
    <fieldset>
      <legend className="w-full">
        <span className="flex items-baseline justify-between gap-4">
          <span className="flex flex-col">
            <span className="text-base font-medium">Tags</span>
            <span
              key={limitPulse}
              className={cn(
                "mt-1 text-sm font-normal",
                limitPulse > 0
                  ? "animate-[tag-limit-nudge_500ms_ease-in-out] text-destructive motion-reduce:animate-none"
                  : "text-muted-foreground",
              )}
            >
              Choose up to {MAX_POST_TAGS}.
            </span>
          </span>
          <span className="shrink-0 text-sm font-normal tabular-nums text-muted-foreground">
            {value.length} / {MAX_POST_TAGS}
          </span>
        </span>
      </legend>
      <span role="alert" className="sr-only">
        {limitPulse > 0 ? `Choose up to ${MAX_POST_TAGS} tags.` : ""}
      </span>
      <div className="mt-4 grid grid-cols-2 gap-1 sm:grid-cols-3">
        {POST_TAGS.map((tag) => (
          <label
            key={tag}
            className="flex cursor-pointer select-none items-center gap-2 rounded-md border border-transparent px-2.5 py-1.5 text-base transition-colors hover:bg-accent has-data-[state=checked]:border-border has-data-[state=checked]:bg-muted"
          >
            <Checkbox
              className="data-[state=unchecked]:border-muted-foreground"
              checked={value.includes(tag)}
              onCheckedChange={(checked) => handleChange(tag, checked === true)}
            />
            {tag}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
