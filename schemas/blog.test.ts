import { describe, expect, it } from "vitest";
import { postSchema } from "@/schemas/blog";
import {
  BLOCKNOTE_FORMAT,
  MIN_POST_TEXT_LENGTH,
  MAX_POST_TEXT_LENGTH,
} from "@/lib/post-content";

const makeFile = (size = 1024, type = "image/png") =>
  new File([new Uint8Array(size)], "image.png", { type });

const validContent = {
  format: BLOCKNOTE_FORMAT,
  blocks: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "This is valid content." }],
    },
  ],
};

describe("blog schema", () => {
  it("accepts a valid payload", () => {
    const result = postSchema.safeParse({
      title: "Hello",
      content: validContent,
      image: makeFile(2048, "image/png"),
    });

    expect(result.success).toBe(true);
  });

  it("rejects unsupported image type", () => {
    const result = postSchema.safeParse({
      title: "Hello",
      content: validContent,
      image: makeFile(2048, "image/gif"),
    });

    expect(result.success).toBe(false);
  });

  it("rejects oversized images", () => {
    const result = postSchema.safeParse({
      title: "Hello",
      content: validContent,
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
          content: validContent,
          tags,
        }).success,
      ).toBe(true);
    }
  });

  it("defaults omitted tags to an empty array", () => {
    const result = postSchema.safeParse({
      title: "Hello",
      content: validContent,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toEqual([]);
    }
  });

  it("rejects unknown, duplicate, and sixth tags", () => {
    const base = { title: "Hello", content: validContent };

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

  it("accepts structured content and returns the envelope", () => {
    const result = postSchema.safeParse({
      title: "Hello",
      content: validContent,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.content).toEqual(validContent);
    }
  });

  it("rejects empty and short structured content", () => {
    for (const content of [
      { format: BLOCKNOTE_FORMAT, blocks: [] },
      {
        format: BLOCKNOTE_FORMAT,
        blocks: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "short" }],
          },
        ],
      },
      {
        format: BLOCKNOTE_FORMAT,
        blocks: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "   " }],
          },
        ],
      },
    ]) {
      expect(postSchema.safeParse({ title: "Hello", content }).success).toBe(
        false,
      );
    }
  });

  it("rejects structured content over the derived text limit", () => {
    const content = {
      format: BLOCKNOTE_FORMAT,
      blocks: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "x".repeat(MAX_POST_TEXT_LENGTH + 1),
            },
          ],
        },
      ],
    };

    expect(postSchema.safeParse({ title: "Hello", content }).success).toBe(
      false,
    );
  });

  it("counts image captions but not alt text as readable content", () => {
    const content = {
      format: BLOCKNOTE_FORMAT,
      blocks: [
        {
          type: "image",
          props: {
            storageId: "storage-1",
            altText: "This alt text must not count",
            caption: "This caption counts as readable content.",
          },
        },
      ],
    };

    expect(postSchema.safeParse({ title: "Hello", content }).success).toBe(
      true,
    );
  });

  it("rejects legacy plain-text content for new posts", () => {
    const content = "This is a legacy plain-text body that is long enough.";

    expect(postSchema.safeParse({ title: "Hello", content }).success).toBe(
      false,
    );
  });

  it("rejects envelopes without the blocknote discriminator or blocks", () => {
    for (const content of [
      { blocks: [] },
      { format: "other@1", blocks: [] },
      { format: BLOCKNOTE_FORMAT },
    ]) {
      expect(postSchema.safeParse({ title: "Hello", content }).success).toBe(
        false,
      );
    }
  });

  it("accepts content at the exact minimum readable length", () => {
    const content = {
      format: BLOCKNOTE_FORMAT,
      blocks: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "x".repeat(MIN_POST_TEXT_LENGTH) }],
        },
      ],
    };

    expect(postSchema.safeParse({ title: "Hello", content }).success).toBe(
      true,
    );
  });
});
