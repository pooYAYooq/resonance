"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface DiscoverSearchProps {
  query: string;
}

// Search owns the primary route entry point and submits only the compatible q parameter.
export function DiscoverSearch({ query }: DiscoverSearchProps) {
  const router = useRouter();
  const [value, setValue] = useState(query.trim());
  const activeQuery = query.trim();

  const goToAllPosts = () => router.push("/blog#blog-results");

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setValue(next);
    // Clearing an active search returns the reader to All posts immediately.
    if (next.trim() === "" && activeQuery !== "") goToAllPosts();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = value.trim();
    router.push(
      next
        ? `/blog?q=${encodeURIComponent(next)}#blog-results`
        : "/blog#blog-results",
    );
  };

  const clearSearch = () => {
    setValue("");
    if (activeQuery !== "") goToAllPosts();
  };

  return (
    <form
      action="/blog#blog-results"
      method="get"
      role="search"
      className="w-full"
      onSubmit={handleSubmit}
    >
      <label htmlFor="discover-search" className="sr-only">
        Search Blog
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="discover-search"
          name="q"
          type="search"
          value={value}
          onChange={handleChange}
          placeholder="Search stories, ideas, and conversations"
          className="h-14 rounded-none pl-12 pr-28 text-base [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
        />
        <div className="absolute inset-y-0 right-2 flex items-center gap-2">
          {value ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={clearSearch}
              className="flex size-9 items-center justify-center rounded-none text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-muted">
                <X aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
              </span>
            </button>
          ) : null}
          <Button type="submit" variant="link" className="h-9 px-1.5">
            Search
          </Button>
        </div>
      </div>
    </form>
  );
}
