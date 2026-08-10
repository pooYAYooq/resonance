"use client";

import { MAX_POST_TAGS, POST_TAGS } from "@/lib/constants/post-tags";
import { useState } from "react";

interface PostTagSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
}

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
      <legend className="text-sm font-medium">Tags (optional)</legend>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {POST_TAGS.map((tag) => (
          <label key={tag} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.includes(tag)}
              onChange={(event) => handleChange(tag, event.target.checked)}
            />
            {tag}
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Select up to {MAX_POST_TAGS} tags.
      </p>
      {limitMessage && (
        <p role="alert" className="mt-1 text-sm text-destructive">
          Choose up to 5 tags.
        </p>
      )}
    </fieldset>
  );
}
