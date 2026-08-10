import z from "zod";
import { POST_TAGS } from "@/lib/constants/post-tags";

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
  content: z.string().min(10),
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
