import { afterEach, describe, expect, it, vi } from "vitest";
import { highlightCode } from "./highlight-code";

type Token = { content: string; color: string };
type ThemedToken = {
  content: string;
  variants: {
    light?: { color?: string };
    dark?: { color?: string };
  };
};

async function importAdapterWithHighlighter(
  createHighlighter: (options?: { themes: string[] }) => Promise<{
    loadLanguage: (language: string) => Promise<void>;
    codeToTokensBase?: (
      code: string,
      options: { lang: string; theme: string },
    ) => Token[][];
    codeToTokensWithThemes?: (
      code: string,
      options: {
        lang: string;
        themes: { light: string; dark: string };
      },
    ) => ThemedToken[][];
  }>,
) {
  vi.resetModules();
  vi.doMock("./code-highlighter.generated", () => ({ createHighlighter }));

  return import("./highlight-code");
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("./code-highlighter.generated");
});

describe("highlightCode", () => {
  it("uses the dark theme for the live editor code block", async () => {
    const highlighterOptions: Array<{ themes: string[] }> = [];
    const { createEditorCodeHighlighter } = await importAdapterWithHighlighter(
      async (options?: { themes: string[] }) => {
        highlighterOptions.push(options ?? { themes: [] });
        return {
          loadLanguage: async () => undefined,
          codeToTokensBase: () => [],
        };
      },
    );

    createEditorCodeHighlighter();

    expect(highlighterOptions[0]).toEqual({
      themes: ["github-dark", "github-light"],
      langs: [],
    });
    expect(highlighterOptions).toContainEqual(
      expect.objectContaining({ themes: ["github-dark"] }),
    );
  });

  it("returns dual-theme TypeScript tokens", async () => {
    await expect(
      highlightCode("const answer = 42", "typescript"),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.arrayContaining([
          expect.objectContaining({
            content: "const",
            lightColor: expect.any(String),
            darkColor: expect.any(String),
          }),
        ]),
      ]),
    );
  });

  it("uses one multi-theme tokenization pass", async () => {
    let tokenizationCalls = 0;
    const codeToTokensBase = vi.fn(() => [
      [{ content: "legacy", color: "#000000" }],
    ]);
    const { highlightCode } = await importAdapterWithHighlighter(async () => ({
      loadLanguage: async () => undefined,
      codeToTokensBase,
      codeToTokensWithThemes: (_code, options) => {
        tokenizationCalls += 1;
        expect(options).toEqual({
          lang: "typescript",
          themes: {
            light: "github-light",
            dark: "github-dark",
          },
        });
        return [
          [
            {
              content: "const",
              variants: {
                light: { color: "#000000" },
                dark: { color: "#ffffff" },
              },
            },
          ],
        ];
      },
    }));

    await expect(
      highlightCode("const answer = 42", "typescript"),
    ).resolves.toEqual([
      [
        {
          content: "const",
          lightColor: "#000000",
          darkColor: "#ffffff",
        },
      ],
    ]);
    expect(tokenizationCalls).toBe(1);
    expect(codeToTokensBase).not.toHaveBeenCalled();
  });

  it("returns null for plain text and unsupported languages", async () => {
    await expect(highlightCode("raw", "text")).resolves.toBeNull();
    await expect(highlightCode("raw", "legacy-unknown")).resolves.toBeNull();
  });

  it("returns null when Shiki initialization rejects", async () => {
    const { highlightCode } = await importAdapterWithHighlighter(() =>
      Promise.reject(new Error("Shiki failed to initialize")),
    );

    await expect(
      highlightCode("const answer = 42", "typescript"),
    ).resolves.toBeNull();
  });

  it("returns null when Shiki tokenization rejects", async () => {
    const { highlightCode } = await importAdapterWithHighlighter(async () => ({
      loadLanguage: async () => undefined,
      codeToTokensWithThemes: () => {
        throw new Error("Shiki failed to tokenize");
      },
    }));

    await expect(
      highlightCode("const answer = 42", "typescript"),
    ).resolves.toBeNull();
  });
});
