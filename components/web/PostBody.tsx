import type {
  PostBlock,
  PostInlineContent,
  PostTextStyle,
} from "@/lib/post-content";
import { parsePostBody } from "@/lib/post-content";
import { isSafeAuthorLink } from "@/lib/safe-link";
import { Fragment, type ReactNode } from "react";
import { HighlightedCode } from "./HighlightedCode";

export type ResolvedInlineImage = {
  storageId: string;
  url: string | null;
};

type PostBodyProps = {
  body: string;
  inlineImages?: ResolvedInlineImage[];
};

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

    if (
      inline.type === "link" &&
      inline.href &&
      isSafeAuthorLink(inline.href)
    ) {
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

    if (
      inline.type !== "link" ||
      !inline.href ||
      !isSafeAuthorLink(inline.href)
    ) {
      return <span key={key}>{node}</span>;
    }

    return node;
  });
}

function renderBlockContent(block: PostBlock, key: string): ReactNode {
  if (typeof block.content === "string") return block.content;

  return renderInlineContent(block.content, key);
}

async function renderNestedBlocks(
  block: PostBlock,
  key: string,
  inlineImages: Map<string, string>,
): Promise<ReactNode> {
  if (!block.children?.length) return null;
  return await renderBlocks(block.children, `${key}-children`, inlineImages);
}

async function renderList(
  blocks: PostBlock[],
  type: "bulletListItem" | "numberedListItem",
  key: string,
  inlineImages: Map<string, string>,
): Promise<ReactNode> {
  const List = type === "bulletListItem" ? "ul" : "ol";
  const items = await Promise.all(
    blocks.map(async (block, index) => {
      const itemKey = `${key}-item-${index}`;
      return (
        <li key={itemKey}>
          {renderBlockContent(block, itemKey)}
          {await renderNestedBlocks(block, itemKey, inlineImages)}
        </li>
      );
    }),
  );

  return (
    <List
      key={key}
      className={
        type === "bulletListItem"
          ? "list-disc space-y-2 pl-6"
          : "list-decimal space-y-2 pl-6"
      }
    >
      {items}
    </List>
  );
}

async function renderBlock(
  block: PostBlock,
  key: string,
  inlineImages: Map<string, string>,
): Promise<ReactNode> {
  if (block.type === "image") {
    const storageId = block.props?.storageId;
    const altText = block.props?.altText;
    if (typeof storageId !== "string" || typeof altText !== "string") {
      return null;
    }

    const url = inlineImages.get(storageId);
    if (!url) return null;

    const caption = block.props?.caption;
    return (
      <figure key={key}>
        {/* Inline image URLs are already resolved by the server query. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={altText} />
        {typeof caption === "string" && caption ? (
          <figcaption>{caption}</figcaption>
        ) : null}
      </figure>
    );
  }

  const content = renderBlockContent(block, key);
  const nestedBlocks = await renderNestedBlocks(block, key, inlineImages);

  switch (block.type) {
    case "paragraph":
      return (
        <Fragment key={key}>
          <p className="leading-relaxed text-foreground/90">{content}</p>
          {nestedBlocks}
        </Fragment>
      );
    case "heading": {
      const level = block.props?.level;
      const Heading = `h${level}` as "h2" | "h3" | "h4" | "h5" | "h6";
      return (
        <Fragment key={key}>
          <Heading className="font-semibold tracking-tight">{content}</Heading>
          {nestedBlocks}
        </Fragment>
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
      if (typeof block.content !== "string") return null;

      const highlightedCode = await HighlightedCode({
        code: block.content,
        language: block.props?.language,
      });
      return <Fragment key={key}>{highlightedCode}</Fragment>;
    }
    default:
      return null;
  }
}

async function renderBlocks(
  blocks: PostBlock[],
  keyPrefix: string,
  inlineImages: Map<string, string>,
): Promise<ReactNode[]> {
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
      nodes.push(
        await renderList(
          list,
          type,
          `${keyPrefix}-list-${index}`,
          inlineImages,
        ),
      );
      continue;
    }

    nodes.push(
      await renderBlock(block, `${keyPrefix}-block-${index}`, inlineImages),
    );
  }

  return nodes;
}

export async function PostBody({ body, inlineImages = [] }: PostBodyProps) {
  const parsed = parsePostBody(body);

  if (parsed.kind !== "structured") return null;

  const resolvedImages = new Map(
    inlineImages.flatMap(({ storageId, url }) =>
      url ? [[storageId, url] as const] : [],
    ),
  );

  return (
    <div data-slot="post-body" className="space-y-5 text-lg">
      {await renderBlocks(parsed.document.blocks, "post", resolvedImages)}
    </div>
  );
}
