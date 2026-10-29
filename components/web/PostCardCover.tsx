import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PostCardCoverRatio = "3/2" | "16/9";

const RATIO_CLASSES: Record<PostCardCoverRatio, string> = {
  "3/2": "aspect-[3/2]",
  "16/9": "aspect-video",
};

type PostCardCoverProps = {
  ratio?: PostCardCoverRatio;
  className?: string;
  testId?: string;
  children: ReactNode;
};

/**
 * The clipped cover frame shared by post cards. The frame owns the ratio and
 * clipping; the card supplies the image so server-safe and retry-capable
 * covers can use the same geometry. Card covers keep a horizontal ratio and
 * never fill an arbitrary height.
 */
export function PostCardCover({
  ratio = "3/2",
  className,
  testId = "post-card-cover",
  children,
}: PostCardCoverProps) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "relative w-full overflow-hidden bg-muted",
        RATIO_CLASSES[ratio],
        className,
      )}
    >
      {children}
    </div>
  );
}
