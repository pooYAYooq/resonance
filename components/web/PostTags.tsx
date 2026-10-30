import { isCanonicalPostTag } from "@/lib/constants/post-tags";
import { cn } from "@/lib/utils";
import { TagPill } from "./TagPill";

type PostTagsProps = {
  tags: string[];
  filterCanonical?: boolean;
  className?: string;
};

export function PostTags({
  tags,
  filterCanonical = false,
  className,
}: PostTagsProps) {
  const visible = filterCanonical ? tags.filter(isCanonicalPostTag) : tags;
  if (visible.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {visible.map((tag) => (
        <TagPill key={tag} tag={tag} />
      ))}
    </div>
  );
}
