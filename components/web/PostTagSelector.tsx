"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { MAX_POST_TAGS, POST_TAGS } from "@/lib/constants/post-tags";
import { useState } from "react";

interface PostTagSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
}

/**
 * Renders a controlled selector for choosing post tags.
 *
 * @param value - The currently selected tags
 * @param onChange - Called with the updated tag selection
 * @returns The tag selection fieldset
 */
export function PostTagSelector({ value, onChange }: PostTagSelectorProps) {
  const [limitMessage, setLimitMessage] = useState(false);

  function handleChange(tag: string, checked: boolean) {
    if (checked && value.length >= MAX_POST_TAGS) {
      setLimitMessage(true);
      return;
    }

    setLimitMessage(false);
    onChange(
      checked ? [...value, tag] : value.filter((selected) => selected !== tag),
    );
  }

  return (
    <fieldset>
      <legend className="text-base font-medium">
        Tags (up to {MAX_POST_TAGS})
      </legend>
      <div className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-3">
        {POST_TAGS.map((tag) => (
          <label
            key={tag}
            className="flex cursor-pointer select-none items-center gap-2 rounded-md border border-transparent px-2.5 py-1.5 text-base transition-colors hover:bg-accent has-data-[state=checked]:border-border has-data-[state=checked]:bg-muted"
          >
            <Checkbox
              checked={value.includes(tag)}
              onCheckedChange={(checked) => handleChange(tag, checked === true)}
            />
            {tag}
          </label>
        ))}
      </div>
      {limitMessage && (
        <p role="alert" className="mt-1 text-sm text-destructive">
          Choose up to 5 tags.
        </p>
      )}
    </fieldset>
  );
}
