import { describe, expect, it } from "vitest";
import { postSchema } from "@/app/schemas/blog";

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
});
