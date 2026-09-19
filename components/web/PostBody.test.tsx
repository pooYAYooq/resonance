import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PostBody } from "./PostBody";

vi.mock("./HighlightedCode", () => ({
  HighlightedCode: ({ code }: { code: string }) => <pre>{code}</pre>,
}));

const body = JSON.stringify({
  format: "blocknote@1",
  blocks: [
    {
      type: "heading",
      props: { level: 1 },
      content: [{ type: "text", text: "Heading" }],
      children: [],
    },
    {
      type: "checkListItem",
      props: { checked: true },
      content: [{ type: "text", text: "Done" }],
      children: [],
    },
    {
      type: "toggleListItem",
      props: {},
      content: [{ type: "text", text: "More" }],
      children: [],
    },
    { type: "divider", props: {}, children: [] },
    {
      type: "image",
      props: {
        url: "storage-image",
        name: "image.png",
        caption: "Caption",
        textAlignment: "center",
      },
      children: [],
    },
    {
      type: "audio",
      props: { url: "https://cdn.example.com/audio.mp3", name: "audio.mp3" },
      children: [],
    },
  ],
});

describe("PostBody", () => {
  it("renders every body heading at its matching level with no body H1", async () => {
    const { container } = render(
      <>
        <h1>Post title</h1>
        {await PostBody({
          body: JSON.stringify({
            format: "blocknote@1",
            blocks: [2, 3, 4, 5, 6].map((level) => ({
              type: "heading",
              props: { level },
              content: [{ type: "text", text: `Section ${level}` }],
            })),
          }),
        })}
      </>,
    );
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    for (const level of [2, 3, 4, 5, 6]) {
      expect(
        screen.getByRole("heading", { level, name: `Section ${level}` })
          .tagName,
      ).toBe(`H${level}`);
    }
    expect(container.querySelector("h2")).toHaveClass("text-3xl");
    expect(container.querySelector("h6")).toHaveClass("text-base");
  });
  it("renders all standard rich blocks with safe native elements", async () => {
    render(
      await PostBody({
        body,
        inlineImages: [
          {
            storageId: "storage-image",
            url: "https://cdn.example.com/image.png",
          },
        ],
      }),
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "Heading" }),
    ).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Done" })).toBeChecked();
    expect(screen.getByText("More").closest("details")).not.toBeNull();
    expect(document.querySelector("hr")).not.toBeNull();
    expect(screen.getByRole("img", { name: "image.png" })).toHaveAttribute(
      "src",
      "https://cdn.example.com/image.png",
    );
    expect(screen.getByText("Caption")).toBeVisible();
    expect(document.querySelector("audio")).toHaveAttribute(
      "src",
      "https://cdn.example.com/audio.mp3",
    );
  });

  it("applies block-level color tokens to block containers", async () => {
    const { container } = render(
      await PostBody({
        body: JSON.stringify({
          format: "blocknote@1",
          blocks: [
            {
              type: "paragraph",
              props: {
                backgroundColor: "blue",
                textColor: "red",
                textAlignment: "left",
              },
              content: [{ type: "text", text: "Colored block", styles: {} }],
            },
            {
              type: "heading",
              props: {
                level: 2,
                backgroundColor: "yellow",
                textColor: "green",
              },
              content: [{ type: "text", text: "Colored heading", styles: {} }],
            },
          ],
        }),
      }),
    );

    const paragraph = container.querySelector("p");
    expect(paragraph).toHaveAttribute("data-text-color", "red");
    expect(paragraph).toHaveAttribute("data-background-color", "blue");
    const heading = container.querySelector("h2");
    expect(heading).toHaveAttribute("data-text-color", "green");
    expect(heading).toHaveAttribute("data-background-color", "yellow");
  });

  it("does not render unsafe remote media", async () => {
    const unsafe = JSON.stringify({
      format: "blocknote@1",
      blocks: [
        {
          type: "video",
          props: { url: "javascript:alert(1)", name: "unsafe" },
          children: [],
        },
      ],
    });

    const result = await PostBody({ body: unsafe });
    expect(result).toBeNull();
  });

  it("emits the color attributes the reader stylesheet targets", async () => {
    const { container } = render(
      await PostBody({
        body: JSON.stringify({
          format: "blocknote@1",
          blocks: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Colored text",
                  styles: { textColor: "red", backgroundColor: "blue" },
                },
              ],
            },
          ],
        }),
      }),
    );

    expect(container.querySelector('[data-text-color="red"]')).not.toBeNull();
    expect(
      container.querySelector('[data-background-color="blue"]'),
    ).not.toBeNull();
  });
});
