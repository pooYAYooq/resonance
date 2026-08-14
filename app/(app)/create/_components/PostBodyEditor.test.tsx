import { describe, expect, it } from "vitest";
import {
  editorSchema,
  getCuratedBlockTypeSelectItems,
  getCuratedSlashMenuItems,
  normalizeBlock,
} from "./PostBodyEditor";

describe("PostBodyEditor configuration", () => {
  it("keeps only the approved slash menu items", () => {
    const items = [
      { key: "heading", title: "Heading 1" },
      { key: "heading_2", title: "Heading 2" },
      { key: "heading_3", title: "Heading 3" },
      { key: "toggle_heading", title: "Toggle Heading 1" },
      { key: "emoji", title: "Emoji" },
      { key: "paragraph", title: "Paragraph" },
      { key: "code_block", title: "Code Block" },
      { key: "image", title: "Image" },
    ];

    expect(getCuratedSlashMenuItems(items)).toEqual([
      { key: "heading_2", title: "Section heading" },
      { key: "heading_3", title: "Subheading" },
      { key: "paragraph", title: "Paragraph" },
      { key: "code_block", title: "Code Block" },
      { key: "image", title: "Image" },
    ]);
  });

  it("keeps only paragraph, section, and list block types in the toolbar", () => {
    const items = [
      { name: "Paragraph", type: "paragraph" },
      { name: "Heading 1", type: "heading", props: { level: 1 } },
      {
        name: "Heading 2",
        type: "heading",
        props: { level: 2, isToggleable: false },
      },
      {
        name: "Heading 3",
        type: "heading",
        props: { level: 3, isToggleable: false },
      },
      {
        name: "Toggle Heading 2",
        type: "heading",
        props: { level: 2, isToggleable: true },
      },
      { name: "Quote", type: "quote" },
      { name: "Bullet List", type: "bulletListItem" },
      { name: "Numbered List", type: "numberedListItem" },
      { name: "Code block", type: "codeBlock" },
      { name: "Image", type: "image" },
      { name: "Check List", type: "checkListItem" },
    ];

    expect(getCuratedBlockTypeSelectItems(items)).toEqual([
      { name: "Paragraph", type: "paragraph" },
      { name: "Section heading", type: "heading", props: { level: 2 } },
      { name: "Subheading", type: "heading", props: { level: 3 } },
      { name: "Quote", type: "quote" },
      { name: "Bullet List", type: "bulletListItem" },
      { name: "Numbered List", type: "numberedListItem" },
      { name: "Code block", type: "codeBlock" },
      { name: "Image", type: "image" },
    ]);
  });

  it("serializes BlockNote code content from its inline-node shape", () => {
    expect(
      normalizeBlock({
        type: "codeBlock",
        props: { language: "ts" },
        content: [{ type: "text", text: "const answer = 42;", styles: {} }],
        children: [],
      }),
    ).toEqual({
      type: "codeBlock",
      props: { language: "ts" },
      content: "const answer = 42;",
    });
  });

  it("includes the curated image block and strips transient image props", () => {
    expect(editorSchema.blockSpecs.image).toBeDefined();
    expect(
      normalizeBlock({
        type: "image",
        props: {
          url: "storage-image-1",
          name: "A mountain lake",
          caption: "Morning light",
          textAlignment: "center",
          previewWidth: 500,
          showPreview: true,
        },
        content: [],
        children: [],
      }),
    ).toEqual({
      type: "image",
      props: {
        storageId: "storage-image-1",
        altText: "A mountain lake",
        caption: "Morning light",
      },
    });
  });

  it("does not expose toggle headings in the heading schema", () => {
    const propSchema = editorSchema.blockSpecs.heading.config.propSchema;

    expect(propSchema.level.values).toEqual([2, 3]);
    expect(propSchema.level.default).toBe(2);
    expect("isToggleable" in propSchema).toBe(false);
  });
});
