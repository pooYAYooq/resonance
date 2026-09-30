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
 * point has a single seam to change. Server-component safe.
 *
 * The height cap keeps a header-aligned hero from becoming a wall. It is
 * viewport-height aware, not a flat pixel ceiling: both an HD and an FHD window
 * give the same 1216px container, so only window height separates them. The hero
 * is never taller than 40% of the window and never taller than 560px, which
 * keeps the first lines of the body above the fold on short screens while an
 * exact 16:9 frame survives wherever the cap does not bind.
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
        "relative w-full max-h-[min(560px,40dvh)] overflow-hidden",
        POST_COVER_ASPECT,
        className,
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
