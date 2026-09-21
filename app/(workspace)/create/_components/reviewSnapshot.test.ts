import { describe, expect, it } from "vitest";
import {
  buildSnapshotSubmission,
  captureReviewedSnapshot,
  resolveCoverIntent,
} from "./reviewSnapshot";
import type { CanonicalProposal } from "@/lib/write-contract";
import type { BlockNoteDocument } from "@/lib/post-content";

const document: BlockNoteDocument = {
  format: "blocknote@1",
  blocks: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Reviewed body long enough." }],
    },
  ],
};

const proposal: CanonicalProposal = {
  title: "Reviewed",
  body: JSON.stringify(document),
  tags: ["Design"],
};

describe("captureReviewedSnapshot", () => {
  it("copies content, cover intent, cover preview, and inline media", () => {
    const snapshot = captureReviewedSnapshot(
      proposal,
      { selectedFile: undefined, existingStorageId: undefined, removed: false },
      {
        coverPreviewUrl: "blob:cover",
        inlineImages: [{ storageId: "s1", url: "https://cdn/s1.png" }],
      },
    );

    expect(snapshot.title).toBe("Reviewed");
    expect(snapshot.body).toBe(proposal.body);
    expect(snapshot.tags).toEqual(["Design"]);
    expect(snapshot.cover).toEqual({ kind: "default" });
    expect(snapshot.coverPreviewUrl).toBe("blob:cover");
    expect(snapshot.inlineImages).toEqual([
      { storageId: "s1", url: "https://cdn/s1.png" },
    ]);
  });

  it("does not alias the proposal tag array", () => {
    const snapshot = captureReviewedSnapshot(
      proposal,
      { selectedFile: undefined, existingStorageId: undefined, removed: false },
      { inlineImages: [] },
    );
    snapshot.tags.push("Extra");
    expect(proposal.tags).toEqual(["Design"]);
  });
});

describe("resolveCoverIntent", () => {
  it("prefers a newly selected file over everything else", () => {
    const file = new File(["x"], "cover.png", { type: "image/png" });
    expect(
      resolveCoverIntent({
        selectedFile: file,
        existingStorageId: "storage-1",
        removed: true,
      }),
    ).toEqual({ kind: "new", file });
  });

  it("treats an explicit removal as removal even when a cover existed", () => {
    expect(
      resolveCoverIntent({
        selectedFile: undefined,
        existingStorageId: "storage-1",
        removed: true,
      }),
    ).toEqual({ kind: "removed" });
  });

  it("keeps an existing stored cover when nothing changed", () => {
    expect(
      resolveCoverIntent({
        selectedFile: undefined,
        existingStorageId: "storage-1",
        removed: false,
      }),
    ).toEqual({ kind: "existing", storageId: "storage-1" });
  });
});

describe("buildSnapshotSubmission", () => {
  it("parses the reviewed body and carries a selected cover file", () => {
    const file = new File(["x"], "cover.png", { type: "image/png" });
    const snapshot = captureReviewedSnapshot(
      proposal,
      { selectedFile: file, existingStorageId: undefined, removed: false },
      { coverPreviewUrl: "blob:cover", inlineImages: [] },
    );

    const submission = buildSnapshotSubmission(snapshot);

    expect(submission.title).toBe("Reviewed");
    expect(submission.body).toBe(proposal.body);
    expect(submission.content).toEqual(document);
    expect(submission.tags).toEqual(["Design"]);
    expect(submission.coverFile).toBe(file);
    expect(submission.existingCoverStorageId).toBeUndefined();
  });

  it("carries an existing cover and no file when nothing changed", () => {
    const snapshot = captureReviewedSnapshot(
      proposal,
      {
        selectedFile: undefined,
        existingStorageId: "storage-1",
        removed: false,
      },
      { inlineImages: [] },
    );

    const submission = buildSnapshotSubmission(snapshot);

    expect(submission.existingCoverStorageId).toBe("storage-1");
    expect(submission.coverFile).toBeUndefined();
  });

  it("falls back to no cover after removal", () => {
    const snapshot = captureReviewedSnapshot(
      proposal,
      {
        selectedFile: undefined,
        existingStorageId: "storage-1",
        removed: true,
      },
      { inlineImages: [] },
    );

    const submission = buildSnapshotSubmission(snapshot);

    expect(submission.coverFile).toBeUndefined();
    expect(submission.existingCoverStorageId).toBeUndefined();
  });
});
