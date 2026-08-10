import Link from "next/link";

interface TagPillProps {
  tag: string;
}

export function TagPill({ tag }: TagPillProps) {
  return (
    <Link
      href={`/blog?tag=${encodeURIComponent(tag)}`}
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
    >
      {tag}
    </Link>
  );
}
