import Image from "next/image";
import { resolveCoverUrl } from "@/lib/cover";

type CoverImageProps = {
  src?: string | null;
  alt: string;
  sizes?: string;
  className?: string;
  priority?: boolean;
};

/**
 * Renders a custom cover or the blank fallback. Server-component safe: no hooks,
 * no client directive. `className` applies to the custom image only; the
 * fallback is always a static blank surface that loads no image and is never
 * persisted.
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
      className="absolute inset-0 border-b border-border"
    />
  );
}
