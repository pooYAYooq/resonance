import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PostBody } from "./PostBody";

const structuredBody = JSON.stringify({
  format: "blocknote@1",
  blocks: [
    {
      type: "heading",
      props: { level: 1 },
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
      props: { language: "ts" },
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
        {
          type: "link",
          href: "javascript:alert(1)",
          content: [{ type: "text", text: " unsafe link" }],
        },
      ],
    },
  ],
});

describe("PostBody", () => {
  it("renders headings below the page title heading level", () => {
    render(<PostBody body={structuredBody} />);

    expect(
      screen.getByRole("heading", { name: "Heading", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Subheading", level: 3 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Small heading", level: 4 }),
    ).toBeInTheDocument();
  });

  it("groups consecutive lists and preserves nested lists", () => {
    const { container } = render(<PostBody body={structuredBody} />);

    expect(
      container.querySelectorAll('[data-slot="post-body"] > ul'),
    ).toHaveLength(1);
    expect(
      container.querySelectorAll('[data-slot="post-body"] > ol'),
    ).toHaveLength(1);
    expect(container.querySelectorAll("ul ul")).toHaveLength(1);
    expect(screen.getByText("Nested bullet")).toBeInTheDocument();
  });

  it("does not nest block children inside paragraph elements", () => {
    render(
      <PostBody
        body={JSON.stringify({
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
        })}
      />,
    );

    const nestedHeading = screen.getByRole("heading", {
      name: "Nested heading",
    });
    expect(nestedHeading.closest("p")).toBeNull();
  });

  it("renders quotes and code blocks safely", () => {
    const { container } = render(<PostBody body={structuredBody} />);
    const code = container.querySelector("pre > code");

    expect(container.querySelector("blockquote")).toHaveTextContent(
      "A quoted thought",
    );
    expect(code).toHaveTextContent("const answer = 42;");
    expect(code).toHaveAttribute("data-language", "ts");
  });

  it("renders inline styles and only safe links as anchors", () => {
    render(<PostBody body={structuredBody} />);

    expect(screen.getByText("bold")).toBeInTheDocument();
    expect(screen.getByText("bold").closest("strong")).not.toBeNull();
    expect(screen.getByText("italic").closest("em")).not.toBeNull();
    expect(screen.getByText("underline").closest("u")).not.toBeNull();
    expect(screen.getByText("strike").closest("s")).not.toBeNull();
    expect(screen.getByText("code").closest("code")).not.toBeNull();

    const safeLink = screen.getByRole("link", { name: "safe link" });
    expect(safeLink).toHaveAttribute("href", "https://example.com");
    expect(safeLink).toHaveAttribute("rel", "noopener noreferrer nofollow");
    expect(
      screen.queryByRole("link", { name: "unsafe link" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("unsafe link")).toBeInTheDocument();
  });

  it("renders mailto links as anchors and other unsafe protocols as text", () => {
    render(
      <PostBody
        body={JSON.stringify({
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
                {
                  type: "link",
                  href: "data:text/html;base64,PHNjcmlwdD4=",
                  content: [{ type: "text", text: "data link" }],
                },
                {
                  type: "link",
                  href: "//protocol-relative.example/path",
                  content: [{ type: "text", text: "relative link" }],
                },
              ],
            },
          ],
        })}
      />,
    );

    expect(screen.getByRole("link", { name: "email link" })).toHaveAttribute(
      "href",
      "mailto:hello@example.com",
    );
    expect(
      screen.queryByRole("link", { name: "data link" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "relative link" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("data link")).toBeInTheDocument();
    expect(screen.getByText("relative link")).toBeInTheDocument();
  });

  it("does not throw or render serialized content for unknown blocks", () => {
    const { container } = render(
      <PostBody
        body={JSON.stringify({
          format: "blocknote@1",
          blocks: [
            {
              type: "futureBlock",
              content: [{ type: "text", text: "Future content" }],
            },
          ],
        })}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(container).not.toHaveTextContent("format");
  });

  it("renders nothing for malformed blocknote envelopes without leaking storage IDs", () => {
    const { container } = render(
      <PostBody
        body={JSON.stringify({
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
        })}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(container).not.toHaveTextContent("secret-storage-id");
    expect(container).not.toHaveTextContent("Before");
  });

  it("renders hydrated inline images with captions", () => {
    const storageId = "storage-image-1";
    const { container } = render(
      <PostBody
        body={JSON.stringify({
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
        })}
        inlineImages={[{ storageId, url: "https://cdn.example/image.png" }]}
      />,
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

  it("omits unresolved inline images while preserving adjacent content", () => {
    const { container } = render(
      <PostBody
        body={JSON.stringify({
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
        })}
        inlineImages={[{ storageId: "missing-image", url: null }]}
      />,
    );

    expect(container.querySelector("figure")).not.toBeInTheDocument();
    expect(screen.getByText("Before image")).toBeInTheDocument();
    expect(screen.getByText("After image")).toBeInTheDocument();
  });

  it("renders images nested inside list items", () => {
    const { container } = render(
      <PostBody
        body={JSON.stringify({
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
        })}
        inlineImages={[
          { storageId: "nested-image", url: "https://cdn.example/nested.png" },
        ]}
      />,
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
