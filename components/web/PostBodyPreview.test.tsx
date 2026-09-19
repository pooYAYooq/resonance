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
});
