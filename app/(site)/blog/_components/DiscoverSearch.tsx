import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface DiscoverSearchProps {
  query: string;
}

// Search owns the primary route entry point and submits only the compatible q parameter.
export function DiscoverSearch({ query }: DiscoverSearchProps) {
  return (
    <form action="/blog" method="get" role="search" className="w-full">
      <label htmlFor="discover-search" className="sr-only">
        Search Discover
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="discover-search"
          name="q"
          type="search"
          defaultValue={query.trim()}
          placeholder="Search stories, ideas, and conversations"
          className="h-14 rounded-none pl-12 pr-28 text-base"
        />
        <Button type="submit" variant="link" className="absolute right-2 top-2">
          Search
        </Button>
      </div>
    </form>
  );
}
