/**
 * Zod schema for validating comment body text from the client.
 * Enforces body length limits (3–1000 characters).
 * `postId` is not part of this schema — it is injected from the route
 * in the submit handler and validated there.
 */

import z from "zod";

/**
 * Validates comment text (3–1000 characters).
 *
 * @returns `z.ZodObject`: parsed shape with `body` ready for the form.
 */
export const commentBodySchema = z.object({
  body: z
    .string()
    .trim()
    .min(3, "Comment must be at least 3 characters.")
    .max(1000, "Comment cannot exceed 1000 characters."),
});
