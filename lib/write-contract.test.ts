import { describe, expect, it } from "vitest";
import {
  canonicalizeProposal,
  createWriteError,
  fingerprintProposal,
  getCanonicalBodyText,
  getProposalEqualityKey,
} from "./write-contract";

const proposal = {
  title: "A considered title",
  body: JSON.stringify({
    format: "blocknote@1",
    blocks: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "A considered body." }],
      },
    ],
  }),
  tags: ["engineering", "writing"],
  imageStorageId: "storage-cover-1",
};

describe("writing proposal contract", () => {
  it("serializes a proposal with stable keys and copied tag values", () => {
    const canonical = canonicalizeProposal(proposal);
    const equalityKey = getProposalEqualityKey(proposal);

    expect(canonical).toEqual(proposal);
    expect(canonical.tags).not.toBe(proposal.tags);
    expect(JSON.parse(equalityKey)).toEqual(proposal);
    expect(Object.keys(JSON.parse(equalityKey))).toEqual([
      "title",
      "body",
      "tags",
      "imageStorageId",
    ]);
  });

  it("omits an absent cover image from the canonical proposal", () => {
    expect(
      getProposalEqualityKey({
        title: "Title",
        body: proposal.body,
        tags: [],
      }),
    ).toBe(
      `{"title":"Title","body":${JSON.stringify(proposal.body)},"tags":[]}`,
    );
  });

  it("changes the fingerprint when a deliberate proposal field changes", async () => {
    const original = await fingerprintProposal(proposal);
    const changed = await fingerprintProposal({
      ...proposal,
      title: "A different title",
    });

    expect(original).toMatch(/^[0-9a-f]{64}$/);
    expect(changed).toMatch(/^[0-9a-f]{64}$/);
    expect(changed).not.toBe(original);
  });

  it("represents errors with a stable category and message", () => {
    expect(
      createWriteError("conflict", "The document changed elsewhere."),
    ).toEqual({
      category: "conflict",
      message: "The document changed elsewhere.",
    });
  });

  it("extracts canonical readable body text and rejects invalid bodies", () => {
    expect(getCanonicalBodyText(proposal.body)).toBe("A considered body.");
    expect(getCanonicalBodyText("not a BlockNote document")).toBeNull();
  });

  it("uses the same equality key for equivalent persisted baselines", () => {
    const baseline = canonicalizeProposal(proposal);
    const current = {
      title: baseline.title,
      body: baseline.body,
      tags: [...baseline.tags],
      imageStorageId: baseline.imageStorageId,
    };

    expect(getProposalEqualityKey(current)).toBe(
      getProposalEqualityKey(baseline),
    );
  });
});
