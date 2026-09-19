import { describe, expect, it } from "vitest";
import { normalizeHeadingLevel, normalizeHeadingLevels } from "./heading";
import type { PostBlock } from "./post-content";

describe("body heading normalization", () => {
  it.each([
    [1, 2],
    [0, 2],
    [-3, 2],
    [7, 6],
    [99, 6],
    [2, 2],
    [3, 3],
    [4, 4],
    [5, 5],
    [6, 6],
    [NaN, 2],
    [Infinity, 2],
    [2.5, 2],
    ["4", 2],
    [undefined, 2],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeHeadingLevel(input)).toBe(expected);
  });

  it("repairs nested headings without mutating input or unrelated blocks", () => {
    const paragraph = { type: "paragraph", content: "Keep me" };
    const blocks: PostBlock[] = [
      {
        type: "heading",
        props: { level: 1, textColor: "red" },
        children: [
          { type: "heading", props: { level: 7 }, content: "Nested" },
          paragraph,
        ],
      },
    ];
    const result = normalizeHeadingLevels(blocks);
    expect(result[0].props).toEqual({ level: 2, textColor: "red" });
    expect(result[0].children?.[0]).toMatchObject({
      props: { level: 6 },
      content: "Nested",
    });
    expect(result[0].children?.[1]).toBe(paragraph);
    expect(blocks[0].props?.level).toBe(1);
    expect(normalizeHeadingLevels(result)).toBe(result);
  });
});
