"use client";

import { draftPostSchema, publishPostSchema } from "@/schemas/blog";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { FieldError, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PostTagSelector } from "@/components/web/PostTagSelector";
import type { BlockNoteDocument, PostBlock } from "@/lib/post-content";
import { extractImageStorageIds, parsePostBody } from "@/lib/post-content";
import {
  parseCanonicalDocument,
  getProposalEqualityKey,
  type CanonicalProposal,
} from "@/lib/write-contract";
import { clearDraftRecovery, readDraftRecovery } from "@/lib/draft-recovery";
import { useBlockNoteFileUpload } from "@/lib/use-inline-image-upload";
import { zodResolver } from "@hookform/resolvers/zod";
import { useConvex, useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";
import { getEditorCapabilities, resolveEditorMode } from "./editorMode";
import DocumentStudio from "./_components/DocumentStudio";
import MediaAuthoring, { type MediaAsset } from "./_components/MediaAuthoring";
import {
  getCoverRecoveryBlocker,
  getReviewBlocker,
  getReviewSubmitBlock,
  REVIEW_BLOCKER_MESSAGES,
  type CoverRecoveryState,
} from "./_components/reviewReadiness";
import ReviewSurface from "./_components/ReviewSurface";
import {
  buildSnapshotSubmission,
  captureReviewedSnapshot,
  type ReviewedSnapshot,
  type ReviewSubmission,
} from "./_components/reviewSnapshot";
import { useDraftRecovery } from "./_components/useDraftRecovery";
import {
  useWritingSession,
  type WritingSessionTarget,
} from "./_components/useWritingSession";

const PostBodyEditor = dynamic(() => import("./_components/PostBodyEditor"), {
  ssr: false,
  loading: () => <div className="min-h-96" aria-hidden="true" />,
});

const emptyDocument: BlockNoteDocument = {
  format: "blocknote@1",
  blocks: [],
};

// Matches the server's per-query batch cap in `getOwnedMediaUrls`.
const RESOLVE_MEDIA_BATCH = 100;

type PostFormInput = z.input<typeof draftPostSchema>;
type PostFormOutput = z.output<typeof draftPostSchema>;
type SubmitMode = "draft" | "publish";

function toLiveSubmission(
  values: PostFormOutput,
  coverStorageId?: string,
): ReviewSubmission {
  return {
    title: values.title,
    body: JSON.stringify(values.content),
    content: values.content,
    tags: [...values.tags],
    ...(values.image && { coverFile: values.image }),
    ...(coverStorageId && { existingCoverStorageId: coverStorageId }),
  };
}

function collectInlineMedia(
  blocks: BlockNoteDocument["blocks"],
  resolvedImageUrls: Record<string, string | null>,
): MediaAsset[] {
  const assets: MediaAsset[] = [];
  const visit = (items: BlockNoteDocument["blocks"]) => {
    for (const block of items) {
      const source = block.props?.source;
      if (
        (block.type === "image" ||
          block.type === "audio" ||
          block.type === "video") &&
        typeof source === "object" &&
        source !== null &&
        !Array.isArray(source) &&
        (source as { kind?: unknown }).kind === "storage" &&
        typeof (source as { id?: unknown }).id === "string"
      ) {
        const storageId = (source as { id: string }).id;
        const url = resolvedImageUrls[storageId];
        const props = block.props ?? {};
        const unavailable = url === null;
        assets.push({
          id: storageId,
          kind: "inline",
          mediaType:
            block.type === "audio"
              ? "audio"
              : block.type === "video"
                ? "video"
                : "image",
          status: unavailable ? "failed" : url ? "resolved" : "finalizing",
          ...(unavailable && {
            error: "This media is no longer available. Re-upload or remove it.",
          }),
          ...(url && { url }),
          fileName: typeof props.name === "string" ? props.name : "",
        });
      }
      if (block.children?.length) visit(block.children);
    }
  };
  visit(blocks);
  return assets;
}

/**
 * True when a proposal carries no authored work: no title, no tags, and only
 * empty paragraphs. The editor always materializes one empty paragraph, which
 * otherwise reads as an unsaved change on a brand-new post.
 */
function isEffectivelyEmptyProposal(proposal: CanonicalProposal): boolean {
  if (proposal.title.trim() || proposal.tags.length > 0) return false;
  const document = parseCanonicalDocument(proposal.body);
  if (!document) return false;
  return document.blocks.every(
    (block) =>
      block.type === "paragraph" &&
      (block.content?.length ?? 0) === 0 &&
      (block.children?.length ?? 0) === 0,
  );
}

/**
 * The silent local draft for a session, if one holds real work. Empty snapshots
 * are cleared so they never re-open an empty editor.
 */
function readRecoveredDraft(sessionKey: string): {
  document: BlockNoteDocument;
  proposal: CanonicalProposal;
  savedAt: number;
} | null {
  if (sessionKey.startsWith("published-edit:")) {
    clearDraftRecovery(sessionKey);
    return null;
  }
  const snapshot = readDraftRecovery(sessionKey);
  if (!snapshot) return null;
  if (isEffectivelyEmptyProposal(snapshot.proposal)) {
    clearDraftRecovery(sessionKey);
    return null;
  }
  const document = parseCanonicalDocument(snapshot.proposal.body);
  if (!document) return null;
  return {
    document,
    proposal: snapshot.proposal,
    savedAt: snapshot.savedAt,
  };
}

/**
 * Replaces or removes a storage-backed media source in a canonical document,
 * backing the inline-media Retry and Remove actions.
 */
function mapDocumentMediaSource(
  document: BlockNoteDocument,
  sourceId: string,
  replacementId: string | null,
): BlockNoteDocument {
  const isSource = (value: unknown) =>
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { kind?: unknown }).kind === "storage" &&
    (value as { id?: unknown }).id === sourceId;

  const mapBlocks = (blocks: PostBlock[]): PostBlock[] =>
    blocks.flatMap((block) => {
      const props = block.props ?? {};
      if (isSource(props.source)) {
        if (replacementId === null) return [];
        return [
          {
            ...block,
            props: {
              ...props,
              source: { kind: "storage", id: replacementId },
            },
          },
        ];
      }
      if (block.children?.length) {
        return [{ ...block, children: mapBlocks(block.children) }];
      }
      return [block];
    });

  return { ...document, blocks: mapBlocks(document.blocks) };
}

/**
 * Resolves storage-backed media in a restored recovery document back to URLs.
 * A refresh drops the client's object URLs, so the server is asked which ids
 * the caller still owns. Unresolved ids become `null`, which `collectInlineMedia`
 * maps to a failed asset so Review shows recovery guidance instead of being
 * stuck "finalizing" forever.
 */
async function resolveRecoveredMediaUrls(
  convex: ReturnType<typeof useConvex>,
  document: BlockNoteDocument,
  base: Record<string, string | null>,
): Promise<Record<string, string | null>> {
  const storageIds = extractImageStorageIds(
    document.blocks as Parameters<typeof extractImageStorageIds>[0],
  );
  if (storageIds.length === 0) return base;

  // Default every requested id to null until the server resolves it, so a
  // failed or partial query still marks the asset unavailable rather than
  // leaving it "finalizing" and blocking Review forever.
  const urls: Record<string, string | null> = { ...base };
  for (const storageId of storageIds) {
    urls[storageId] = base[storageId] ?? null;
  }

  try {
    for (
      let start = 0;
      start < storageIds.length;
      start += RESOLVE_MEDIA_BATCH
    ) {
      const batch = storageIds.slice(start, start + RESOLVE_MEDIA_BATCH);
      const resolved = await convex.query(
        api.sessionMediaClaims.getOwnedMediaUrls,
        { storageIds: batch as Id<"_storage">[] },
      );
      for (const { storageId, url } of resolved) {
        urls[storageId] = url;
      }
    }
  } catch {
    // Keep the null defaults for anything the server could not resolve.
  }
  return urls;
}

/**
 * Resolves one owned storage id to its display URL. Returns null when the
 * server cannot resolve it, so a recovered cover can surface an explicit
 * failure instead of silently disappearing.
 */
async function resolveOwnedMediaUrl(
  convex: ReturnType<typeof useConvex>,
  storageId: Id<"_storage">,
): Promise<string | null> {
  try {
    const resolved = await convex.query(
      api.sessionMediaClaims.getOwnedMediaUrls,
      { storageIds: [storageId] },
    );
    return resolved[0]?.url ?? null;
  } catch {
    return null;
  }
}

/**
 * Renders the authenticated blog post creation page.
 *
 * Redirects unauthenticated users to the login page and displays a loading state while authentication is unresolved.
 *
 * @returns The blog post creation interface
 */
export default function CreateRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <CreateEditor />
    </Suspense>
  );
}

function CreateEditor() {
  const convex = useConvex();
  const { uploadFile } = useBlockNoteFileUpload();
  const [isPending, startTransition] = useTransition();
  const [draftId, setDraftId] = useState<Id<"posts"> | undefined>();
  const [coverStorageId, setCoverStorageId] = useState<Id<"_storage">>();
  const [coverImageUrl, setCoverImageUrl] = useState<string | undefined>();
  const [coverRecovery, setCoverRecovery] = useState<CoverRecoveryState | null>(
    null,
  );
  const coverResolutionGeneration = useRef(0);
  const [reviewSnapshot, setReviewSnapshot] = useState<ReviewedSnapshot | null>(
    null,
  );
  const coverObjectUrlRef = useRef<string | undefined>(undefined);
  const [acceptedTargetError, setAcceptedTargetError] = useState<{
    targetKey: string;
    message: string;
  }>();
  const [initialContent, setInitialContent] = useState<BlockNoteDocument>();
  const [resolvedImageUrls, setResolvedImageUrls] = useState<
    Record<string, string | null>
  >({});
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedDraftId = searchParams.get("draftId");
  const requestedEditPostId = searchParams.get("editPostId");
  const requestedEditorMode = resolveEditorMode({
    draftId: requestedDraftId ?? undefined,
    editPostId: requestedEditPostId ?? undefined,
  });
  const requestedTargetId =
    requestedEditorMode.mode === "invalid" ? undefined : requestedEditorMode.id;
  const createPendingUpload = useMutation(
    api.pendingUploads.createPendingUpload,
  );
  const finalizePendingUpload = useMutation(
    api.pendingUploads.finalizePendingUpload,
  );
  const cleanupPendingUploads = useMutation(api.pendingUploads.cleanupPending);
  const claimSessionMedia = useMutation(api.sessionMediaClaims.claim);
  const renewSessionMedia = useMutation(api.sessionMediaClaims.renew);
  const releaseSessionMedia = useMutation(api.sessionMediaClaims.release);
  const saveDraft = useMutation(api.posts.saveDraft);
  const publishPost = useMutation(api.posts.publishPost);
  const updatePublishedPost = useMutation(api.posts.updatePublishedPost);
  const reserveAttempt = useMutation(api.writeAttempts.reserveAttempt);
  const inlineSessions = useRef(
    new Map<Id<"pendingUploads">, Id<"_storage">>(),
  );
  const clearedCoverSelection = useRef<File | undefined>(undefined);
  const selectedCoverRef = useRef<File | undefined>(undefined);
  const claimedMedia = useRef(new Set<Id<"_storage">>());
  const pendingClaims = useRef(new Set<Id<"_storage">>());
  const [recoveryNonce, setRecoveryNonce] = useState(0);
  const [historyResetKey, setHistoryResetKey] = useState(0);

  const form = useForm<PostFormInput, undefined, PostFormOutput>({
    resolver: zodResolver(draftPostSchema),
    defaultValues: {
      title: "",
      content: emptyDocument,
      tags: [],
      image: undefined,
    },
  });

  const [sessionState, dispatchSession] = useWritingSession(
    requestedEditorMode.mode === "invalid" ? "new" : requestedEditorMode.mode,
    requestedTargetId,
  );
  const editorMode = {
    mode: sessionState.editorMode,
    id: sessionState.targetId,
  };
  const activeTarget: WritingSessionTarget = {
    editorMode: editorMode.mode,
    id: editorMode.id,
  };
  const capabilities = getEditorCapabilities(editorMode.mode);
  const hydratedDraft = useQuery(
    api.posts.getDraftById,
    activeTarget.editorMode === "draft" && activeTarget.id
      ? { draftId: activeTarget.id as Id<"posts"> }
      : "skip",
  );
  const hydratedPublishedPost = useQuery(
    api.posts.getPublishedPostForEditing,
    activeTarget.editorMode === "published-edit" && activeTarget.id
      ? { postId: activeTarget.id as Id<"posts"> }
      : "skip",
  );
  const pendingDraft = useQuery(
    api.posts.getDraftById,
    sessionState.pendingTarget?.editorMode === "draft" &&
      sessionState.pendingTarget.id
      ? { draftId: sessionState.pendingTarget.id as Id<"posts"> }
      : "skip",
  );
  const pendingPublishedPost = useQuery(
    api.posts.getPublishedPostForEditing,
    sessionState.pendingTarget?.editorMode === "published-edit" &&
      sessionState.pendingTarget.id
      ? { postId: sessionState.pendingTarget.id as Id<"posts"> }
      : "skip",
  );
  const watchedValues = useWatch({ control: form.control });
  const inlineMedia = useMemo(
    () =>
      collectInlineMedia(
        watchedValues.content?.blocks ?? [],
        resolvedImageUrls,
      ),
    [resolvedImageUrls, watchedValues.content],
  );
  const coverMedia = useMemo<MediaAsset | null>(() => {
    const selected = watchedValues.image;
    if (selected instanceof File) {
      return {
        id: "cover-selection",
        kind: "cover",
        mediaType: "image",
        status: "choosing",
        fileName: selected.name,
        ...(coverImageUrl && { url: coverImageUrl }),
      };
    }
    if (!coverStorageId) return null;
    return {
      id: coverStorageId,
      kind: "cover",
      mediaType: "image",
      status: "resolved",
      ...(coverImageUrl && { url: coverImageUrl }),
      ...(coverRecovery && {
        fileName: "Saved cover",
        statusNote:
          coverRecovery === "resolving"
            ? "Loading cover preview"
            : "Cover preview unavailable",
      }),
    };
  }, [coverImageUrl, coverRecovery, coverStorageId, watchedValues.image]);
  const proposal = useMemo<CanonicalProposal>(
    () => ({
      title: watchedValues.title ?? "",
      body: JSON.stringify(watchedValues.content ?? emptyDocument),
      tags: [...(watchedValues.tags ?? [])],
      ...(coverStorageId && { imageStorageId: coverStorageId }),
    }),
    [
      coverStorageId,
      watchedValues.content,
      watchedValues.tags,
      watchedValues.title,
    ],
  );
  const hydratedSessionKey = useRef<string | undefined>(undefined);
  const activeSessionKeyRef = useRef<string | undefined>(undefined);
  const claimRecoveredMedia = useCallback(
    (urls: Record<string, string | null>) => {
      const sessionId = activeSessionKeyRef.current ?? "new:new";
      for (const [storageId, url] of Object.entries(urls)) {
        if (!url) continue;
        void Promise.resolve(
          claimSessionMedia({
            sessionId,
            storageId: storageId as Id<"_storage">,
          }),
        ).catch(() => {
          // Re-claiming is best effort; the resolved URL still renders.
        });
      }
    },
    [claimSessionMedia],
  );
  /**
   * Resolves a recovered cover URL under an explicit hold. The generation guard
   * makes a late result a no-op after any later target adoption, cover
   * selection, or removal, and the session guard covers a target change.
   */
  const startRecoveredCoverResolution = useCallback(
    (storageId: Id<"_storage">, sessionKey: string) => {
      const generation = ++coverResolutionGeneration.current;
      setCoverRecovery("resolving");
      void resolveOwnedMediaUrl(convex, storageId).then((url) => {
        if (coverResolutionGeneration.current !== generation) return;
        if (hydratedSessionKey.current !== sessionKey) return;
        if (url) {
          setCoverImageUrl(url);
          setCoverRecovery(null);
        } else {
          setCoverRecovery("failed");
        }
      });
    },
    [convex],
  );
  const requestedTarget = useMemo(
    () =>
      requestedEditorMode.mode === "invalid"
        ? undefined
        : {
            editorMode: requestedEditorMode.mode,
            id: requestedTargetId,
          },
    [requestedEditorMode.mode, requestedTargetId],
  );

  useEffect(() => {
    if (!requestedTarget) {
      if (sessionState.pendingTarget) {
        dispatchSession({ type: "rejectTarget" });
      }
      return;
    }

    const activeSessionKey = `${sessionState.editorMode}:${
      sessionState.targetId ?? "new"
    }`;
    const pendingTarget = sessionState.pendingTarget;
    const pendingSessionKey = pendingTarget
      ? `${pendingTarget.editorMode}:${pendingTarget.id ?? "new"}`
      : undefined;

    // A hydrated or adopted target replaces the active session's cover state, so
    // drop any residual selected cover file. Otherwise the transition guard
    // keeps prompting about a cover that no longer belongs to the form.
    const resetCoverSelectionRefs = () => {
      selectedCoverRef.current = undefined;
      clearedCoverSelection.current = undefined;
      if (coverObjectUrlRef.current) {
        URL.revokeObjectURL(coverObjectUrlRef.current);
        coverObjectUrlRef.current = undefined;
      }
      // Any target adoption invalidates an in-flight recovered-cover lookup so
      // a late result cannot overwrite the newly loaded cover state.
      coverResolutionGeneration.current += 1;
      setCoverRecovery(null);
    };

    if (pendingTarget && pendingSessionKey !== activeSessionKey) {
      if (pendingTarget.editorMode === "new") {
        form.reset({
          title: "",
          content: emptyDocument,
          tags: [],
          image: undefined,
        });
        dispatchSession({ type: "acceptTarget", target: pendingTarget });
        dispatchSession({
          type: "loadLatest",
          proposal: {
            title: "",
            body: JSON.stringify(emptyDocument),
            tags: [],
          },
        });
        setAcceptedTargetError(undefined);
        setDraftId(undefined);
        resetCoverSelectionRefs();
        setCoverStorageId(undefined);
        setCoverImageUrl(undefined);
        setInitialContent(emptyDocument);
        setResolvedImageUrls({});
        hydratedSessionKey.current = pendingSessionKey;
        return;
      }

      const pendingData =
        pendingTarget.editorMode === "draft"
          ? pendingDraft
          : pendingPublishedPost;
      if (pendingData === undefined) return;
      if (pendingData === null) {
        dispatchSession({ type: "rejectTarget" });
        setAcceptedTargetError({
          targetKey: pendingSessionKey!,
          message: "The requested document is unavailable.",
        });
        return;
      }

      const parsed = parsePostBody(pendingData.body);
      if (parsed.kind !== "structured") {
        dispatchSession({ type: "rejectTarget" });
        setAcceptedTargetError({
          targetKey: pendingSessionKey!,
          message: "The requested document is unavailable.",
        });
        return;
      }

      const latestProposal: CanonicalProposal = {
        title: pendingData.title,
        body: JSON.stringify(parsed.document),
        tags: [...pendingData.tags],
        ...(pendingData.imageStorageId && {
          imageStorageId: pendingData.imageStorageId,
        }),
      };
      form.reset({
        title: pendingData.title,
        content: parsed.document,
        tags: pendingData.tags as PostFormInput["tags"],
        image: undefined,
      });
      dispatchSession({ type: "acceptTarget", target: pendingTarget });
      dispatchSession({
        type: "loadLatest",
        proposal: latestProposal,
        expectedUpdatedAt: pendingData.updatedAt,
      });
      setAcceptedTargetError(undefined);
      if (pendingTarget.editorMode === "draft") setDraftId(pendingData._id);
      resetCoverSelectionRefs();
      setCoverStorageId(pendingData.imageStorageId ?? undefined);
      setCoverImageUrl(pendingData.imageUrl ?? undefined);
      setInitialContent(parsed.document);
      setResolvedImageUrls(
        Object.fromEntries(
          pendingData.inlineImages.map(({ storageId, url }) => [
            storageId,
            url,
          ]),
        ),
      );
      hydratedSessionKey.current = pendingSessionKey;
      return;
    }

    const requestedSessionKey = `${requestedTarget.editorMode}:${
      requestedTarget.id ?? "new"
    }`;
    if (requestedSessionKey !== activeSessionKey) {
      dispatchSession({ type: "requestTarget", target: requestedTarget });
      if (!sessionState.dirty) hydratedSessionKey.current = undefined;
      return;
    }

    const sessionKey = activeSessionKey;
    if (hydratedSessionKey.current === sessionKey) return;
    if (sessionState.dirty) return;
    resetCoverSelectionRefs();

    if (editorMode.mode === "new") {
      dispatchSession({
        type: "establishBaseline",
        proposal: {
          title: "",
          body: JSON.stringify(emptyDocument),
          tags: [],
        },
      });
      setDraftId(undefined);
      const recovered = readRecoveredDraft(sessionKey);
      if (recovered) {
        form.reset({
          title: recovered.proposal.title,
          content: recovered.document,
          tags: recovered.proposal.tags as PostFormInput["tags"],
          image: undefined,
        });
        const recoveredCoverStorageId = recovered.proposal.imageStorageId as
          | Id<"_storage">
          | undefined;
        setCoverStorageId(recoveredCoverStorageId);
        setCoverImageUrl(undefined);
        if (recoveredCoverStorageId) {
          startRecoveredCoverResolution(recoveredCoverStorageId, sessionKey);
        }
        setInitialContent(recovered.document);
        void resolveRecoveredMediaUrls(convex, recovered.document, {}).then(
          (urls) => {
            if (hydratedSessionKey.current !== sessionKey) return;
            setResolvedImageUrls(urls);
            claimRecoveredMedia(urls);
            setRecoveryNonce((nonce) => nonce + 1);
          },
        );
      } else {
        form.reset({
          title: "",
          content: emptyDocument,
          tags: [],
          image: undefined,
        });
        setCoverStorageId(undefined);
        setCoverImageUrl(undefined);
        setInitialContent(emptyDocument);
        setResolvedImageUrls({});
      }
      hydratedSessionKey.current = sessionKey;
      return;
    }

    const target =
      editorMode.mode === "draft" ? hydratedDraft : hydratedPublishedPost;
    if (
      (editorMode.mode !== "draft" && editorMode.mode !== "published-edit") ||
      target === undefined
    ) {
      return;
    }
    if (target === null) {
      return;
    }

    const parsed = parsePostBody(target.body);
    if (parsed.kind !== "structured") {
      return;
    }

    const serverProposal: CanonicalProposal = {
      title: target.title,
      body: JSON.stringify(parsed.document),
      tags: target.tags,
      ...(target.imageStorageId && { imageStorageId: target.imageStorageId }),
    };
    dispatchSession({
      type: "establishBaseline",
      proposal: serverProposal,
      expectedUpdatedAt: target.updatedAt,
    });
    const serverImages = Object.fromEntries(
      target.inlineImages.map(({ storageId, url }) => [storageId, url]),
    );
    const recovered = readRecoveredDraft(sessionKey);
    const serverUpdatedAt =
      typeof target.updatedAt === "number" ? target.updatedAt : 0;
    const matchesServer =
      recovered !== null &&
      getProposalEqualityKey(recovered.proposal) ===
        getProposalEqualityKey(serverProposal);
    // Restore only genuinely newer local work. A snapshot that matches the
    // server, or predates the server's latest save, is stale and must not
    // overwrite edits another client already persisted.
    const useRecovered =
      recovered !== null &&
      !matchesServer &&
      recovered.savedAt > serverUpdatedAt;
    if (recovered && !useRecovered) {
      clearDraftRecovery(sessionKey);
    }

    if (recovered && useRecovered) {
      form.reset({
        title: recovered.proposal.title,
        content: recovered.document,
        tags: recovered.proposal.tags as PostFormInput["tags"],
        image: undefined,
      });
      const recoveredCoverStorageId = recovered.proposal.imageStorageId as
        | Id<"_storage">
        | undefined;
      setCoverStorageId(recoveredCoverStorageId);
      setCoverImageUrl(undefined);
      if (recoveredCoverStorageId) {
        const reusedCoverUrl =
          recoveredCoverStorageId === target.imageStorageId &&
          typeof target.imageUrl === "string"
            ? target.imageUrl
            : null;
        if (reusedCoverUrl) {
          setCoverImageUrl(reusedCoverUrl);
        } else {
          startRecoveredCoverResolution(recoveredCoverStorageId, sessionKey);
        }
      }
      setInitialContent(recovered.document);
      void resolveRecoveredMediaUrls(
        convex,
        recovered.document,
        serverImages,
      ).then((urls) => {
        if (hydratedSessionKey.current !== sessionKey) return;
        setResolvedImageUrls(urls);
        claimRecoveredMedia(urls);
        setRecoveryNonce((nonce) => nonce + 1);
      });
    } else {
      form.reset({
        title: target.title,
        content: parsed.document,
        tags: target.tags as PostFormInput["tags"],
        image: undefined,
      });
      setCoverStorageId(target.imageStorageId ?? undefined);
      setCoverImageUrl(target.imageUrl ?? undefined);
      setInitialContent(parsed.document);
      setResolvedImageUrls(serverImages);
    }
    if (editorMode.mode === "draft") setDraftId(target._id);
    hydratedSessionKey.current = sessionKey;
  }, [
    claimRecoveredMedia,
    startRecoveredCoverResolution,
    convex,
    editorMode.mode,
    form,
    hydratedDraft,
    hydratedPublishedPost,
    pendingDraft,
    pendingPublishedPost,
    router,
    sessionState.dirty,
    sessionState.editorMode,
    sessionState.pendingTarget,
    sessionState.targetId,
    dispatchSession,
    requestedTarget,
  ]);

  useEffect(() => {
    if (!sessionState.baseline) return;
    dispatchSession({ type: "setProposal", proposal });
  }, [dispatchSession, proposal, sessionState.baseline]);

  useEffect(() => {
    if (
      clearedCoverSelection.current &&
      watchedValues.image === clearedCoverSelection.current
    ) {
      clearedCoverSelection.current = undefined;
      return;
    }
    const pending = inlineMedia
      .filter(
        (asset) =>
          asset.status === "uploading" || asset.status === "finalizing",
      )
      .map((asset) => asset.id);
    const failed = inlineMedia
      .filter((asset) => asset.status === "failed")
      .map((asset) => asset.id);
    const coverSelected = Boolean(watchedValues.image);
    if (
      sessionState.media.coverSelected === coverSelected &&
      sessionState.media.pending.join("|") === pending.join("|") &&
      sessionState.media.failed.join("|") === failed.join("|")
    )
      return;
    dispatchSession({
      type: "setMedia",
      media: { ...sessionState.media, coverSelected, pending, failed },
    });
  }, [dispatchSession, inlineMedia, sessionState.media, watchedValues.image]);

  useEffect(
    () => () => {
      if (coverObjectUrlRef.current) {
        URL.revokeObjectURL(coverObjectUrlRef.current);
      }
    },
    [],
  );

  const target =
    editorMode.mode === "draft"
      ? hydratedDraft
      : editorMode.mode === "published-edit"
        ? hydratedPublishedPost
        : undefined;
  const recovery =
    editorMode.mode === "draft"
      ? {
          message: "That draft is unavailable.",
          label: "Back to Drafts",
          path: "/dashboard/drafts",
        }
      : {
          message: "That published post is unavailable.",
          label: "Back to My Posts",
          path: "/dashboard/published",
        };

  const activeSessionKey = `${editorMode.mode}:${editorMode.id ?? "new"}`;
  activeSessionKeyRef.current = activeSessionKey;

  useDraftRecovery({
    sessionKey: activeSessionKey,
    ready: sessionState.baseline !== null,
    dirty: sessionState.dirty,
    proposal,
  });

  useEffect(() => {
    const sessionKey = activeSessionKey;
    const renew = () => {
      const storageIds = [...claimedMedia.current];
      if (storageIds.length === 0) return;
      const isVisible = document.visibilityState === "visible";
      const isActive = document.hasFocus();
      if (!isVisible || !isActive) return;
      // A transient initial claim failure is retried on focus and renewal,
      // independently of the content's actual availability.
      for (const storageId of pendingClaims.current) {
        if (!claimedMedia.current.has(storageId)) continue;
        void claimSessionMedia({ sessionId: sessionKey, storageId })
          .then(() => {
            if (activeSessionKeyRef.current === sessionKey)
              pendingClaims.current.delete(storageId);
          })
          .catch(() => undefined);
      }
      void Promise.resolve(
        renewSessionMedia({
          sessionId: sessionKey,
          storageIds,
          isVisible,
          isActive,
        }),
      ).catch(() => undefined);
    };
    const interval = window.setInterval(renew, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", renew);
    window.addEventListener("focus", renew);
    const claimedStorageIds = claimedMedia.current;
    const pendingStorageIds = pendingClaims.current;
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", renew);
      window.removeEventListener("focus", renew);
      const storageIds = [...claimedStorageIds];
      if (storageIds.length === 0) return;
      void Promise.resolve(
        releaseSessionMedia({ sessionId: sessionKey, storageIds }),
      ).catch(() => undefined);
      claimedStorageIds.clear();
      pendingStorageIds.clear();
    };
  }, [
    activeSessionKey,
    claimSessionMedia,
    releaseSessionMedia,
    renewSessionMedia,
  ]);

  if (requestedEditorMode.mode === "invalid" && !sessionState.dirty) {
    return (
      <DocumentStudio
        mode="invalid"
        state="unavailable"
        status={
          <UnavailableState
            message="This editor request is unavailable."
            recoveryLabel="Back to Dashboard"
            onRecover={() => router.push("/dashboard")}
          />
        }
      />
    );
  }
  const requestedSessionKey = requestedTarget
    ? `${requestedTarget.editorMode}:${requestedTarget.id ?? "new"}`
    : undefined;
  const targetTransition =
    (sessionState.dirty || Boolean(selectedCoverRef.current)) &&
    requestedTarget &&
    requestedSessionKey !== activeSessionKey
      ? requestedTarget
      : undefined;
  const targetError =
    acceptedTargetError && acceptedTargetError.targetKey === requestedSessionKey
      ? acceptedTargetError.message
      : undefined;
  const transitionNotice =
    requestedEditorMode.mode === "invalid" && sessionState.dirty ? (
      <UnavailableState
        message="This editor request is unavailable."
        recoveryLabel="Back to Dashboard"
        onRecover={() => router.push("/dashboard")}
      />
    ) : targetError || sessionState.pendingTarget || targetTransition ? (
      <TargetTransitionNotice
        error={targetError}
        loading={Boolean(sessionState.pendingTarget)}
        onConfirm={
          targetTransition && sessionState.operation.status !== "in-flight"
            ? () =>
                dispatchSession({
                  type: "confirmTarget",
                  target: targetTransition,
                })
            : undefined
        }
      />
    ) : undefined;

  if (editorMode.mode !== "new") {
    if (target === undefined) {
      return (
        <DocumentStudio
          mode={editorMode.mode}
          notice={transitionNotice}
          state="loading"
          status={
            <>
              <Loader2
                className="size-8 animate-spin text-muted-foreground"
                aria-label="Loading document"
              />
              <span className="sr-only">Loading document</span>
            </>
          }
        />
      );
    }

    if (target === null || parsePostBody(target.body).kind !== "structured") {
      return (
        <DocumentStudio
          mode={editorMode.mode}
          state="unavailable"
          status={
            <UnavailableState
              message={recovery.message}
              recoveryLabel={recovery.label}
              onRecover={() => router.push(recovery.path)}
            />
          }
        />
      );
    }
  }

  function onSubmit(submission: ReviewSubmission, mode: SubmitMode) {
    if (sessionState.pendingTarget) return;
    if (editorMode.mode === "published-edit") mode = "publish";
    // A recovered cover that is still resolving or failed blocks publishing
    // and updating. Draft saves stay available so the intent is never lost.
    if (mode === "publish" && coverRecovery) return;
    if (mode === "publish") {
      const publishValues = publishPostSchema.safeParse({
        title: submission.title,
        content: submission.content,
        tags: submission.tags,
        image: submission.coverFile,
      });
      if (!publishValues.success) {
        const issue = publishValues.error.issues[0];
        const field = issue?.path[0];
        if (field === "title" || field === "content") {
          form.setError(field, { message: issue.message });
        } else if (issue) {
          toast.error(issue.message);
        }
        return;
      }
    }

    const submittedImage = submission.coverFile;
    const operationSessionKey = `${sessionState.editorMode}:${
      sessionState.targetId ?? "new"
    }`;
    startTransition(async () => {
      const submitSessions = new Map(inlineSessions.current);
      let draftSaved = false;
      let unconsumedUploads: {
        sessionId: Id<"pendingUploads">;
        storageId: Id<"_storage">;
      }[] = [];
      let mutationSucceeded = false;
      let operationAttemptId: string | undefined;
      let operationSessionKeySettled = false;
      try {
        let storageId: Id<"_storage"> | undefined;

        if (submittedImage) {
          const session = await createPendingUpload({});
          const uploadResult = await fetch(session.uploadUrl, {
            method: "POST",
            headers: {
              "Content-Type": submittedImage.type,
            },
            body: submittedImage,
          });

          if (!uploadResult.ok) {
            toast.error("Failed to upload image");
            return;
          }

          const result = (await uploadResult.json()) as {
            storageId: Id<"_storage">;
          };
          storageId = result.storageId;
          const finalizeResult = await finalizePendingUpload({
            sessionId: session.sessionId,
            storageId,
          });
          if (!finalizeResult.accepted) {
            throw new Error("Invalid inline upload session");
          }
          submitSessions.set(session.sessionId, storageId);
          await claimSessionMedia({
            sessionId: operationSessionKey,
            storageId,
          });
          claimedMedia.current.add(storageId);
        }

        const savedCoverStorageId = (storageId ??
          submission.existingCoverStorageId) as Id<"_storage"> | undefined;
        const referencedStorageIds = new Set([
          ...extractImageStorageIds(submission.content.blocks),
          ...(savedCoverStorageId ? [savedCoverStorageId] : []),
        ]);
        unconsumedUploads = [...submitSessions.entries()]
          .filter(
            ([, currentStorageId]) =>
              !referencedStorageIds.has(currentStorageId),
          )
          .map(([sessionId, currentStorageId]) => ({
            sessionId,
            storageId: currentStorageId,
          }));

        const proposal = {
          title: submission.title,
          body: submission.body,
          tags: submission.tags,
          ...(savedCoverStorageId && { imageStorageId: savedCoverStorageId }),
        };
        const operationKind =
          editorMode.mode === "published-edit"
            ? "update-post"
            : mode === "publish"
              ? "publish"
              : "save-draft";
        const operationTarget =
          editorMode.mode === "published-edit"
            ? (sessionState.targetId as Id<"posts">)
            : draftId;
        const reservation = await reserveAttempt({
          clientRequestId: crypto.randomUUID(),
          operationKind,
          ...(operationTarget && { postId: operationTarget }),
          ...(sessionState.expectedUpdatedAt !== undefined && {
            expectedUpdatedAt: sessionState.expectedUpdatedAt,
          }),
          proposal,
        });
        dispatchSession({
          type: "beginOperation",
          operation: operationKind,
          attemptId: reservation.attemptId,
          sessionKey: operationSessionKey,
        });
        operationAttemptId = reservation.attemptId;
        const result =
          editorMode.mode === "published-edit"
            ? await updatePublishedPost({
                attemptId: reservation.attemptId,
                proposal,
              })
            : mode === "publish"
              ? await publishPost({
                  attemptId: reservation.attemptId,
                  proposal,
                })
              : await saveDraft({
                  attemptId: reservation.attemptId,
                  proposal,
                });
        if (result.kind === "failed") {
          dispatchSession({
            type: "finishOperation",
            attemptId: reservation.attemptId,
            sessionKey: operationSessionKey,
            outcome: { kind: "failed", message: result.message },
          });
          operationSessionKeySettled = true;
          throw new Error(result.message);
        }
        const persistedProposal: CanonicalProposal = {
          title: submission.title,
          body: submission.body,
          tags: [...submission.tags],
          ...(savedCoverStorageId && { imageStorageId: savedCoverStorageId }),
        };
        const isCurrentSession =
          activeSessionKeyRef.current === operationSessionKey;
        if (
          isCurrentSession &&
          submittedImage &&
          form.getValues("image") === submittedImage
        ) {
          clearedCoverSelection.current = submittedImage;
          selectedCoverRef.current = undefined;
          form.setValue("image", undefined, {
            shouldDirty: true,
            shouldTouch: true,
          });
        }
        if (isCurrentSession) {
          // Never erase edits made while the submitted save was in flight.
          // Re-hydrate only when the live body still matches the submission;
          // otherwise the editor keeps the newer content and the baseline
          // adoption marks the session dirty again.
          const liveMatchesSubmission =
            JSON.stringify(form.getValues("content")) ===
            JSON.stringify(submission.content);
          if (liveMatchesSubmission) {
            setHistoryResetKey((key) => key + 1);
            setInitialContent(submission.content);
          }
          setReviewSnapshot(null);
        }
        dispatchSession({
          type: "finishOperation",
          attemptId: reservation.attemptId,
          sessionKey: operationSessionKey,
          outcome: {
            kind: "succeeded",
            proposal: persistedProposal,
            expectedUpdatedAt: result.updatedAt,
          },
        });
        const currentCoverSelection = selectedCoverRef.current;
        if (
          isCurrentSession &&
          currentCoverSelection &&
          currentCoverSelection !== submittedImage
        ) {
          dispatchSession({
            type: "setMedia",
            media: { ...sessionState.media, coverSelected: true },
          });
        }
        operationSessionKeySettled = true;
        if (isCurrentSession) {
          draftSaved = mode === "draft";
          if (result.status === "draft") {
            setDraftId(result.postId);
            setCoverStorageId(savedCoverStorageId);
          }
        }
        mutationSucceeded = true;

        if (unconsumedUploads.length > 0) {
          try {
            await cleanupPendingUploads({ uploads: unconsumedUploads });
          } catch (cleanupError) {
            console.error("Failed to clean up inline uploads", cleanupError);
          }
        }
        for (const [sessionId, storageId] of submitSessions) {
          if (
            inlineSessions.current.get(sessionId) === storageId &&
            referencedStorageIds.has(storageId)
          ) {
            inlineSessions.current.delete(sessionId);
            claimedMedia.current.delete(storageId);
            pendingClaims.current.delete(storageId);
          }
        }
        if (!isCurrentSession) return;
        if (editorMode.mode === "published-edit") {
          toast.success("Post updated successfully!");
          router.push("/dashboard/published");
        } else if (mode === "publish") {
          toast.success("Post published successfully!");
          router.push("/blog");
        } else {
          toast.success("Draft saved successfully!");
        }
      } catch (error) {
        console.error("Save post failed", error);
        if (operationAttemptId && !operationSessionKeySettled) {
          dispatchSession({
            type: "finishOperation",
            attemptId: operationAttemptId,
            sessionKey: operationSessionKey,
            outcome: {
              kind: "indeterminate",
              message: "The save result could not be confirmed.",
            },
          });
          operationSessionKeySettled = true;
        }
        if (
          !mutationSucceeded &&
          (editorMode.mode === "published-edit" ||
            (!draftSaved && unconsumedUploads.length === 0))
        ) {
          unconsumedUploads = [...submitSessions.entries()].map(
            ([sessionId, storageId]) => ({ sessionId, storageId }),
          );
        }
        if (unconsumedUploads.length > 0) {
          try {
            await cleanupPendingUploads({ uploads: unconsumedUploads });
          } catch (cleanupError) {
            console.error("Failed to clean up inline uploads", cleanupError);
          }
          for (const { sessionId, storageId } of unconsumedUploads) {
            if (inlineSessions.current.get(sessionId) === storageId) {
              inlineSessions.current.delete(sessionId);
            }
          }
        }

        const message = error instanceof Error ? error.message : String(error);
        toast.error(
          message.includes("Inline image expired")
            ? "An inline image expired. Re-upload it and try again."
            : "Failed to save post",
        );
      }
    });
  }

  const reviewing = sessionState.presentation === "review";
  const coverRemoved = sessionState.coverRemoved;
  const reviewModeLabel =
    editorMode.mode === "published-edit"
      ? "Reviewing update"
      : editorMode.mode === "draft"
        ? "Reviewing draft"
        : "Reviewing new post";
  const reviewBlocker =
    getReviewBlocker(sessionState.media) ??
    getCoverRecoveryBlocker(coverRecovery);
  const reviewInlineImages = Object.entries(resolvedImageUrls)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .map(([storageId, url]) => ({ storageId, url }));

  function replaceInlineMedia(storageId: string) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,audio/*,video/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      void (async () => {
        try {
          const nextStorageId = await uploadFile(file);
          const objectUrl = URL.createObjectURL(file);
          setResolvedImageUrls((current) => ({
            ...current,
            [nextStorageId]: objectUrl,
          }));
          const nextContent = mapDocumentMediaSource(
            watchedValues.content as BlockNoteDocument,
            storageId,
            nextStorageId,
          );
          form.setValue("content", nextContent, {
            shouldDirty: true,
            shouldTouch: true,
          });
          setInitialContent(nextContent);
          dispatchSession({ type: "clearFailedMedia", storageId });
          void Promise.resolve(
            claimSessionMedia({
              sessionId: activeSessionKeyRef.current ?? "new:new",
              storageId: nextStorageId as Id<"_storage">,
            }),
          ).catch(() => {});
          setRecoveryNonce((nonce) => nonce + 1);
        } catch {
          toast.error("Could not replace the media. Try again or remove it.");
        }
      })();
    };
    input.click();
  }

  function removeInlineMedia(storageId: string) {
    claimedMedia.current.delete(storageId as Id<"_storage">);
    pendingClaims.current.delete(storageId as Id<"_storage">);
    const nextContent = mapDocumentMediaSource(
      watchedValues.content as BlockNoteDocument,
      storageId,
      null,
    );
    form.setValue("content", nextContent, {
      shouldDirty: true,
      shouldTouch: true,
    });
    setInitialContent(nextContent);
    setResolvedImageUrls((current) => {
      const next = { ...current };
      delete next[storageId];
      return next;
    });
    dispatchSession({ type: "clearFailedMedia", storageId });
    void Promise.resolve(
      releaseSessionMedia({
        sessionId: activeSessionKeyRef.current ?? "new:new",
        storageIds: [storageId as Id<"_storage">],
      }),
    ).catch(() => {});
    setRecoveryNonce((nonce) => nonce + 1);
  }

  function enterReview() {
    if (reviewBlocker) {
      toast.error(REVIEW_BLOCKER_MESSAGES[reviewBlocker]);
      return;
    }
    void form.handleSubmit((values) => {
      const publishValues = publishPostSchema.safeParse(values);
      if (!publishValues.success) {
        const issue = publishValues.error.issues[0];
        const field = issue?.path[0];
        if (field === "title" || field === "content") {
          form.setError(field, { message: issue.message });
        } else if (issue) {
          toast.error(issue.message);
        }
        return;
      }
      const reviewedProposal: CanonicalProposal = {
        title: publishValues.data.title,
        body: JSON.stringify(publishValues.data.content),
        tags: [...publishValues.data.tags],
      };
      setReviewSnapshot(
        captureReviewedSnapshot(
          reviewedProposal,
          {
            selectedFile: selectedCoverRef.current,
            existingStorageId: coverStorageId,
            removed: coverRemoved,
          },
          {
            ...(coverImageUrl && { coverPreviewUrl: coverImageUrl }),
            inlineImages: reviewInlineImages,
          },
        ),
      );
      dispatchSession({ type: "enterReview" });
    })();
  }

  function backToEditing() {
    setReviewSnapshot(null);
    dispatchSession({ type: "returnToEdit" });
  }

  function submitFromReview() {
    const snapshot = reviewSnapshot;
    if (!snapshot) return;
    const blocker = reviewBlocker;
    const block = getReviewSubmitBlock({
      isPending,
      hasPendingTarget: Boolean(sessionState.pendingTarget),
      blocker,
    });
    if (block) {
      if (blocker) toast.error(REVIEW_BLOCKER_MESSAGES[blocker]);
      return;
    }
    onSubmit(buildSnapshotSubmission(snapshot), "publish");
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <DocumentStudio
        mode={editorMode.mode}
        detailsHidden={reviewing}
        modeLabel={reviewing ? reviewModeLabel : undefined}
        notice={transitionNotice}
        heading={
          reviewing
            ? undefined
            : editorMode.mode === "published-edit"
              ? "Edit Published Post"
              : "New Post"
        }
        description={
          reviewing
            ? undefined
            : "Give your ideas a home. Draft a deep dive, share a quick update, or capture a fleeting thought to share with your community."
        }
        title={
          <div
            hidden={reviewing}
            inert={reviewing ? true : undefined}
            aria-hidden={reviewing || undefined}
          >
            <Controller
              name="title"
              control={form.control}
              render={({ field, fieldState }) => (
                <div className="space-y-2">
                  <Input
                    aria-label="Blog title"
                    aria-invalid={fieldState.invalid}
                    className="h-auto border-0 bg-transparent px-0 py-2 text-4xl font-semibold tracking-tight shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0 sm:text-5xl"
                    placeholder="Give your thought a name"
                    {...field}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </div>
              )}
            />
          </div>
        }
        body={
          <>
            <div
              hidden={reviewing}
              inert={reviewing ? true : undefined}
              aria-hidden={reviewing || undefined}
            >
              <Controller
                name="content"
                control={form.control}
                render={({ field, fieldState }) => (
                  <div data-invalid={fieldState.invalid}>
                    <span id="blog-content-label" className="sr-only">
                      Blog content
                    </span>
                    <PostBodyEditor
                      historyResetKey={historyResetKey}
                      key={`${editorMode.mode}:${editorMode.id ?? "new"}:${recoveryNonce}`}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      invalid={fieldState.invalid}
                      isDirty={sessionState.dirty}
                      labelledBy="blog-content-label"
                      initialContent={initialContent}
                      resolvedImageUrls={resolvedImageUrls}
                      onUploadSessionCreated={(
                        sessionId,
                        storageId,
                        objectUrl,
                      ) => {
                        inlineSessions.current.set(sessionId, storageId);
                        setResolvedImageUrls((current) => ({
                          ...current,
                          [storageId]: objectUrl,
                        }));
                        claimedMedia.current.add(storageId);
                        pendingClaims.current.add(storageId);
                        const sessionKey = activeSessionKey;
                        void Promise.resolve(
                          claimSessionMedia({
                            sessionId: sessionKey,
                            storageId,
                          }),
                        )
                          .then(() => {
                            if (activeSessionKeyRef.current === sessionKey)
                              pendingClaims.current.delete(storageId);
                          })
                          .catch(() => {
                            // Protection bookkeeping must not turn a usable image
                            // into failed content. Retry only for this live upload.
                            if (
                              activeSessionKeyRef.current !== sessionKey ||
                              inlineSessions.current.get(sessionId) !==
                                storageId ||
                              !claimedMedia.current.has(storageId)
                            )
                              return;
                            void claimSessionMedia({
                              sessionId: sessionKey,
                              storageId,
                            })
                              .then(() => {
                                if (activeSessionKeyRef.current === sessionKey)
                                  pendingClaims.current.delete(storageId);
                              })
                              .catch(() => undefined);
                          });
                      }}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </div>
                )}
              />
            </div>
            {reviewing && reviewSnapshot && (
              <ReviewSurface
                mode={editorMode.mode}
                proposal={{
                  title: reviewSnapshot.title,
                  body: reviewSnapshot.body,
                  tags: reviewSnapshot.tags,
                }}
                inlineImages={reviewSnapshot.inlineImages}
                coverUrl={reviewSnapshot.coverPreviewUrl}
                blockerMessage={
                  reviewBlocker
                    ? REVIEW_BLOCKER_MESSAGES[reviewBlocker]
                    : undefined
                }
              />
            )}
          </>
        }
        details={
          <FieldGroup className="gap-y-4">
            <MediaAuthoring
              inlineImages={inlineMedia}
              cover={coverMedia}
              coverInputAriaLabel="Image (optional)"
              coverRecovery={coverRecovery}
              onChooseCover={(file) =>
                (() => {
                  selectedCoverRef.current = file;
                  if (coverObjectUrlRef.current) {
                    URL.revokeObjectURL(coverObjectUrlRef.current);
                  }
                  const objectUrl = URL.createObjectURL(file);
                  coverObjectUrlRef.current = objectUrl;
                  setCoverImageUrl(objectUrl);
                  coverResolutionGeneration.current += 1;
                  setCoverRecovery(null);
                  dispatchSession({ type: "setCoverRemoved", removed: false });
                  form.setValue("image", file, {
                    shouldDirty: true,
                    shouldTouch: true,
                  });
                  dispatchSession({
                    type: "setMedia",
                    media: { ...sessionState.media, coverSelected: true },
                  });
                })()
              }
              onRemoveCover={() => {
                selectedCoverRef.current = undefined;
                if (coverObjectUrlRef.current) {
                  URL.revokeObjectURL(coverObjectUrlRef.current);
                  coverObjectUrlRef.current = undefined;
                }
                setCoverImageUrl(undefined);
                coverResolutionGeneration.current += 1;
                setCoverRecovery(null);
                dispatchSession({ type: "setCoverRemoved", removed: true });
                form.setValue("image", undefined, {
                  shouldDirty: true,
                  shouldTouch: true,
                });
                setCoverStorageId(undefined);
              }}
              onReplaceMedia={replaceInlineMedia}
              onRemoveInline={removeInlineMedia}
              coverNote={
                editorMode.mode === "published-edit"
                  ? "Uploads when you update"
                  : "Uploads when you save or publish"
              }
            />
            {form.formState.errors.image && (
              <FieldError errors={[form.formState.errors.image]} />
            )}
            <Controller
              name="tags"
              control={form.control}
              render={({ field }) => (
                <PostTagSelector
                  value={field.value ?? []}
                  onChange={field.onChange}
                />
              )}
            />
          </FieldGroup>
        }
        actions={
          reviewing ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={backToEditing}
              >
                Back to editing
              </Button>
              <Button
                type="button"
                disabled={isPending || Boolean(reviewBlocker)}
                onClick={submitFromReview}
              >
                {isPending
                  ? editorMode.mode === "published-edit"
                    ? "Updating..."
                    : "Publishing..."
                  : editorMode.mode === "published-edit"
                    ? "Update Post"
                    : "Publish"}
              </Button>
            </>
          ) : (
            <>
              {capabilities.canSaveDraft && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending || Boolean(sessionState.pendingTarget)}
                  onClick={() => {
                    void form.handleSubmit((values) =>
                      onSubmit(
                        toLiveSubmission(values, coverStorageId),
                        "draft",
                      ),
                    )();
                  }}
                >
                  Save Draft
                </Button>
              )}
              {capabilities.canPublish && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending || Boolean(sessionState.pendingTarget)}
                  onClick={enterReview}
                >
                  Review for publication
                </Button>
              )}
              {capabilities.canUpdate && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending || Boolean(sessionState.pendingTarget)}
                  onClick={enterReview}
                >
                  Review Update
                </Button>
              )}
            </>
          )
        }
      />
    </form>
  );
}

function UnavailableState({
  message,
  recoveryLabel,
  onRecover,
}: {
  message: string;
  recoveryLabel: string;
  onRecover: () => void;
}) {
  return (
    <div className="flex max-w-md flex-col items-center gap-4 text-center">
      <p className="text-lg font-medium">{message}</p>
      <Button type="button" onClick={onRecover}>
        {recoveryLabel}
      </Button>
    </div>
  );
}

function TargetTransitionNotice({
  error,
  loading,
  onConfirm,
}: {
  error?: string;
  loading: boolean;
  onConfirm?: () => void;
}) {
  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm">
        {error}
      </div>
    );
  }
  if (loading) {
    return (
      <div className="rounded-md border bg-muted/30 p-4 text-sm" role="status">
        Loading the requested document…
      </div>
    );
  }
  if (!onConfirm) return null;
  return (
    <div className="flex flex-col gap-3 rounded-md border border-amber-500/50 bg-amber-500/5 p-4 text-sm">
      <p>
        You have unsaved changes. Load the requested document and discard this
        session?
      </p>
      <Button type="button" variant="outline" onClick={onConfirm}>
        Load requested document
      </Button>
    </div>
  );
}
