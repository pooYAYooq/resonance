"use client";

import { draftPostSchema, publishPostSchema } from "@/schemas/blog";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { FieldError, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PostTagSelector } from "@/components/web/PostTagSelector";
import type { BlockNoteDocument } from "@/lib/post-content";
import { extractImageStorageIds, parsePostBody } from "@/lib/post-content";
import {
  parseCanonicalDocument,
  getProposalEqualityKey,
  type CanonicalProposal,
} from "@/lib/write-contract";
import { clearDraftRecovery, readDraftRecovery } from "@/lib/draft-recovery";
import { zodResolver } from "@hookform/resolvers/zod";
import { useConvex, useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
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
  getReviewBlocker,
  REVIEW_BLOCKER_MESSAGES,
} from "./_components/reviewReadiness";
import ReviewSurface from "./_components/ReviewSurface";
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

function collectInlineMedia(
  blocks: BlockNoteDocument["blocks"],
  resolvedImageUrls: Record<string, string | null>,
  failedIds: readonly string[] = [],
): MediaAsset[] {
  const assets: MediaAsset[] = [];
  const failed = new Set(failedIds);
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
        const claimFailed = failed.has(storageId);
        const unavailable = url === null;
        assets.push({
          id: storageId,
          kind: "inline",
          status:
            claimFailed || unavailable
              ? "failed"
              : url
                ? "resolved"
                : "finalizing",
          ...(claimFailed && { error: "Media claim failed" }),
          ...(unavailable &&
            !claimFailed && {
              error:
                "This media is no longer available. Re-upload or remove it.",
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
    urls[storageId] = null;
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
  const [isPending, startTransition] = useTransition();
  const [draftId, setDraftId] = useState<Id<"posts"> | undefined>();
  const [coverStorageId, setCoverStorageId] = useState<Id<"_storage">>();
  const [coverImageUrl, setCoverImageUrl] = useState<string | undefined>();
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
  const [recoveryNonce, setRecoveryNonce] = useState(0);

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
        sessionState.media.failed,
      ),
    [resolvedImageUrls, sessionState.media.failed, watchedValues.content],
  );
  const coverMedia = useMemo<MediaAsset | null>(() => {
    const selected = watchedValues.image;
    if (selected instanceof File) {
      return {
        id: "cover-selection",
        kind: "cover",
        status: "choosing",
        fileName: selected.name,
        ...(coverImageUrl && { url: coverImageUrl }),
      };
    }
    if (!coverStorageId) return null;
    return {
      id: coverStorageId,
      kind: "cover",
      status: "resolved",
      ...(coverImageUrl && { url: coverImageUrl }),
    };
  }, [coverImageUrl, coverStorageId, watchedValues.image]);
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
        setCoverStorageId(
          recovered.proposal.imageStorageId as Id<"_storage"> | undefined,
        );
        setCoverImageUrl(undefined);
        setInitialContent(recovered.document);
        void resolveRecoveredMediaUrls(convex, recovered.document, {}).then(
          (urls) => {
            if (hydratedSessionKey.current !== sessionKey) return;
            setResolvedImageUrls(urls);
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
      setCoverStorageId(
        recovered.proposal.imageStorageId as Id<"_storage"> | undefined,
      );
      setCoverImageUrl(undefined);
      setInitialContent(recovered.document);
      void resolveRecoveredMediaUrls(
        convex,
        recovered.document,
        serverImages,
      ).then((urls) => {
        if (hydratedSessionKey.current !== sessionKey) return;
        setResolvedImageUrls(urls);
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
      .filter(
        (asset) => asset.status === "failed" || asset.status === "expired",
      )
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
    };
  }, [activeSessionKey, releaseSessionMedia, renewSessionMedia]);

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

  function onSubmit(values: PostFormOutput, mode: SubmitMode) {
    if (sessionState.pendingTarget) return;
    if (editorMode.mode === "published-edit") mode = "publish";
    if (mode === "publish") {
      const publishValues = publishPostSchema.safeParse(values);
      if (!publishValues.success) {
        const issue = publishValues.error.issues[0];
        const field = issue?.path[0];
        if (field === "title" || field === "content") {
          form.setError(field, { message: issue.message });
        }
        return;
      }
    }

    const submittedImage = values.image;
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

        if (values.image) {
          const session = await createPendingUpload({});
          const uploadResult = await fetch(session.uploadUrl, {
            method: "POST",
            headers: {
              "Content-Type": values.image.type,
            },
            body: values.image,
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

        const savedCoverStorageId = storageId ?? coverStorageId;
        const referencedStorageIds = new Set([
          ...extractImageStorageIds(values.content.blocks),
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
          title: values.title,
          body: JSON.stringify(values.content),
          tags: values.tags,
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
          title: values.title,
          body: JSON.stringify(values.content),
          tags: [...values.tags],
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
          form.resetField("image", { defaultValue: undefined });
        }
        if (isCurrentSession) setInitialContent(values.content);
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
  const reviewBlocker = getReviewBlocker(sessionState.media);
  const reviewInlineImages = Object.entries(resolvedImageUrls)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .map(([storageId, url]) => ({ storageId, url }));

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
        }
        return;
      }
      dispatchSession({ type: "enterReview" });
    })();
  }

  function submitFromReview() {
    void form.handleSubmit((values) => onSubmit(values, "publish"))();
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <DocumentStudio
        mode={editorMode.mode}
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
                        void Promise.resolve(
                          claimSessionMedia({
                            sessionId: activeSessionKeyRef.current ?? "new:new",
                            storageId,
                          }),
                        ).catch(() => {
                          dispatchSession({
                            type: "appendFailedMedia",
                            storageId,
                          });
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
            {reviewing && sessionState.proposal && (
              <ReviewSurface
                mode={editorMode.mode}
                proposal={sessionState.proposal}
                inlineImages={reviewInlineImages}
                coverUrl={coverImageUrl}
                pending={isPending}
                onBack={() => dispatchSession({ type: "returnToEdit" })}
                onSubmit={submitFromReview}
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
              onChooseCover={(file) =>
                (() => {
                  selectedCoverRef.current = file;
                  if (coverObjectUrlRef.current) {
                    URL.revokeObjectURL(coverObjectUrlRef.current);
                  }
                  const objectUrl = URL.createObjectURL(file);
                  coverObjectUrlRef.current = objectUrl;
                  setCoverImageUrl(objectUrl);
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
                form.resetField("image", { defaultValue: undefined });
                setCoverStorageId(undefined);
              }}
              onRetry={() => toast.info("Select the image again to retry.")}
            />
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
          reviewing ? undefined : (
            <>
              {capabilities.canSaveDraft && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending || Boolean(sessionState.pendingTarget)}
                  onClick={() => {
                    void form.handleSubmit((values) =>
                      onSubmit(values, "draft"),
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
