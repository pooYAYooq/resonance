import { normalizeCodeLanguage } from "@/lib/code-languages";
import { highlightCode } from "@/lib/shiki/highlight-code";
import { Fragment, type CSSProperties } from "react";

type HighlightedCodeProps = {
  code: string;
  language: unknown;
};

const fallbackClassName = "overflow-x-auto rounded-md bg-muted p-4";

export async function HighlightedCode({
  code,
  language,
}: HighlightedCodeProps) {
  const normalizedLanguage = normalizeCodeLanguage(language);
  let lines;

  try {
    lines = await highlightCode(code, normalizedLanguage);
  } catch {
    lines = null;
  }

  return (
    <pre className={fallbackClassName}>
      <code data-language={normalizedLanguage}>
        {lines
          ? lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {line.map((token, tokenIndex) => (
                  <span
                    className="shiki-token"
                    data-testid="highlight-token"
                    key={tokenIndex}
                    style={
                      {
                        "--shiki-light": token.lightColor,
                        "--shiki-dark": token.darkColor,
                      } as CSSProperties
                    }
                  >
                    {token.content}
                  </span>
                ))}
                {lineIndex < lines.length - 1 ? "\n" : null}
              </Fragment>
            ))
          : code}
      </code>
    </pre>
  );
}
