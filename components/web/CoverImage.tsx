import Image from "next/image";
import { resolveCoverUrl } from "@/lib/cover";
import { cn } from "@/lib/utils";

type CoverImageProps = {
  src?: string | null;
  alt: string;
  sizes?: string;
  className?: string;
  priority?: boolean;
};

/**
 * Renders a custom cover or the local default. Server-component safe: no hooks,
 * no client directive. The default is decorative and never persisted.
 */
export function CoverImage({
  src,
  alt,
  sizes = "100vw",
  className,
  priority = false,
}: CoverImageProps) {
  const resolved = resolveCoverUrl(src);

  if (resolved) {
    return (
      <Image
        src={resolved}
        alt={alt}
        fill
        sizes={sizes}
        className={className}
        priority={priority}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      data-testid="default-cover"
      className={cn("absolute inset-0 border-b border-border", className)}
    />
  );
}
