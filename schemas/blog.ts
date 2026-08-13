import z from "zod";
import { POST_TAGS } from "@/lib/constants/post-tags";
import {
  MAX_POST_TEXT_LENGTH,
  MIN_POST_TEXT_LENGTH,
  extractPlainText,
  isValidBlockNoteDoc,
  type BlockNoteDocument,
} from "@/lib/post-content";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const postTagsSchema = z
  .array(z.enum(POST_TAGS))
  .max(5, "Choose up to 5 tags.")
  .refine((tags) => new Set(tags).size === tags.length, {
    message: "Choose each tag only once.",
  })
  .default([]);

export const postSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.custom<BlockNoteDocument>(
    (value): value is BlockNoteDocument => {
      if (
        typeof value !== "object" ||
        value === null ||
        !Object.hasOwn(value, "format") ||
        !Object.hasOwn(value, "blocks") ||
        (value as { format?: unknown }).format !== "blocknote@1"
      ) {
        return false;
      }

      const document = value as BlockNoteDocument;
      if (!isValidBlockNoteDoc(document.blocks)) return false;

      const textLength = extractPlainText(document.blocks).trim().length;
      return (
        textLength >= MIN_POST_TEXT_LENGTH &&
        textLength <= MAX_POST_TEXT_LENGTH
      );
    },
    "Content must contain between 10 and 50,000 readable characters.",
  ),
  tags: postTagsSchema,
  image: z
    .instanceof(File, { message: "Please select an image file." })
    .refine((file) => file.size <= MAX_IMAGE_SIZE_BYTES, {
      message: "Image must be 5MB or smaller.",
    })
    .refine((file) => ALLOWED_IMAGE_TYPES.includes(file.type), {
      message: "Only JPG, PNG, and WEBP images are supported.",
    })
    // Image is optional so users can create text-only posts.
    .optional(),
});
