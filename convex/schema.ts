import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// This file defines the schema for our Convex database.
export default defineSchema({
  posts: defineTable({
    title: v.string(),
    body: v.string(),
    authorId: v.string(),
  }),
});
