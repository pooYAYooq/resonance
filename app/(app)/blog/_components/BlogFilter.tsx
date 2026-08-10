import Link from "next/link";

interface BlogFilterProps {
  tag?: string;
}

export function BlogFilter({ tag }: BlogFilterProps) {
  if (!tag) return null;

  return (
    <div className="flex items-center justify-between gap-4 border-y px-6 py-4">
      <p className="text-sm text-muted-foreground">
        Showing posts tagged{" "}
        <span className="font-medium text-foreground">{tag}</span>
      </p>
      <Link
        href="/blog"
        className="text-sm font-medium text-primary hover:underline"
      >
        Clear filter
      </Link>
    </div>
  );
}
