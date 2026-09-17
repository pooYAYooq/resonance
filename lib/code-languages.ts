export const CODE_LANGUAGES = [
  { id: "text", name: "Plain Text", aliases: [], shikiLanguage: undefined },
  {
    id: "typescript",
    name: "TypeScript",
    aliases: ["ts"],
    shikiLanguage: "typescript",
  },
  {
    id: "javascript",
    name: "JavaScript",
    aliases: ["js"],
    shikiLanguage: "javascript",
  },
  { id: "tsx", name: "TSX", aliases: [], shikiLanguage: "tsx" },
  { id: "jsx", name: "JSX", aliases: [], shikiLanguage: "jsx" },
  { id: "json", name: "JSON", aliases: [], shikiLanguage: "json" },
  { id: "html", name: "HTML", aliases: [], shikiLanguage: "html" },
  { id: "css", name: "CSS", aliases: [], shikiLanguage: "css" },
  { id: "bash", name: "Bash", aliases: [], shikiLanguage: "bash" },
  { id: "sql", name: "SQL", aliases: [], shikiLanguage: "sql" },
  { id: "python", name: "Python", aliases: [], shikiLanguage: "python" },
  {
    id: "markdown",
    name: "Markdown",
    aliases: [],
    shikiLanguage: "markdown",
  },
  { id: "cpp", name: "C++", aliases: ["c++"], shikiLanguage: "cpp" },
  { id: "rust", name: "Rust", aliases: ["rs"], shikiLanguage: "rust" },
] as const;

export type CodeLanguage = (typeof CODE_LANGUAGES)[number]["id"];

type BlockNoteLanguage = {
  name: string;
  aliases: string[];
};

export const blockNoteSupportedLanguages: Record<
  CodeLanguage,
  BlockNoteLanguage
> = Object.fromEntries(
  CODE_LANGUAGES.map(({ id, name, aliases }) => [
    id,
    { name, aliases: [...aliases] },
  ]),
) as Record<CodeLanguage, BlockNoteLanguage>;

const codeLanguageIds = new Set<string>(CODE_LANGUAGES.map(({ id }) => id));
const codeLanguageAliases = new Map<string, CodeLanguage>(
  CODE_LANGUAGES.flatMap(({ id, aliases }) =>
    aliases.map((alias) => [alias, id] as const),
  ),
);

export function isCodeLanguage(value: unknown): value is CodeLanguage {
  return typeof value === "string" && codeLanguageIds.has(value);
}

export function normalizeCodeLanguage(value: unknown): CodeLanguage {
  if (isCodeLanguage(value)) return value;
  if (typeof value === "string")
    return codeLanguageAliases.get(value) ?? "text";
  return "text";
}
