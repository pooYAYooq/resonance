"use client";

import { Fragment, useEffect, useState, type CSSProperties } from "react";
import { normalizeCodeLanguage } from "@/lib/code-languages";
import {
  highlightCode,
  type HighlightedCode,
} from "@/lib/shiki/highlight-code";

/**
 * Client-side counterpart to the server `HighlightedCode`, used by the Review
 * preview. Highlighting is loaded after mount, so the raw code renders first.
 */
export function HighlightedCodeClient({
  code,
  language,
}: {
  code: string;
  language: unknown;
}) {
  const [lines, setLines] = useState<HighlightedCode | null>(null);
  const normalizedLanguage = normalizeCodeLanguage(language);

  useEffect(() => {
    let active = true;
    void highlightCode(code, language).then((result) => {
      if (active) setLines(result);
    });
    return () => {
      active = false;
    };
  }, [code, language]);

  return (
    <pre className="overflow-x-auto rounded-md bg-muted p-4">
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
