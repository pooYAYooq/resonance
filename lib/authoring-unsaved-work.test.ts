import { describe, expect, it } from "vitest";
import type { CanonicalProposal } from "./write-contract";
import {
  hasUnsavedAuthoringWork,
  isEffectivelyEmptyProposal,
} from "./authoring-unsaved-work";

const blank: CanonicalProposal = {
  title: "",
  body: JSON.stringify({ format: "blocknote@1", blocks: [] }),
  tags: [],
};
const editorBlank: CanonicalProposal = {
  ...blank,
  body: JSON.stringify({
    format: "blocknote@1",
    blocks: [
      {
        type: "paragraph",
        props: {
          backgroundColor: "default",
          textColor: "default",
          textAlignment: "left",
        },
        content: [],
      },
    ],
  }),
};

describe("meaningful unsaved authoring work", () => {
  it("does not warn about the editor's default empty paragraph", () => {
    expect(hasUnsavedAuthoringWork(editorBlank, blank)).toBe(false);
    expect(isEffectivelyEmptyProposal(editorBlank)).toBe(true);
  });

  it("does not warn when the current proposal matches the saved proposal", () => {
    const saved = { ...blank, title: "Saved" };
    expect(hasUnsavedAuthoringWork(saved, saved)).toBe(false);
  });

  it.each([
    { ...blank, title: "New writing" },
    { ...blank, tags: ["Technology"] },
    { ...blank, imageStorageId: "saved-cover" },
    {
      ...blank,
      body: JSON.stringify({
        format: "blocknote@1",
        blocks: [{ type: "divider" }],
      }),
    },
    {
      ...blank,
      body: JSON.stringify({
        format: "blocknote@1",
        blocks: [
          { type: "paragraph", content: [{ type: "text", text: "Body" }] },
        ],
      }),
    },
    {
      ...blank,
      body: JSON.stringify({
        format: "blocknote@1",
        blocks: [
          { type: "paragraph", props: { backgroundColor: "red" }, content: [] },
        ],
      }),
    },
  ])("keeps actual authored work meaningful: %j", (proposal) => {
    expect(hasUnsavedAuthoringWork(proposal, blank)).toBe(true);
    expect(isEffectivelyEmptyProposal(proposal)).toBe(false);
  });

  it("detects removing the saved cover even when the rest of the post is blank", () => {
    expect(
      hasUnsavedAuthoringWork(blank, {
        ...blank,
        imageStorageId: "saved-cover",
      }),
    ).toBe(true);
  });

  it("treats an unparseable body as work, not an empty editor", () => {
    const invalid = { ...blank, body: "invalid body" };
    expect(isEffectivelyEmptyProposal(invalid)).toBe(false);
    expect(hasUnsavedAuthoringWork(invalid, blank)).toBe(true);
  });
});
