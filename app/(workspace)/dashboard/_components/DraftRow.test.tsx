import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DraftRow } from "./DraftRow";

describe("DraftRow", () => {
  it("uses the small card radius", () => {
    const { container } = render(
      <DraftRow
        draft={{
          _id: "draft-1" as never,
          title: "Draft",
          excerpt: "Excerpt",
          tags: [],
          updatedAt: Date.UTC(2026, 9, 5),
        }}
      />,
    );

    expect(container.querySelector("article")).toHaveClass("rounded-sm");
  });
});
