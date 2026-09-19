import type { ReactNode } from "react";
import { Fragment } from "react";
import type { PostBlock } from "@/lib/post-content";
import { parsePostBody } from "@/lib/post-content";
import { HighlightedCodeClient } from "./HighlightedCodeClient";
import {
  getBlockColorAttributes,
  getHeadingClassName,
  getHeadingTagName,
  getInlineText,
  getMediaUrl,
  getTextAlignment,
  renderInlineContent,
  renderTable,
} from "./post-body-shared";

export type PreviewInlineImage = { storageId: string; url: string | null };

type PostBodyPreviewProps = {
  body: string;
  inlineImages?: PreviewInlineImage[];
};

function renderContent(block: PostBlock, key: string): ReactNode {
  return typeof block.content === "string"
    ? block.content
    : renderInlineContent(block.content, key);
}

function renderMedia(
  block: PostBlock,
  key: string,
  resolved: Map<string, string>,
): ReactNode {
  const url = getMediaUrl(block, resolved);
  if (!url) return null;
  const name = typeof block.props?.name === "string" ? block.props.name : "";
  const caption =
    typeof block.props?.caption === "string" ? block.props.caption : "";
  const alignment = getTextAlignment(block.props);

  if (block.type === "image") {
    return (
      <figure
        key={key}
        className={alignment}
        {...getBlockColorAttributes(block.props)}
      >
        {/* Resolved storage URLs and validated HTTP(S) URLs are safe attributes. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={name} />
        {caption ? (
          <figcaption className="mt-2 text-sm text-muted-foreground">
            {caption}
          </figcaption>
        ) : null}
      </figure>
    );
  }
  if (block.type === "audio") {
    return (
      <figure key={key} {...getBlockColorAttributes(block.props)}>
        <audio controls src={url} />
        {caption ? (
          <figcaption className="mt-2 text-sm text-muted-foreground">
            {caption}
          </figcaption>
        ) : null}
      </figure>
    );
  }
  if (block.type === "video") {
    return (
      <figure
        key={key}
        className={alignment}
        {...getBlockColorAttributes(block.props)}
      >
        <video controls src={url} />
        {caption ? (
          <figcaption className="mt-2 text-sm text-muted-foreground">
            {caption}
          </figcaption>
        ) : null}
      </figure>
    );
  }
  return null;
}

function renderChildren(
  block: PostBlock,
  key: string,
  resolved: Map<string, string>,
): ReactNode {
  return block.children?.length
    ? renderBlocks(block.children, `${key}-children`, resolved)
    : null;
}

function renderList(
  blocks: PostBlock[],
  type: "bulletListItem" | "numberedListItem",
  key: string,
  resolved: Map<string, string>,
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
      {blocks.map((block, index) => (
        <li
          key={`${key}-${index}`}
          className={getTextAlignment(block.props)}
          {...getBlockColorAttributes(block.props)}
        >
          {renderContent(block, `${key}-${index}`)}
          {renderChildren(block, `${key}-${index}`, resolved)}
        </li>
      ))}
    </List>
  );
}

function renderBlock(
  block: PostBlock,
  key: string,
  resolved: Map<string, string>,
): ReactNode {
  if (["image", "audio", "video"].includes(block.type ?? "")) {
    return renderMedia(block, key, resolved);
  }
  if (block.type === "divider") return <hr key={key} />;
  if (block.type === "table") return renderTable(block, key);
  if (block.type === "codeBlock" && typeof block.content === "string") {
    return (
      <HighlightedCodeClient
        key={key}
        code={block.content}
        language={block.props?.language}
      />
    );
  }

  const content = renderContent(block, key);
  const children = renderChildren(block, key, resolved);
  if (block.type === "heading") {
    const level = block.props?.level;
    const Heading = getHeadingTagName(level);
    return (
      <Fragment key={key}>
        <Heading
          {...getBlockColorAttributes(block.props)}
          className={`${getHeadingClassName(level)} ${getTextAlignment(block.props)}`}
        >
          {content}
        </Heading>
        {children}
      </Fragment>
    );
  }
  if (block.type === "quote") {
    return (
      <blockquote
        {...getBlockColorAttributes(block.props)}
        key={key}
        className="border-l-2 border-border pl-4 italic text-muted-foreground"
      >
        {content}
        {children}
      </blockquote>
    );
  }
  if (block.type === "checkListItem") {
    return (
      <label
        {...getBlockColorAttributes(block.props)}
        key={key}
        className={`flex gap-2 ${getTextAlignment(block.props)}`}
      >
        <input
          type="checkbox"
          checked={block.props?.checked === true}
          readOnly
          aria-label={
            typeof block.content === "string"
              ? block.content
              : getInlineText(block.content)
          }
        />
        {content}
        {children}
      </label>
    );
  }
  if (block.type === "toggleListItem") {
    return (
      <details key={key} {...getBlockColorAttributes(block.props)}>
        <summary className={getTextAlignment(block.props)}>{content}</summary>
        {children}
      </details>
    );
  }
  return (
    <Fragment key={key}>
      <p
        {...getBlockColorAttributes(block.props)}
        className={`leading-relaxed text-foreground/90 ${getTextAlignment(block.props)}`}
      >
        {content}
      </p>
      {children}
    </Fragment>
  );
}

function renderBlocks(
  blocks: PostBlock[],
  keyPrefix: string,
  resolved: Map<string, string>,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (block.type === "bulletListItem" || block.type === "numberedListItem") {
      const type = block.type;
      const list: PostBlock[] = [];
      while (blocks[index]?.type === type) list.push(blocks[index++]);
      index -= 1;
      nodes.push(
        renderList(list, type, `${keyPrefix}-list-${index}`, resolved),
      );
      continue;
    }
    nodes.push(renderBlock(block, `${keyPrefix}-block-${index}`, resolved));
  }
  return nodes;
}

/**
 * Synchronous public-style renderer for client-side previews (Review). Mirrors
 * `PostBody`, but renders code blocks without syntax highlighting because the
 * server highlighter is not available on the client.
 */
export function PostBodyPreview({
  body,
  inlineImages = [],
}: PostBodyPreviewProps) {
  const parsed = parsePostBody(body);
  if (parsed.kind !== "structured") return null;
  const resolved = new Map(
    inlineImages.flatMap(({ storageId, url }) =>
      url ? [[storageId, url] as const] : [],
    ),
  );
  return (
    <div data-slot="post-body-preview" className="space-y-5 text-lg">
      {renderBlocks(parsed.document.blocks, "preview", resolved)}
    </div>
  );
}
