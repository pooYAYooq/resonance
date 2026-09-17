import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PostBody } from "./PostBody";

const structuredBody = JSON.stringify({
  format: "blocknote@1",
  blocks: [
    {
      type: "heading",
      props: { level: 2 },
      content: [
        {
          type: "text",
          text: "Heading",
          styles: { bold: true },
        },
      ],
    },
    {
      type: "heading",
      props: { level: 2 },
      content: [{ type: "text", text: "Subheading" }],
    },
    {
      type: "heading",
      props: { level: 3 },
      content: [{ type: "text", text: "Small heading" }],
    },
    {
      type: "heading",
      props: { level: 4 },
      content: [{ type: "text", text: "Heading 4" }],
    },
    {
      type: "heading",
      props: { level: 5 },
      content: [{ type: "text", text: "Heading 5" }],
    },
    {
      type: "heading",
      props: { level: 6 },
      content: [{ type: "text", text: "Heading 6" }],
    },
    {
      type: "bulletListItem",
      content: [{ type: "text", text: "First bullet" }],
      children: [
        {
          type: "bulletListItem",
          content: [{ type: "text", text: "Nested bullet" }],
        },
      ],
    },
    {
      type: "bulletListItem",
      content: [{ type: "text", text: "Second bullet" }],
    },
    {
      type: "numberedListItem",
      content: [{ type: "text", text: "First number" }],
    },
    {
      type: "numberedListItem",
      content: [{ type: "text", text: "Second number" }],
    },
    {
      type: "quote",
      content: [{ type: "text", text: "A quoted thought" }],
    },
    {
      type: "codeBlock",
      props: { language: "typescript" },
      content: "const answer = 42;",
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "bold", styles: { bold: true } },
        { type: "text", text: " italic", styles: { italic: true } },
        { type: "text", text: " underline", styles: { underline: true } },
        { type: "text", text: " strike", styles: { strike: true } },
        { type: "text", text: " code", styles: { code: true } },
        {
          type: "link",
          href: "https://example.com",
          content: [{ type: "text", text: " safe link" }],
        },
      ],
    },
  ],
});

describe("PostBody", () => {
  it("renders headings below the page title heading level", async () => {
    render(await PostBody({ body: structuredBody }));

    expect(
      screen.getByRole("heading", { name: "Heading", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Subheading", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Small heading", level: 3 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Heading 4", level: 4 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Heading 5", level: 5 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Heading 6", level: 6 }),
    ).toBeInTheDocument();
  });

  it("groups consecutive lists and preserves nested lists", async () => {
    const { container } = render(await PostBody({ body: structuredBody }));

    expect(
      container.querySelectorAll('[data-slot="post-body"] > ul'),
    ).toHaveLength(1);
    expect(
      container.querySelectorAll('[data-slot="post-body"] > ol'),
    ).toHaveLength(1);
    expect(container.querySelectorAll("ul ul")).toHaveLength(1);
    expect(screen.getByText("Nested bullet")).toBeInTheDocument();
  });

  it("does not nest block children inside paragraph elements", async () => {
    render(
      await PostBody({
        body: JSON.stringify({
          format: "blocknote@1",
          blocks: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Intro" }],
              children: [
                {
                  type: "heading",
                  props: { level: 3 },
                  content: [{ type: "text", text: "Nested heading" }],
                },
              ],
            },
          ],
        }),
      }),
    );

    const nestedHeading = screen.getByRole("heading", {
      name: "Nested heading",
    });
    expect(nestedHeading.closest("p")).toBeNull();
  });

  it("renders quotes and code blocks safely", async () => {
    const { container } = render(await PostBody({ body: structuredBody }));
    const code = container.querySelector("pre > code");

    expect(container.querySelector("blockquote")).toHaveTextContent(
      "A quoted thought",
    );
    expect(code).toHaveTextContent("const answer = 42;");
    expect(code).toHaveAttribute("data-language", "typescript");
    expect(
      container.querySelectorAll('[data-testid="highlight-token"]'),
    ).not.toHaveLength(0);
    expect(
      container.querySelector('[data-testid="highlight-token"]'),
    ).toHaveAttribute("style");
  });

  it("renders inline styles and valid persisted links as anchors", async () => {
    render(await PostBody({ body: structuredBody }));

    expect(screen.getByText("bold")).toBeInTheDocument();
    expect(screen.getByText("bold").closest("strong")).not.toBeNull();
    expect(screen.getByText("italic").closest("em")).not.toBeNull();
    expect(screen.getByText("underline").closest("u")).not.toBeNull();
    expect(screen.getByText("strike").closest("s")).not.toBeNull();
    expect(screen.getByText("code").closest("code")).not.toBeNull();

    const safeLink = screen.getByRole("link", { name: "safe link" });
    expect(safeLink).toHaveAttribute("href", "https://example.com");
    expect(safeLink).toHaveAttribute("rel", "noopener noreferrer nofollow");
  });

  it("does not render a persisted document containing an unsafe link", async () => {
    render(
      await PostBody({
        body: JSON.stringify({
          format: "blocknote@1",
          blocks: [
            {
              type: "paragraph",
              content: [
                {
                  type: "link",
                  href: "javascript:alert(1)",
                  content: [{ type: "text", text: "Unsafe link" }],
                },
              ],
            },
          ],
        }),
      }),
    );

    expect(screen.queryByText("Unsafe link")).not.toBeInTheDocument();
  });

  it("renders persisted mailto links as anchors", async () => {
    render(
      await PostBody({
        body: JSON.stringify({
          format: "blocknote@1",
          blocks: [
            {
              type: "paragraph",
              content: [
                {
                  type: "link",
                  href: "mailto:hello@example.com",
                  content: [{ type: "text", text: "email link" }],
                },
              ],
            },
          ],
        }),
      }),
    );

    expect(screen.getByRole("link", { name: "email link" })).toHaveAttribute(
      "href",
      "mailto:hello@example.com",
    );
  });

  it("does not throw or render serialized content for unknown blocks", async () => {
    const { container } = render(
      await PostBody({
        body: JSON.stringify({
          format: "blocknote@1",
          blocks: [
            {
              type: "futureBlock",
              content: [{ type: "text", text: "Future content" }],
            },
          ],
        }),
      }),
    );

    expect(container).toBeEmptyDOMElement();
    expect(container).not.toHaveTextContent("format");
  });

  it("renders nothing for malformed blocknote envelopes without leaking storage IDs", async () => {
    const { container } = render(
      await PostBody({
        body: JSON.stringify({
          format: "blocknote@1",
          blocks: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Before" }],
            },
            {
              type: "image",
              props: { storageId: "secret-storage-id" },
            },
          ],
        }),
      }),
    );

    expect(container).toBeEmptyDOMElement();
    expect(container).not.toHaveTextContent("secret-storage-id");
    expect(container).not.toHaveTextContent("Before");
  });

  it("renders hydrated inline images with captions", async () => {
    const storageId = "storage-image-1";
    const { container } = render(
      await PostBody({
        body: JSON.stringify({
          format: "blocknote@1",
          blocks: [
            {
              type: "image",
              props: {
                storageId,
                altText: "A mountain lake",
                caption: "Morning light over the lake",
              },
            },
          ],
        }),
        inlineImages: [{ storageId, url: "https://cdn.example/image.png" }],
      }),
    );

    expect(container.querySelector("figure")).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.example/image.png",
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "alt",
      "A mountain lake",
    );
    expect(container.querySelector("figcaption")).toHaveTextContent(
      "Morning light over the lake",
    );
    expect(container).not.toHaveTextContent(storageId);
  });

  it("omits unresolved inline images while preserving adjacent content", async () => {
    const { container } = render(
      await PostBody({
        body: JSON.stringify({
          format: "blocknote@1",
          blocks: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Before image" }],
            },
            {
              type: "image",
              props: { storageId: "missing-image", altText: "Missing" },
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "After image" }],
            },
          ],
        }),
        inlineImages: [{ storageId: "missing-image", url: null }],
      }),
    );

    expect(container.querySelector("figure")).not.toBeInTheDocument();
    expect(screen.getByText("Before image")).toBeInTheDocument();
    expect(screen.getByText("After image")).toBeInTheDocument();
  });

  it("renders images nested inside list items", async () => {
    const { container } = render(
      await PostBody({
        body: JSON.stringify({
          format: "blocknote@1",
          blocks: [
            {
              type: "bulletListItem",
              content: [{ type: "text", text: "Parent item text" }],
              children: [
                {
                  type: "image",
                  props: {
                    storageId: "nested-image",
                    altText: "Nested chart",
                  },
                },
              ],
            },
          ],
        }),
        inlineImages: [
          { storageId: "nested-image", url: "https://cdn.example/nested.png" },
        ],
      }),
    );

    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.example/nested.png",
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "alt",
      "Nested chart",
    );
    expect(screen.getByText("Parent item text")).toBeInTheDocument();
  });
});
