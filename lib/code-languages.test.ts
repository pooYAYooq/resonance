import { describe, expect, it } from "vitest";
import {
  CODE_LANGUAGES,
  blockNoteSupportedLanguages,
  isCodeLanguage,
  normalizeCodeLanguage,
} from "./code-languages";

const acceptsBlockNoteLanguages = (
  languages: Record<string, { name: string; aliases?: string[] }>,
) => languages;

const blockNoteLanguageConfig = acceptsBlockNoteLanguages(
  blockNoteSupportedLanguages,
);

describe("code language contract", () => {
  it("keeps the ordered language IDs and display labels stable", () => {
    expect(CODE_LANGUAGES.map(({ id }) => id)).toEqual([
      "text",
      "typescript",
      "javascript",
      "tsx",
      "jsx",
      "json",
      "html",
      "css",
      "bash",
      "sql",
      "python",
      "markdown",
      "cpp",
      "rust",
    ]);
    expect(CODE_LANGUAGES.map(({ name }) => name)).toEqual([
      "Plain Text",
      "TypeScript",
      "JavaScript",
      "TSX",
      "JSX",
      "JSON",
      "HTML",
      "CSS",
      "Bash",
      "SQL",
      "Python",
      "Markdown",
      "C++",
      "Rust",
    ]);
  });

  it("provides BlockNote names and selector aliases", () => {
    expect(blockNoteLanguageConfig.cpp.name).toBe("C++");
    expect(blockNoteSupportedLanguages.cpp).toEqual({
      name: "C++",
      aliases: ["c++"],
    });
    expect(blockNoteSupportedLanguages.typescript.aliases).toContain("ts");
    expect(blockNoteSupportedLanguages.javascript.aliases).toContain("js");
    expect(blockNoteSupportedLanguages.rust.aliases).toContain("rs");
  });

  it("recognizes canonical IDs and normalizes unsupported values to text", () => {
    expect(isCodeLanguage("rust")).toBe(true);
    expect(isCodeLanguage("not-a-language")).toBe(false);
    expect(normalizeCodeLanguage("not-a-language")).toBe("text");
    expect(normalizeCodeLanguage(undefined)).toBe("text");
    expect(normalizeCodeLanguage(null)).toBe("text");
  });
});
