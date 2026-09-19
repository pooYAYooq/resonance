import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PostBodyPreview } from "./PostBodyPreview";

const body = JSON.stringify({
  format: "blocknote@1",
  blocks: [
    {
      type: "heading",
      props: {
        level: 2,
        backgroundColor: "default",
        textColor: "default",
        textAlignment: "left",
      },
      content: [{ type: "text", text: "Preview heading", styles: {} }],
    },
    {
      type: "paragraph",
      props: {
        backgroundColor: "default",
        textColor: "default",
        textAlignment: "left",
      },
      content: [{ type: "text", text: "Preview body", styles: { bold: true } }],
    },
    {
      type: "codeBlock",
      props: { language: "typescript" },
      content: "const answer = 42;",
    },
  ],
});

describe("PostBodyPreview", () => {
  it("renders canonical blocks synchronously", () => {
    const { container } = render(<PostBodyPreview body={body} />);

    expect(container.querySelector("h2")).toHaveTextContent("Preview heading");
    expect(container.querySelector("p")).toHaveTextContent("Preview body");
    expect(container.querySelector("strong")).toHaveTextContent("Preview body");
    expect(container.querySelector("pre code")).toHaveTextContent(
      "const answer = 42;",
    );
  });

  it("renders nothing for an invalid body", () => {
    const { container } = render(<PostBodyPreview body="{ not json" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("applies block-level color tokens to block containers", () => {
    const { container } = render(
      <PostBodyPreview
        body={JSON.stringify({
          format: "blocknote@1",
          blocks: [
            {
              type: "paragraph",
              props: {
                backgroundColor: "pink",
                textColor: "purple",
                textAlignment: "left",
              },
              content: [{ type: "text", text: "Colored", styles: {} }],
            },
          ],
        })}
      />,
    );

    const paragraph = container.querySelector("p");
    expect(paragraph).toHaveAttribute("data-text-color", "purple");
    expect(paragraph).toHaveAttribute("data-background-color", "pink");
  });

  it("preserves table column widths and header semantics", () => {
    const cell = (text: string) => ({
      type: "tableCell",
      content: [{ type: "text", text }],
      props: {
        colspan: 1,
        rowspan: 1,
        backgroundColor: "default",
        textColor: "default",
        textAlignment: "left",
      },
    });
    const { container } = render(
      <PostBodyPreview
        body={JSON.stringify({
          format: "blocknote@1",
          blocks: [
            {
              type: "table",
              props: { textColor: "default" },
              content: {
                type: "tableContent",
                columnWidths: [80, null],
                headerRows: 1,
                headerCols: 1,
                rows: [
                  { cells: [cell("H1"), cell("H2")] },
                  { cells: [cell("R1C1"), cell("R1C2")] },
                ],
              },
            },
          ],
        })}
      />,
    );

    expect(container.querySelectorAll("colgroup col")).toHaveLength(2);
    expect(container.querySelectorAll("thead th")).toHaveLength(2);
    expect(container.querySelector("tbody th")).toHaveAttribute("scope", "row");
  });

  it("honors media showPreview and previewWidth", () => {
    const body = (props: Record<string, unknown>) =>
      JSON.stringify({
        format: "blocknote@1",
        blocks: [
          {
            type: "image",
            props: {
              source: { kind: "url", url: "https://cdn.example.com/pic.png" },
              name: "pic.png",
              caption: "",
              backgroundColor: "default",
              textAlignment: "left",
              ...props,
            },
          },
        ],
      });

    const linked = render(
      <PostBodyPreview body={body({ showPreview: false })} />,
    );
    expect(linked.container.querySelector("img")).toBeNull();
    expect(linked.container.querySelector("a")).toHaveAttribute(
      "href",
      "https://cdn.example.com/pic.png",
    );

    const sized = render(
      <PostBodyPreview body={body({ previewWidth: 160 })} />,
    );
    const img = sized.container.querySelector("img") as HTMLElement | null;
    expect(img?.style.width).toBe("160px");
  });
});
