/**
 * Defines the Convex database schema, including tables for posts and comments.
 * Posts store blog article content with an optional image attachment.
 * Comments are linked to posts via a foreign key (`postId`).
 */
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Root Convex schema — registers every table and its validated fields.
 * Convex enforces these validators on insert and uses them to
 * generate TypeScript types in `_generated/dataModel.d.ts`.
 */
export default defineSchema({
  posts: defineTable({
    title: v.string(),
    body: v.string(),
    authorId: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    commentCount: v.number(),
  }),
  comments: defineTable({
    postId: v.id("posts"),
    authorId: v.string(),
    authorName: v.string(),
    body: v.string(),
  }).index("by_postId", ["postId"]),
});
