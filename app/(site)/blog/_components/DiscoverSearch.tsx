"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DiscoverSearchProps {
  query: string;
}

interface SearchState {
  query: string;
  value: string;
  pendingQuery: string | null;
}

// Search owns the primary route entry point and submits only the compatible q parameter.
export function DiscoverSearch({ query }: DiscoverSearchProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const activeQuery = query.trim();
  const [search, setSearch] = useState<SearchState>({
    query: activeQuery,
    value: activeQuery,
    pendingQuery: null,
  });
  const hasSearch = activeQuery !== "" || Boolean(search.pendingQuery);

  if (search.query !== activeQuery) {
    // Our navigation acknowledges the submitted query, not any newer draft.
    // External navigation (including history) replaces the draft instead.
    setSearch({
      query: activeQuery,
      value: search.pendingQuery === activeQuery ? search.value : activeQuery,
      pendingQuery: null,
    });
  }

  const navigate = (next: string) => {
    setSearch((current) => ({
      ...current,
      value: next,
      pendingQuery: next === activeQuery ? null : next,
    }));
    router.push(
      next
        ? `/blog?q=${encodeURIComponent(next)}#blog-results`
        : "/blog#blog-results",
    );
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    // Clearing an active search returns the reader to All posts immediately.
    if (next.trim() === "" && hasSearch) {
      navigate("");
    } else {
      setSearch((current) => ({ ...current, value: next }));
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate(search.value.trim());
  };

  const clearSearch = () => {
    if (hasSearch) navigate("");
    else setSearch((current) => ({ ...current, value: "" }));
    inputRef.current?.focus();
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
        <Input
          ref={inputRef}
          id="discover-search"
          name="q"
          type="search"
          value={search.value}
          onChange={handleChange}
          placeholder="Search"
          className="h-14 rounded-none pl-4 pr-28 text-base [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
        />
        <div className="absolute inset-y-0 right-2 flex items-center gap-2">
          {search.value ? (
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
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  aria-label="Search"
                  className="size-11 rounded-none"
                >
                  <Search aria-hidden="true" className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                Search
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </form>
  );
}
