export const POST_TAGS = [
  "Technology",
  "Design",
  "Culture",
  "Science",
  "Business",
  "Music",
  "Tutorial",
  "Theory",
  "Architectural",
  "Landscape",
  "Photography",
  "Software",
  "Hardware",
  "Camera",
  "Nature",
] as const;

export type PostTag = (typeof POST_TAGS)[number];

export const MAX_POST_TAGS = 5;

/**
 * Determines whether a value is a canonical post tag.
 *
 * @param value - The value to check
 * @returns `true` if the value is a canonical post tag, `false` otherwise.
 */
export function isCanonicalPostTag(value: string): value is PostTag {
  return (POST_TAGS as readonly string[]).includes(value);
}

/**
 * Determines whether a list contains valid canonical post tags.
 *
 * @param tags - The post tags to validate
 * @returns `true` if the list contains at most five unique canonical tags, `false` otherwise.
 */
export function isValidPostTags(tags: readonly string[]): boolean {
  return (
    tags.length <= MAX_POST_TAGS &&
    new Set(tags).size === tags.length &&
    tags.every(isCanonicalPostTag)
  );
}
