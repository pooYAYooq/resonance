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
  it("renders legacy text as a whitespace-preserving paragraph", () => {
    const { container } = render(<PostBody body={"Line one\nLine two"} />);
    const paragraph = container.querySelector("p");

    expect(paragraph?.textContent).toBe("Line one\nLine two");
    expect(paragraph).toHaveClass("whitespace-pre-wrap");
  });

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
});
