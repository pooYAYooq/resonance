import { describe, expect, it } from "vitest";
import { getCodePointCount } from "./post-content";
import type { BlockNoteDocument } from "./post-content";

function getSerializedByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function bodyWithSerializedByteLength(targetBytes: number): BlockNoteDocument {
  const document: BlockNoteDocument = {
    format: "blocknote@1",
    blocks: [
      {
        type: "paragraph",
        content: Array.from({ length: 250 }, () => ({
          type: "link" as const,
          href: "",
          content: [{ type: "text" as const, text: "" }],
        })),
      },
    ],
  };
  let remainingBytes = targetBytes - getSerializedByteLength(document);

  for (const inline of document.blocks[0].content ?? []) {
    if (remainingBytes === 0) break;
    if (
      typeof inline !== "object" ||
      inline === null ||
      inline.type !== "link"
    ) {
      continue;
    }

    const emojiCount = Math.min(2_048, Math.floor(remainingBytes / 4));
    const asciiCount = Math.min(
      2_048 - emojiCount,
      remainingBytes - emojiCount * 4,
    );
    inline.href = `${"😀".repeat(emojiCount)}${"x".repeat(asciiCount)}`;
    remainingBytes -= emojiCount * 4 + asciiCount;
  }

  if (remainingBytes !== 0) {
    throw new Error(
      "Fixture cannot reach the requested serialized byte length.",
    );
  }
  expect(getSerializedByteLength(document)).toBe(targetBytes);
  return document;
}

const document = {
  format: "blocknote@1",
  blocks: [
    {
      type: "paragraph",
      content: [
        {
          type: "link",
          href: "javascript:alert(1)",
          content: [{ type: "text", text: "bonjour   monde" }],
        },
        { type: "text", text: " 😀" },
      ],
      children: [
        {
          type: "image",
          props: {
            storageId: "image-1",
            altText: "alt",
            caption: "caption",
          },
        },
      ],
    },
  ],
} satisfies BlockNoteDocument;

describe("post capacity", () => {
  it("truncates provider author names by Unicode code point", async () => {
    const capacity = await import("./post-capacity");

    expect(capacity.truncatePostAuthorName("😀".repeat(101))).toBe(
      "😀".repeat(100),
    );
    expect(capacity.truncatePostAuthorName("Ada Lovelace")).toBe(
      "Ada Lovelace",
    );
  });

  it("measures canonical text and recursive structure without extracting URLs", async () => {
    const capacity = await import("./post-capacity").catch(() => null);

    expect(capacity).not.toBeNull();
    if (!capacity) return;

    expect(capacity.measurePostContent(document)).toMatchObject({
      textCodePoints: 23,
      blockCount: 2,
      inlineNodeCount: 3,
      maxDepth: 1,
      maxChildWidth: 1,
      imageReferenceCount: 1,
      urlCodePoints: 19,
      altTextCodePoints: 3,
      captionCodePoints: 7,
    });
  });

  it("returns typed errors for exact and one-over text, URL, and source-byte limits", async () => {
    const capacity = await import("./post-capacity");
    const validatePostCapacity = (capacity as Record<string, unknown>)[
      "validatePostCapacity"
    ];

    expect(typeof validatePostCapacity).toBe("function");
    if (typeof validatePostCapacity !== "function") return;

    const atTextLimit = {
      format: "blocknote@1" as const,
      blocks: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "x".repeat(150_000) }],
        },
      ],
    } satisfies BlockNoteDocument;
    const overTextLimit = {
      ...atTextLimit,
      blocks: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "x".repeat(150_001) }],
        },
      ],
    } satisfies BlockNoteDocument;
    const overUrlLimit = {
      format: "blocknote@1" as const,
      blocks: [
        {
          type: "paragraph",
          content: [
            {
              type: "link",
              href: "x".repeat(2_049),
              content: [{ type: "text", text: "label" }],
            },
          ],
        },
      ],
    } satisfies BlockNoteDocument;

    expect(validatePostCapacity(atTextLimit)).toMatchObject({ ok: true });
    expect(
      validatePostCapacity({
        format: "blocknote@1",
        blocks: [
          {
            type: "paragraph",
            content: [
              {
                type: "link",
                href: "x".repeat(2_048),
                content: [{ type: "text", text: "label" }],
              },
            ],
          },
        ],
      }),
    ).toMatchObject({ ok: true });
    expect(validatePostCapacity(overTextLimit)).toMatchObject({
      ok: false,
      error: { category: "text-code-points" },
    });
    expect(validatePostCapacity(overUrlLimit)).toMatchObject({
      ok: false,
      error: { category: "url-code-points" },
    });
    expect(
      validatePostCapacity(bodyWithSerializedByteLength(838_860)),
    ).toMatchObject({
      ok: true,
      measurements: { serializedSourceBytes: 838_860 },
    });
    expect(
      validatePostCapacity(bodyWithSerializedByteLength(838_861)),
    ).toMatchObject({
      ok: false,
      error: { category: "source-bytes" },
      measurements: { serializedSourceBytes: 838_861 },
    });
  });

  it("enforces final-document and separate Search-corpus byte budgets", async () => {
    const {
      MAX_POST_CORPUS_BYTES,
      MAX_POST_FINAL_DOCUMENT_BYTES,
      measurePostCorpus,
      validatePostCapacity,
    } = await import("./post-capacity");
    const body = "Multilingual العربية 日本語 हिन्दी 😀";
    const corpus = measurePostCorpus({
      postId: "post-1",
      title: "A long token: " + "x".repeat(1_000),
      authorName: "Author",
      searchableText: `A long token: ${"x".repeat(1_000)}\n${body}\nAuthor`,
    });

    expect(corpus.serializedCorpusBytes).toBeGreaterThan(0);
    expect(
      validatePostCapacity(
        { format: "blocknote@1", blocks: [{ type: "paragraph", content: [] }] },
        {
          finalDocumentBytes: MAX_POST_FINAL_DOCUMENT_BYTES,
          corpus: {
            postId: "post-1",
            title: "Title",
            authorId: "author-1",
            authorName: "Author",
            searchableText: "Title\nBody\nAuthor",
          },
        },
      ),
    ).toMatchObject({ ok: true });
    expect(
      validatePostCapacity(
        { format: "blocknote@1", blocks: [{ type: "paragraph", content: [] }] },
        { finalDocumentBytes: MAX_POST_FINAL_DOCUMENT_BYTES + 1 },
      ),
    ).toMatchObject({
      ok: false,
      error: { category: "final-document-bytes" },
    });
    expect(
      validatePostCapacity(
        { format: "blocknote@1", blocks: [{ type: "paragraph", content: [] }] },
        {
          corpus: {
            postId: "post-1",
            title: "x".repeat(MAX_POST_CORPUS_BYTES),
            authorId: "author-1",
            authorName: "Author",
            searchableText: "Body\nAuthor",
          },
        },
      ),
    ).toMatchObject({
      ok: false,
      error: { category: "corpus-bytes" },
    });
  });

  it("measures a representative maximum-length Search record shape", async () => {
    const { MAX_POST_CORPUS_BYTES, measurePostCorpus } =
      await import("./post-capacity");
    const bodyText = `${"a".repeat(149_900)} العربية 日本語 हिन्दी`;
    const title = "Multilingual long-form title";
    const authorName = "Author with a long-token handle";
    const corpus = measurePostCorpus({
      postId: "post-representative",
      title,
      authorId: "author-representative",
      authorName,
      searchableText: `${title}\n${bodyText}\n${authorName}`,
    });

    expect(corpus.serializedCorpusBytes).toBeLessThan(MAX_POST_CORPUS_BYTES);
    expect(corpus.serializedCorpusBytes).toBeGreaterThan(150_000);
  });

  it("measures the exact persisted Search record field names", async () => {
    const { measurePostCorpus } = await import("./post-capacity");
    const input = {
      postId: "post-1",
      title: "Title",
      authorId: "author-1",
      authorName: "Author",
      searchableText: "Title\nBody\nAuthor",
    };
    const persistedRecord = {
      postId: "post-1",
      title: "Title",
      authorId: "author-1",
      authorName: "Author",
      searchableText: "Title\nBody\nAuthor",
    };

    expect(measurePostCorpus(input).serializedCorpusBytes).toBe(
      getSerializedByteLength(persistedRecord),
    );
  });

  it("keeps a 150,000-code-point Japanese body within the slim Search budget", async () => {
    const { MAX_POST_CORPUS_BYTES, measurePostCorpus } =
      await import("./post-capacity");
    const bodyText = "界".repeat(150_000);
    const title = "Japanese capacity boundary";
    const authorName = "Ada Lovelace";
    const corpus = measurePostCorpus({
      postId: "post-japanese-boundary",
      title,
      authorId: "author-1",
      authorName,
      searchableText: `${title}\n${bodyText}\n${authorName}`,
    });

    expect(corpus.serializedCorpusBytes).toBeLessThanOrEqual(
      MAX_POST_CORPUS_BYTES,
    );
    expect(corpus.serializedCorpusBytes).toBeGreaterThan(450_000);
  });

  it("reserves enough bytes for a 100-code-point JSON-escaped rename", async () => {
    const { MAX_POST_CORPUS_RENAME_RESERVE_BYTES, measurePostCorpus } =
      await import("./post-capacity");
    const bodyText = "A body near the Search budget";
    const title = "A valid title";
    const searchable = (authorName: string) =>
      `${title}\n${bodyText}\n${authorName}`;
    const before = measurePostCorpus({
      postId: "post-rename",
      title,
      authorId: "author-1",
      authorName: "A",
      searchableText: searchable("A"),
    });
    const after = measurePostCorpus({
      postId: "post-rename",
      title,
      authorId: "author-1",
      authorName: "\u0000".repeat(100),
      searchableText: searchable("\u0000".repeat(100)),
    });

    expect(
      after.serializedCorpusBytes - before.serializedCorpusBytes,
    ).toBeLessThanOrEqual(MAX_POST_CORPUS_RENAME_RESERVE_BYTES);
  });

  it("checks the complete final post shape independently from source bytes", async () => {
    const {
      MAX_POST_FINAL_DOCUMENT_BYTES,
      measurePostContent,
      validatePostCapacity,
    } = await import("./post-capacity");
    const sourceDocument = bodyWithSerializedByteLength(838_700);
    const finalDocument = {
      title: "A long-form title",
      body: JSON.stringify(sourceDocument),
      tags: ["Technology"],
      authorId: "author-1",
      status: "published",
      publishedAt: 1,
      commentCount: 0,
      likeCount: 0,
      uniqueViewCount: 0,
      createdAt: 1,
      updatedAt: 1,
    };

    expect(measurePostContent(sourceDocument).serializedSourceBytes).toBe(
      838_700,
    );
    expect(
      measurePostContent(sourceDocument, { finalDocument }).finalDocumentBytes,
    ).toBeGreaterThan(MAX_POST_FINAL_DOCUMENT_BYTES);
    expect(
      validatePostCapacity(sourceDocument, { finalDocument }),
    ).toMatchObject({
      ok: false,
      error: { category: "final-document-bytes" },
    });
  });

  it("preserves rejected input and handles multilingual long-token fixtures", async () => {
    const { validatePostCapacity } = await import("./post-capacity");
    const document = {
      format: "blocknote@1" as const,
      blocks: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "العربية 日本語 " + "x".repeat(150_001) },
          ],
        },
      ],
    } satisfies BlockNoteDocument;
    const before = structuredClone(document);

    expect(validatePostCapacity(document)).toMatchObject({
      ok: false,
      error: { category: "text-code-points" },
    });
    expect(document).toEqual(before);
  });

  it("counts Unicode code points independently from grapheme clusters", () => {
    const family = "👩‍👩‍👧‍👦";
    const graphemeCount = Array.from(
      new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
        family,
      ),
    ).length;

    expect(getCodePointCount(family)).toBe(7);
    expect(graphemeCount).toBe(1);
  });

  it("classifies every independent structural and image-metadata boundary", async () => {
    const { validatePostCapacity } = await import("./post-capacity");
    const image = (altText: string, caption?: string) => ({
      type: "image",
      props: {
        storageId: crypto.randomUUID(),
        altText,
        ...(caption ? { caption } : {}),
      },
    });
    const documentWith = (
      blocks: BlockNoteDocument["blocks"],
    ): BlockNoteDocument => ({
      format: "blocknote@1",
      blocks,
    });

    expect(
      validatePostCapacity(
        documentWith([image("x".repeat(1_000), "x".repeat(5_000))]),
      ).ok,
    ).toBe(true);
    expect(
      validatePostCapacity(documentWith([image("x".repeat(1_001))])),
    ).toMatchObject({ error: { category: "alt-text-code-points" } });
    expect(
      validatePostCapacity(documentWith([image("alt", "x".repeat(5_001))])),
    ).toMatchObject({ error: { category: "caption-code-points" } });
    expect(
      validatePostCapacity(
        documentWith(
          Array.from({ length: 101 }, () => ({
            type: "paragraph",
            content: [],
          })),
        ),
      ),
    ).toMatchObject({ error: { category: "block-count" } });
    expect(
      validatePostCapacity(
        documentWith([
          {
            type: "paragraph",
            content: Array.from({ length: 501 }, () => ({
              type: "text",
              text: "",
            })),
          },
        ]),
      ),
    ).toMatchObject({ error: { category: "inline-node-count" } });
    expect(
      validatePostCapacity(
        documentWith([
          {
            type: "bulletListItem",
            content: [],
            children: Array.from({ length: 21 }, () => ({
              type: "paragraph",
              content: [],
            })),
          },
        ]),
      ),
    ).toMatchObject({ error: { category: "child-width" } });
    expect(
      validatePostCapacity(
        documentWith(Array.from({ length: 100 }, () => image("alt"))),
      ).ok,
    ).toBe(true);
    expect(
      validatePostCapacity(
        documentWith(Array.from({ length: 101 }, () => image("alt"))),
      ),
    ).toMatchObject({ error: { category: "image-reference-count" } });

    let deeplyNested: BlockNoteDocument["blocks"][number] = {
      type: "paragraph",
      content: [],
    };
    for (let depth = 0; depth < 9; depth += 1) {
      deeplyNested = {
        type: "bulletListItem",
        content: [],
        children: [deeplyNested],
      };
    }
    expect(validatePostCapacity(documentWith([deeplyNested]))).toMatchObject({
      error: { category: "depth" },
    });

    expect(
      validatePostCapacity(
        documentWith([
          {
            type: "paragraph",
            content: Array.from({ length: 500 }, () => ({
              type: "link",
              href: "x".repeat(2_048),
              content: [{ type: "text", text: "" }],
            })),
          },
        ]),
      ),
    ).toMatchObject({ error: { category: "source-bytes" } });
  });
});
