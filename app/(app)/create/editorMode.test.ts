import { describe, expect, it } from "vitest";
import { getEditorCapabilities, resolveEditorMode } from "./editorMode";

describe("resolveEditorMode", () => {
  it.each([
    [{}, "new"],
    [{ draftId: "draft-1" }, "draft"],
    [{ editPostId: "post-1" }, "published-edit"],
  ])("resolves %s", (params, mode) => {
    expect(resolveEditorMode(params)).toEqual({
      mode,
      id: Object.values(params)[0],
    });
  });

  it("rejects a request containing both target parameters", () => {
    expect(
      resolveEditorMode({ draftId: "draft-1", editPostId: "post-1" }),
    ).toEqual({ mode: "invalid" });
  });
});

describe("getEditorCapabilities", () => {
  it.each([
    ["new", { canSaveDraft: true, canPublish: true, canUpdate: false }],
    ["draft", { canSaveDraft: true, canPublish: true, canUpdate: false }],
    [
      "published-edit",
      { canSaveDraft: false, canPublish: false, canUpdate: true },
    ],
  ])("returns capabilities for %s", (mode, capabilities) => {
    expect(
      getEditorCapabilities(
        mode as Parameters<typeof getEditorCapabilities>[0],
      ),
    ).toEqual(capabilities);
  });
});
