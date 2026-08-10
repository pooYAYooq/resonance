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

export function isCanonicalPostTag(value: string): value is PostTag {
  return (POST_TAGS as readonly string[]).includes(value);
}

export function isValidPostTags(tags: readonly string[]): boolean {
  return (
    tags.length <= MAX_POST_TAGS &&
    new Set(tags).size === tags.length &&
    tags.every(isCanonicalPostTag)
  );
}
