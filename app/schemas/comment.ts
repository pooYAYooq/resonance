/**
 * Zod schema for validating comment submissions from the client.
 * Enforces body length limits and requires a valid Convex post ID.
 */

import { Id } from "@/convex/_generated/dataModel";
import z from "zod";

/**
 * Validates comment text (3–1000 characters) and requires a valid `posts` document ID.
 *
 * @returns `z.ZodObject`: parsed shape with `body` and `postId` ready for the `createComment` mutation.
 */
export const commentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(3, "Comment must be at least 3 characters.")
    .max(1000, "Comment cannot exceed 1000 characters."),
  postId: z.custom<Id<"posts">>(),
});
