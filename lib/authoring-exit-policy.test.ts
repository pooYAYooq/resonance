import { describe, expect, it } from "vitest";
import type { CanonicalProposal } from "./write-contract";
import {
  decideAuthoringExit,
  getExitProposalKey,
  hasNativeExitRisk,
  hasUnsavedWork,
  type ExitDecision,
  type ExitIntent,
  type ExitSession,
} from "./authoring-exit-policy";

const emptyBody = JSON.stringify({ format: "blocknote@1", blocks: [] });
const defaultParagraphBody = JSON.stringify({
  format: "blocknote@1",
  blocks: [
    {
      type: "paragraph",
      content: [],
      props: {
        backgroundColor: "default",
        textColor: "default",
        textAlignment: "left",
      },
    },
  ],
});
const authoredBody = JSON.stringify({
  format: "blocknote@1",
  blocks: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Authored text", styles: {} }],
    },
  ],
});
const otherAuthoredBody = JSON.stringify({
  format: "blocknote@1",
  blocks: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Newer live text", styles: {} }],
    },
  ],
});

function proposal(
  body: string,
  extra: Partial<CanonicalProposal> = {},
): CanonicalProposal {
  return { title: "", body, tags: [], ...extra };
}

const cleanNew: ExitSession = {
  sessionKey: "new:new",
  mode: "new",
  proposal: proposal(defaultParagraphBody),
  baseline: proposal(emptyBody),
  selectedCover: false,
  pendingUploads: 0,
  failedMedia: false,
  saving: false,
  uncertain: false,
  coverRemoved: false,
};

const dirtyNew: ExitSession = {
  ...cleanNew,
  proposal: proposal(authoredBody),
};

const dirtyDraft: ExitSession = {
  ...cleanNew,
  sessionKey: "draft:d1",
  mode: "draft",
  baseline: proposal(authoredBody),
  proposal: proposal(otherAuthoredBody),
};

const dirtyPublished: ExitSession = {
  ...cleanNew,
  sessionKey: "published-edit:p1",
  mode: "published-edit",
  baseline: proposal(authoredBody),
  proposal: proposal(otherAuthoredBody),
};

const coverSelected: ExitSession = {
  ...cleanNew,
  selectedCover: true,
};

const coverRemoved: ExitSession = {
  ...cleanNew,
  coverRemoved: true,
};

const failedMedia: ExitSession = {
  ...cleanNew,
  failedMedia: true,
};

const everyIntent: ExitIntent[] = [
  { kind: "navigate", href: "/blog" },
  { kind: "history", key: "entry-1", href: "/blog" },
  {
    kind: "target",
    href: "/create?draftId=d2",
    target: { editorMode: "draft", id: "d2" },
  },
  { kind: "start-fresh" },
  { kind: "cancel-update" },
  { kind: "sign-out" },
];

describe("hasUnsavedWork", () => {
  it("does not treat an untouched blank new post as work", () => {
    expect(hasUnsavedWork(cleanNew)).toBe(false);
  });

  it.each([
    [
      "title",
      {
        ...cleanNew,
        proposal: proposal(defaultParagraphBody, { title: "Title" }),
      },
    ],
    [
      "tags",
      {
        ...cleanNew,
        proposal: proposal(defaultParagraphBody, { tags: ["Design"] }),
      },
    ],
    ["body", dirtyNew],
    ["selected cover", coverSelected],
    ["removed cover", coverRemoved],
    ["failed media", failedMedia],
    ["pending uploads", { ...cleanNew, pendingUploads: 1 }],
  ])("counts %s as unsaved work", (_label, session) => {
    expect(hasUnsavedWork(session as ExitSession)).toBe(true);
  });

  it("treats a fully reverted edit as clean again", () => {
    expect(
      hasUnsavedWork({ ...dirtyDraft, proposal: dirtyDraft.baseline! }),
    ).toBe(false);
  });

  it("treats a loading session as not yet comparable", () => {
    expect(hasUnsavedWork({ ...dirtyNew, baseline: null })).toBe(false);
  });
});

describe("hasNativeExitRisk", () => {
  it("is false for a clean session and true for unsaved work", () => {
    expect(hasNativeExitRisk(cleanNew)).toBe(false);
    expect(hasNativeExitRisk(dirtyDraft)).toBe(true);
    expect(hasNativeExitRisk(coverSelected)).toBe(true);
  });

  it("stays true for in-flight and uncertain operations", () => {
    expect(hasNativeExitRisk({ ...cleanNew, saving: true })).toBe(true);
    expect(hasNativeExitRisk({ ...cleanNew, uncertain: true })).toBe(true);
    expect(hasNativeExitRisk({ ...cleanNew, pendingUploads: 2 })).toBe(true);
  });
});

describe("getExitProposalKey", () => {
  it("is stable for equal proposals and differs on content", () => {
    expect(getExitProposalKey(proposal(authoredBody))).toBe(
      getExitProposalKey(proposal(authoredBody)),
    );
    expect(getExitProposalKey(proposal(authoredBody))).not.toBe(
      getExitProposalKey(proposal(otherAuthoredBody)),
    );
  });
});

describe("decideAuthoringExit", () => {
  it.each<[string, ExitIntent, ExitSession, ExitDecision]>([
    [
      "allows a clean new post to navigate",
      { kind: "navigate", href: "/blog" },
      cleanNew,
      { kind: "allow" },
    ],
    [
      "allows a clean draft to leave through browser history",
      { kind: "history", key: "k1", href: "/blog" },
      { ...dirtyDraft, proposal: dirtyDraft.baseline! },
      { kind: "allow" },
    ],
    [
      "silently recovers a dirty new post on app navigation",
      { kind: "navigate", href: "/blog" },
      dirtyNew,
      { kind: "recover" },
    ],
    [
      "silently recovers a dirty draft on app navigation",
      { kind: "navigate", href: "/dashboard" },
      dirtyDraft,
      { kind: "recover" },
    ],
    [
      "confirms lightly for a dirty draft on browser history",
      { kind: "history", key: "k1", href: "/blog" },
      dirtyDraft,
      { kind: "confirm", level: "light", risk: "unsaved", canSaveDraft: true },
    ],
    [
      "confirms lightly for a dirty new post on browser history",
      { kind: "history", key: "k1", href: "/blog" },
      dirtyNew,
      { kind: "confirm", level: "light", risk: "unsaved", canSaveDraft: true },
    ],
    [
      "confirms lightly for a dirty published edit on app navigation",
      { kind: "navigate", href: "/dashboard" },
      dirtyPublished,
      {
        kind: "confirm",
        level: "light",
        risk: "published-edit",
        canSaveDraft: true,
      },
    ],
    [
      "confirms lightly for a dirty published edit on browser history",
      { kind: "history", key: "k2", href: "/blog" },
      dirtyPublished,
      {
        kind: "confirm",
        level: "light",
        risk: "published-edit",
        canSaveDraft: true,
      },
    ],
    [
      "warns about an unrecoverable selected cover on app navigation",
      { kind: "navigate", href: "/blog" },
      coverSelected,
      { kind: "confirm", level: "light", risk: "cover", canSaveDraft: true },
    ],
    [
      "warns about removing the saved cover on app navigation",
      { kind: "navigate", href: "/blog" },
      coverRemoved,
      { kind: "confirm", level: "light", risk: "cover", canSaveDraft: true },
    ],
    [
      "warns about failed media on app navigation",
      { kind: "navigate", href: "/blog" },
      failedMedia,
      { kind: "confirm", level: "light", risk: "cover", canSaveDraft: true },
    ],
    [
      "confirms a dirty document switch softly",
      {
        kind: "target",
        href: "/create?draftId=d2",
        target: { editorMode: "draft", id: "d2" },
      },
      dirtyDraft,
      { kind: "confirm", level: "switch", risk: "abandon", canSaveDraft: true },
    ],
    [
      "allows a clean document switch",
      {
        kind: "target",
        href: "/create?draftId=d2",
        target: { editorMode: "draft", id: "d2" },
      },
      cleanNew,
      { kind: "allow" },
    ],
    [
      "confirms Start fresh without a draft-save shortcut",
      { kind: "start-fresh" },
      dirtyNew,
      {
        kind: "confirm",
        level: "switch",
        risk: "abandon",
        canSaveDraft: false,
      },
    ],
    [
      "allows Start fresh on a clean editor",
      { kind: "start-fresh" },
      cleanNew,
      { kind: "allow" },
    ],
    [
      "confirms Cancel update without a draft-save shortcut",
      { kind: "cancel-update" },
      dirtyPublished,
      {
        kind: "confirm",
        level: "switch",
        risk: "abandon",
        canSaveDraft: false,
      },
    ],
    [
      "strengthens sign out for a dirty new post",
      { kind: "sign-out" },
      dirtyNew,
      {
        kind: "confirm",
        level: "strong",
        risk: "sign-out",
        canSaveDraft: true,
      },
    ],
    [
      "strengthens sign out for a dirty published edit with a draft shortcut",
      { kind: "sign-out" },
      dirtyPublished,
      {
        kind: "confirm",
        level: "strong",
        risk: "sign-out",
        canSaveDraft: true,
      },
    ],
    [
      "allows a clean sign out",
      { kind: "sign-out" },
      cleanNew,
      { kind: "allow" },
    ],
  ])("%s", (_label, intent, session, expected) => {
    expect(decideAuthoringExit(intent, session)).toEqual(expected);
  });

  it.each(everyIntent)(
    "blocks $kind while the session is uncertain",
    (intent) => {
      expect(
        decideAuthoringExit(intent, { ...dirtyNew, uncertain: true }),
      ).toEqual({
        kind: "block",
        reason: "uncertain",
      });
    },
  );

  it.each(everyIntent)("blocks $kind while a save is in flight", (intent) => {
    expect(decideAuthoringExit(intent, { ...dirtyNew, saving: true })).toEqual({
      kind: "block",
      reason: "operation",
    });
  });

  it.each(everyIntent)("blocks $kind while uploads are pending", (intent) => {
    expect(
      decideAuthoringExit(intent, { ...dirtyNew, pendingUploads: 1 }),
    ).toEqual({ kind: "block", reason: "operation" });
  });

  it.each([everyIntent[0]!, everyIntent[1]!, everyIntent[5]!])(
    "blocks $kind until the baseline has loaded",
    (intent) => {
      expect(
        decideAuthoringExit(intent, { ...dirtyNew, baseline: null }),
      ).toEqual({ kind: "block", reason: "loading" });
    },
  );
});
