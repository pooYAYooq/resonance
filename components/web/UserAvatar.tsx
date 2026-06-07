"use client";

import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { hashUserId } from "@/lib/avatar";

interface UserAvatarProps {
  /**
   * Unique identifier for the user. Used as a deterministic seed for the
   * auto-generated avatar image so the same user always receives the same
   * visual. The raw value is hashed before being sent to the external avatar
   * service to avoid leaking internal identifiers.
   */
  userId: string;

  /**
   * Display name of the user. Rendered as a fallback when the avatar image
   * fails to load and also used for the image's `alt` attribute.
   */
  name: string;

  /**
   * Optional avatar URL from an OAuth provider. When provided, this takes
   * precedence over the auto-generated DiceBear avatar.
   */
  avatarUrl?: string | null;

  /**
   * Optional additional CSS classes for the outer `<Avatar>` wrapper.
   */
  className?: string;
}

/**
 * Renders a user's avatar using DiceBear auto-generated SVGs.
 *
 * The image URL is built deterministically from a one-way hash of `userId`,
 * which means the same user always gets the same avatar across renders and
 * sessions without exposing the raw internal identifier to the external
 * service. If the external service is unreachable or the request fails, the
 * component falls back to displaying the first two characters of `name` in
 * uppercase inside a muted circle.
 *
 * If `name` is empty or contains only whitespace, the fallback displays "?"
 * and the image `alt` attribute falls back to "User avatar" for accessibility.
 *
 * @example
 * ```tsx
 * <UserAvatar userId="user-123" name="Jane Doe" className="size-10" />
 * ```
 */
export function UserAvatar({ userId, name, avatarUrl, className }: UserAvatarProps) {
  const safeName = name.trim();
  const displayName = safeName || "User";
  const initials = safeName ? safeName.slice(0, 2).toUpperCase() : "?";
  const seed = hashUserId(userId);

  const diceBearUrl = `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(seed)}&scale=90`;
  const imageSrc = avatarUrl || diceBearUrl;

  return (
    <Avatar className={className}>
      <AvatarImage
        src={imageSrc}
        alt={`${displayName} avatar`}
      />
      <AvatarFallback className="font-extrabold text-primary">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
