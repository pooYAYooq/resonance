import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PostCardCoverRatio = "3/2" | "16/9" | "fill";

const RATIO_CLASSES: Record<PostCardCoverRatio, string> = {
  "3/2": "aspect-[3/2]",
  "16/9": "aspect-video",
  fill: "h-full",
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
 * covers can use the same geometry.
 *
 * `ratio="fill"` has no intrinsic height. The surrounding layout must give the
 * frame a resolvable height, such as a grid or flex item with a defined height.
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
