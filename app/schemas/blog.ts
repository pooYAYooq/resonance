import z from "zod";

export const postSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(100, "Title must be less than 100 characters"),
  content: z.string().min(10, "Content is required"),
});
