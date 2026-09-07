import {
  extractPlainText,
  parsePostBody,
  type BlockNoteDocument,
} from "./post-content";

export type OperationKind = "save-draft" | "publish" | "update-post";

export type WriteErrorCategory =
  | "unauthorized"
  | "not-found"
  | "invalid-proposal"
  | "invalid-media"
  | "capacity"
  | "conflict"
  | "attempt-missing"
  | "attempt-expired"
  | "indeterminate";

export type CanonicalProposal = {
  title: string;
  body: string;
  tags: string[];
  imageStorageId?: string;
};

export type WriteError = {
  category: WriteErrorCategory;
  message: string;
};

export type WriteResult = {
  postId: string;
  updatedAt: number;
  status: "draft" | "published";
};

export type OperationOutcome =
  | { kind: "succeeded"; result: WriteResult }
  | { kind: "failed"; error: WriteError }
  | { kind: "indeterminate"; message: string };

export type ProposalInput = {
  title: string;
  body: string;
  tags: readonly string[];
  imageStorageId?: string;
};

export function canonicalizeProposal(input: ProposalInput): CanonicalProposal {
  return {
    title: input.title,
    body: input.body,
    tags: [...input.tags],
    ...(input.imageStorageId === undefined
      ? {}
      : { imageStorageId: input.imageStorageId }),
  };
}

export function getProposalEqualityKey(input: ProposalInput): string {
  return JSON.stringify(canonicalizeProposal(input));
}

export async function fingerprintProposal(
  input: ProposalInput,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(getProposalEqualityKey(input)),
  );

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function createWriteError(
  category: WriteErrorCategory,
  message: string,
): WriteError {
  return { category, message };
}

export function getCanonicalBodyText(body: string): string | null {
  const parsed = parsePostBody(body);
  if (parsed.kind !== "structured") return null;

  return extractPlainText(parsed.document.blocks);
}

export function parseCanonicalDocument(body: string): BlockNoteDocument | null {
  const parsed = parsePostBody(body);
  return parsed.kind === "structured" ? parsed.document : null;
}
