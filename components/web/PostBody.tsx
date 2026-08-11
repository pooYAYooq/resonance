import type {
  PostBlock,
  PostInlineContent,
  PostTextStyle,
} from "@/lib/post-content";
import { parsePostBody } from "@/lib/post-content";
import type { ReactNode } from "react";

type PostBodyProps = {
  body: string;
};

const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

function isSafeLink(href: string): boolean {
  try {
    return SAFE_LINK_PROTOCOLS.has(new URL(href).protocol);
  } catch {
    return false;
  }
}

function renderInlineContent(
  content: PostInlineContent[] | undefined,
  keyPrefix: string,
): ReactNode[] {
  if (!content) return [];

  return content.map((inline, index) => {
    const key = `${keyPrefix}-${index}`;
    const children =
      inline.type === "link"
        ? renderInlineContent(inline.content, key)
        : inline.text;

    let node: ReactNode = children;

    if (inline.type === "link" && inline.href && isSafeLink(inline.href)) {
      node = (
        <a
          href={inline.href}
          rel="noopener noreferrer nofollow"
          key={key}
          className="underline underline-offset-2 hover:text-primary"
        >
          {children}
        </a>
      );
    }

    const styles = inline.styles ?? {};
    const styleWrappers: [PostTextStyle, (child: ReactNode) => ReactNode][] = [
      ["bold", (child) => <strong>{child}</strong>],
      ["italic", (child) => <em>{child}</em>],
      ["underline", (child) => <u>{child}</u>],
      ["strike", (child) => <s>{child}</s>],
      ["code", (child) => <code>{child}</code>],
    ];

    for (const [style, wrap] of styleWrappers) {
      if (styles[style]) {
        node = wrap(node);
      }
    }

    if (inline.type !== "link" || !inline.href || !isSafeLink(inline.href)) {
      return <span key={key}>{node}</span>;
    }

    return node;
  });
}

function renderBlockContent(block: PostBlock, key: string): ReactNode {
  if (typeof block.content === "string") return block.content;

  return renderInlineContent(block.content, key);
}

function renderNestedBlocks(block: PostBlock, key: string): ReactNode {
  if (!block.children?.length) return null;
  return renderBlocks(block.children, `${key}-children`);
}

function renderList(
  blocks: PostBlock[],
  type: "bulletListItem" | "numberedListItem",
  key: string,
): ReactNode {
  const List = type === "bulletListItem" ? "ul" : "ol";

  return (
    <List
      key={key}
      className={
        type === "bulletListItem"
          ? "list-disc space-y-2 pl-6"
          : "list-decimal space-y-2 pl-6"
      }
    >
      {blocks.map((block, index) => {
        const itemKey = `${key}-item-${index}`;
        return (
          <li key={itemKey}>
            {renderBlockContent(block, itemKey)}
            {renderNestedBlocks(block, itemKey)}
          </li>
        );
      })}
    </List>
  );
}

function renderBlock(block: PostBlock, key: string): ReactNode {
  const content = renderBlockContent(block, key);
  const nestedBlocks = renderNestedBlocks(block, key);

  switch (block.type) {
    case "paragraph":
      return (
        <p key={key} className="leading-relaxed text-foreground/90">
          {content}
          {nestedBlocks}
        </p>
      );
    case "heading": {
      const level = block.props?.level;
      const Heading = level === 1 ? "h2" : level === 2 ? "h3" : "h4";
      return (
        <Heading key={key} className="font-semibold tracking-tight">
          {content}
          {nestedBlocks}
        </Heading>
      );
    }
    case "quote":
      return (
        <blockquote
          key={key}
          className="border-l-2 border-border pl-4 italic text-muted-foreground"
        >
          {content}
          {nestedBlocks}
        </blockquote>
      );
    case "codeBlock": {
      const language = block.props?.language;
      return (
        <pre key={key} className="overflow-x-auto rounded-md bg-muted p-4">
          <code
            data-language={typeof language === "string" ? language : undefined}
          >
            {content}
          </code>
        </pre>
      );
    }
    default:
      return null;
  }
}

function renderBlocks(blocks: PostBlock[], keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];

    if (block.type === "bulletListItem" || block.type === "numberedListItem") {
      const type = block.type;
      const list: PostBlock[] = [];

      while (blocks[index]?.type === type) {
        list.push(blocks[index]);
        index += 1;
      }

      index -= 1;
      nodes.push(renderList(list, type, `${keyPrefix}-list-${index}`));
      continue;
    }

    nodes.push(renderBlock(block, `${keyPrefix}-block-${index}`));
  }

  return nodes;
}

export function PostBody({ body }: PostBodyProps) {
  const parsed = parsePostBody(body);

  if (parsed.kind === "legacy") {
    return (
      <div data-slot="post-body">
        <p className="text-lg leading-relaxed text-foreground/90 whitespace-pre-wrap">
          {parsed.text}
        </p>
      </div>
    );
  }

  if (parsed.kind !== "structured") return null;

  return (
    <div data-slot="post-body" className="space-y-5 text-lg">
      {renderBlocks(parsed.document.blocks, "post")}
    </div>
  );
}
