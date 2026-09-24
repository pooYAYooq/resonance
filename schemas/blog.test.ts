import { describe, expect, it } from "vitest";
import { draftPostSchema, publishPostSchema } from "./blog";

const emptyDocument = { format: "blocknote@1" as const, blocks: [] };

function bodyWithText(text: string) {
  return {
    format: "blocknote@1" as const,
    blocks: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  };
}

describe("blog form schemas", () => {
  it("accepts incomplete drafts but rejects malformed content", () => {
    expect(
      draftPostSchema.safeParse({
        title: "",
        content: emptyDocument,
        tags: [],
        image: undefined,
      }).success,
    ).toBe(true);
    expect(
      draftPostSchema.safeParse({
        title: "x".repeat(101),
        content: emptyDocument,
        tags: [],
      }).success,
    ).toBe(false);
    expect(
      draftPostSchema.safeParse({
        title: "Draft",
        content: { format: "blocknote@1", blocks: [{ type: "unknown" }] },
        tags: [],
      }).success,
    ).toBe(false);
  });

  it("enforces publish title and readable-text boundaries", () => {
    expect(
      publishPostSchema.safeParse({
        title: "",
        content: emptyDocument,
        tags: [],
      }).success,
    ).toBe(false);
    expect(
      publishPostSchema.safeParse({
        title: "Post",
        content: bodyWithText("x".repeat(9)),
        tags: [],
      }).success,
    ).toBe(false);
    expect(
      publishPostSchema.safeParse({
        title: "Post",
        content: bodyWithText("x".repeat(10)),
        tags: [],
      }).success,
    ).toBe(true);
    expect(
      publishPostSchema.safeParse({
        title: "Post",
        content: bodyWithText("x".repeat(50_000)),
        tags: [],
      }).success,
    ).toBe(true);
  });

  it("uses Unicode code points instead of UTF-16 length for the body limit", () => {
    expect(
      draftPostSchema.safeParse({
        title: "Draft",
        content: bodyWithText(`${"x".repeat(149_999)}😀`),
        tags: [],
      }).success,
    ).toBe(true);
  });

  it("trims titles and rejects whitespace-only published titles", () => {
    const draft = draftPostSchema.safeParse({
      title: "  Draft title  ",
      content: emptyDocument,
      tags: [],
    });
    expect(draft.success).toBe(true);
    if (draft.success) expect(draft.data.title).toBe("Draft title");

    expect(
      publishPostSchema.safeParse({
        title: "   ",
        content: bodyWithText("Long enough body text"),
        tags: [],
      }).success,
    ).toBe(false);

    const published = publishPostSchema.safeParse({
      title: "  Published title  ",
      content: bodyWithText("Long enough body text"),
      tags: [],
    });
    expect(published.success).toBe(true);
    if (published.success) expect(published.data.title).toBe("Published title");
  });

  it("rejects image metadata beyond the shared capacity limit", () => {
    expect(
      draftPostSchema.safeParse({
        title: "Draft",
        content: {
          format: "blocknote@1",
          blocks: [
            {
              type: "image",
              props: {
                storageId: "image-1",
                altText: "x".repeat(1_001),
              },
            },
          ],
        },
        tags: [],
      }).success,
    ).toBe(false);
  });
});
