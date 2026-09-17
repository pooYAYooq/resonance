import { normalizeCodeLanguage } from "../code-languages";
import { createHighlighter } from "./code-highlighter.generated";

let readerCodeHighlighterPromise:
  | ReturnType<typeof createHighlighter>
  | undefined;

function getReaderCodeHighlighter() {
  readerCodeHighlighterPromise ??= createHighlighter({
    // BlockNote's live parser uses the first loaded theme for inline decorations.
    themes: ["github-dark", "github-light"],
    langs: [],
  });
  return readerCodeHighlighterPromise;
}

let editorCodeHighlighterPromise:
  | ReturnType<typeof createHighlighter>
  | undefined;

export type HighlightedCodeToken = {
  content: string;
  lightColor: string;
  darkColor: string;
};

export type HighlightedCode = HighlightedCodeToken[][];

export function createEditorCodeHighlighter() {
  editorCodeHighlighterPromise ??= createHighlighter({
    themes: ["github-dark"],
    langs: [],
  });
  return editorCodeHighlighterPromise;
}

export async function highlightCode(
  code: string,
  language: unknown,
): Promise<HighlightedCode | null> {
  const normalizedLanguage = normalizeCodeLanguage(language);
  if (normalizedLanguage === "text") return null;

  try {
    const highlighter = await getReaderCodeHighlighter();
    await highlighter.loadLanguage(normalizedLanguage);

    const themedTokens = highlighter.codeToTokensWithThemes(code, {
      lang: normalizedLanguage,
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
    });

    return themedTokens.map((line) =>
      line.map((token) => {
        return {
          content: token.content,
          lightColor: token.variants.light?.color ?? "inherit",
          darkColor: token.variants.dark?.color ?? "inherit",
        };
      }),
    );
  } catch {
    return null;
  }
}
