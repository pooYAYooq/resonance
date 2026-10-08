import {
  getProposalEqualityKey,
  parseCanonicalDocument,
  type CanonicalProposal,
} from "./write-contract";

export function isEffectivelyEmptyProposal(
  proposal: CanonicalProposal,
): boolean {
  if (
    proposal.title.trim() ||
    proposal.tags.length > 0 ||
    proposal.imageStorageId
  )
    return false;
  const document = parseCanonicalDocument(proposal.body);
  if (!document) return false;
  return document.blocks.every(
    (block) =>
      block.type === "paragraph" &&
      (!block.content ||
        (Array.isArray(block.content) && block.content.length === 0)) &&
      (block.children?.length ?? 0) === 0 &&
      Object.entries(block.props ?? {}).every(
        ([name, value]) =>
          ((name === "backgroundColor" || name === "textColor") &&
            value === "default") ||
          (name === "textAlignment" && value === "left"),
      ),
  );
}

export function hasUnsavedAuthoringWork(
  proposal: CanonicalProposal,
  baseline: CanonicalProposal,
): boolean {
  if (getProposalEqualityKey(proposal) === getProposalEqualityKey(baseline))
    return false;
  return !(
    isEffectivelyEmptyProposal(proposal) && isEffectivelyEmptyProposal(baseline)
  );
}
