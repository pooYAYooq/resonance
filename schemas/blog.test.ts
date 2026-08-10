import { describe, expect, it } from "vitest";
import { postSchema } from "@/schemas/blog";

const makeFile = (size = 1024, type = "image/png") =>
  new File([new Uint8Array(size)], "image.png", { type });

describe("blog schema", () => {
  it("accepts a valid payload", () => {
    const result = postSchema.safeParse({
      title: "Hello",
      content: "This is long enough content.",
      image: makeFile(2048, "image/png"),
    });

    expect(result.success).toBe(true);
  });

  it("rejects unsupported image type", () => {
    const result = postSchema.safeParse({
      title: "Hello",
      content: "This is long enough content.",
      image: makeFile(2048, "image/gif"),
    });

    expect(result.success).toBe(false);
  });

  it("rejects oversized images", () => {
    const result = postSchema.safeParse({
      title: "Hello",
      content: "This is long enough content.",
      image: makeFile(6 * 1024 * 1024, "image/png"),
    });

    expect(result.success).toBe(false);
  });

  it("accepts zero, one, and five canonical tags", () => {
    for (const tags of [
      [],
      ["Technology"],
      ["Technology", "Design", "Music", "Theory", "Landscape"],
    ]) {
      expect(
        postSchema.safeParse({
          title: "Hello",
          content: "This is long enough content.",
          tags,
        }).success,
      ).toBe(true);
    }
  });

  it("defaults omitted tags to an empty array", () => {
    const result = postSchema.safeParse({
      title: "Hello",
      content: "This is long enough content.",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toEqual([]);
    }
  });

  it("rejects unknown, duplicate, and sixth tags", () => {
    const base = { title: "Hello", content: "This is long enough content." };

    expect(postSchema.safeParse({ ...base, tags: ["Unknown"] }).success).toBe(
      false,
    );
    expect(
      postSchema.safeParse({ ...base, tags: ["Technology", "Technology"] })
        .success,
    ).toBe(false);
    expect(
      postSchema.safeParse({
        ...base,
        tags: [
          "Technology",
          "Design",
          "Music",
          "Theory",
          "Architectural",
          "Science",
        ],
      }).success,
    ).toBe(false);
  });
});
