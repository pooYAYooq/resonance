import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { highlightCode } from "@/lib/shiki/highlight-code";
import { HighlightedCode } from "./HighlightedCode";

vi.mock("@/lib/shiki/highlight-code", () => ({
  highlightCode: vi.fn(),
}));

const mockHighlightCode = vi.mocked(highlightCode);

afterEach(() => {
  vi.resetAllMocks();
});

describe("HighlightedCode", () => {
  it("renders canonical TypeScript tokens with both theme colors", async () => {
    mockHighlightCode.mockResolvedValue([
      [
        {
          content: "const answer = 42;",
          lightColor: "#123456",
          darkColor: "#abcdef",
        },
      ],
    ]);

    const { container } = render(
      await HighlightedCode({
        code: "const answer = 42;",
        language: "ts",
      }),
    );

    const code = container.querySelector("pre > code");
    const token = screen.getByTestId("highlight-token");

    expect(code).toHaveAttribute("data-language", "typescript");
    expect(token).toHaveTextContent("const answer = 42;");
    expect(token).toHaveStyle({
      "--shiki-light": "#123456",
      "--shiki-dark": "#abcdef",
    });
  });

  it("falls back to escaped plain code when highlighting fails", async () => {
    mockHighlightCode.mockRejectedValue(new Error("Shiki unavailable"));

    render(
      await HighlightedCode({
        code: "<script>alert(1)</script>",
        language: "typescript",
      }),
    );

    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
    expect(screen.queryByTestId("highlight-token")).not.toBeInTheDocument();
  });

  it("falls back to escaped plain code when highlighting returns null", async () => {
    mockHighlightCode.mockResolvedValue(null);

    render(
      await HighlightedCode({
        code: "<script>alert(1)</script>",
        language: "typescript",
      }),
    );

    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
    expect(screen.queryByTestId("highlight-token")).not.toBeInTheDocument();
  });
});
