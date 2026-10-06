import { CoverImage } from "@/components/web/CoverImage";
import { cn } from "@/lib/utils";

/** The published cover ratio. Written once; every cover surface reads it. */
export const POST_COVER_ASPECT = "aspect-[16/9]";

type PostCoverProps = {
  src?: string | null;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
};

/**
 * The published cover frame: one ratio, one clip, one loading hint. The reader
 * hero and the Review cover both render through this, so a future crop or focal
 * point has a single seam to change. Server-component safe. A caller's layout
 * classes pass through, but a conflicting `aspect-*` cannot override the
 * published ratio: the ratio is applied last. The frame intentionally has no
 * height cap: reducing its height would crop a 16:9 source into a different
 * visible composition in both the reader and Review.
 */
export function PostCover({
  src,
  alt,
  sizes = "(max-width: 1280px) 100vw, 1216px",
  priority = false,
  className,
  imageClassName,
}: PostCoverProps) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden",
        className,
        POST_COVER_ASPECT,
      )}
    >
      <CoverImage
        src={src}
        alt={alt}
        sizes={sizes}
        priority={priority}
        className={cn("object-cover", imageClassName)}
      />
    </div>
  );
}
