"use client";

import { draftPostSchema, publishPostSchema } from "@/schemas/blog";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PostTagSelector } from "@/components/web/PostTagSelector";
import type { BlockNoteDocument } from "@/lib/post-content";
import { extractImageStorageIds, parsePostBody } from "@/lib/post-content";
import type { CanonicalProposal } from "@/lib/write-contract";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
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
import {
  useWritingSession,
  type WritingSessionTarget,
} from "./_components/useWritingSession";

const PostBodyEditor = dynamic(() => import("./_components/PostBodyEditor"), {
  ssr: false,
  loading: () => (
    <div
      className="min-h-80 rounded-md border border-input bg-background px-3 py-2"
      aria-hidden="true"
    />
  ),
});

const emptyDocument: BlockNoteDocument = {
  format: "blocknote@1",
  blocks: [],
};

type PostFormInput = z.input<typeof draftPostSchema>;
type PostFormOutput = z.output<typeof draftPostSchema>;
type SubmitMode = "draft" | "publish";

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
  const [isPending, startTransition] = useTransition();
  const [draftId, setDraftId] = useState<Id<"posts"> | undefined>();
  const [coverStorageId, setCoverStorageId] = useState<Id<"_storage">>();
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
  const saveDraft = useMutation(api.posts.saveDraft);
  const publishPost = useMutation(api.posts.publishPost);
  const updatePublishedPost = useMutation(api.posts.updatePublishedPost);
  const reserveAttempt = useMutation(api.writeAttempts.reserveAttempt);
  const inlineSessions = useRef(
    new Map<Id<"pendingUploads">, Id<"_storage">>(),
  );

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
    if (!requestedTarget) return;

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
      form.reset({
        title: "",
        content: emptyDocument,
        tags: [],
        image: undefined,
      });
      dispatchSession({
        type: "establishBaseline",
        proposal: {
          title: "",
          body: JSON.stringify(emptyDocument),
          tags: [],
        },
      });
      setDraftId(undefined);
      setCoverStorageId(undefined);
      setInitialContent(emptyDocument);
      setResolvedImageUrls({});
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

    form.reset({
      title: target.title,
      content: parsed.document,
      tags: target.tags as PostFormInput["tags"],
      image: undefined,
    });
    dispatchSession({
      type: "establishBaseline",
      proposal: {
        title: target.title,
        body: JSON.stringify(parsed.document),
        tags: target.tags,
        ...(target.imageStorageId && { imageStorageId: target.imageStorageId }),
      },
      expectedUpdatedAt: target.updatedAt,
    });
    if (editorMode.mode === "draft") setDraftId(target._id);
    setCoverStorageId(target.imageStorageId ?? undefined);
    setInitialContent(parsed.document);
    setResolvedImageUrls(
      Object.fromEntries(
        target.inlineImages.map(({ storageId, url }) => [storageId, url]),
      ),
    );
    hydratedSessionKey.current = sessionKey;
  }, [
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
    const coverSelected = Boolean(watchedValues.image);
    if (sessionState.media.coverSelected === coverSelected) return;
    dispatchSession({
      type: "setMedia",
      media: { ...sessionState.media, coverSelected },
    });
  }, [dispatchSession, sessionState.media, watchedValues.image]);

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
  const requestedSessionKey = requestedTarget
    ? `${requestedTarget.editorMode}:${requestedTarget.id ?? "new"}`
    : undefined;
  const targetTransition =
    sessionState.dirty &&
    requestedTarget &&
    requestedSessionKey !== activeSessionKey
      ? requestedTarget
      : undefined;
  const targetError =
    acceptedTargetError && acceptedTargetError.targetKey === requestedSessionKey
      ? acceptedTargetError.message
      : undefined;
  const transitionNotice =
    targetError || sessionState.pendingTarget || targetTransition ? (
      <TargetTransitionNotice
        error={targetError}
        loading={Boolean(sessionState.pendingTarget)}
        onConfirm={
          targetTransition
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
    startTransition(async () => {
      const submitSessions = new Map(inlineSessions.current);
      let draftSaved = false;
      let unconsumedUploads: {
        sessionId: Id<"pendingUploads">;
        storageId: Id<"_storage">;
      }[] = [];
      let mutationSucceeded = false;
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
          throw new Error(result.message);
        }
        const persistedProposal: CanonicalProposal = {
          title: values.title,
          body: JSON.stringify(values.content),
          tags: [...values.tags],
          ...(savedCoverStorageId && { imageStorageId: savedCoverStorageId }),
        };
        if (submittedImage && form.getValues("image") === submittedImage) {
          form.resetField("image", { defaultValue: undefined });
        }
        dispatchSession({
          type: "finishOperation",
          outcome: {
            kind: "succeeded",
            proposal: persistedProposal,
            expectedUpdatedAt: result.updatedAt,
          },
        });
        draftSaved = mode === "draft";
        if (result.status === "draft") {
          setDraftId(result.postId);
          setCoverStorageId(savedCoverStorageId);
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
          editorMode.mode === "published-edit"
            ? "Edit Published Post"
            : "New Post"
        }
        description="Give your ideas a home. Draft a deep dive, share a quick update, or capture a fleeting thought to share with your community."
        title={
          <Controller
            name="title"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel>Blog Title</FieldLabel>
                <FieldDescription>
                  This becomes the title of your published post.
                </FieldDescription>
                <Input
                  aria-invalid={fieldState.invalid}
                  placeholder="Give your thought a name"
                  {...field}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        }
        body={
          <Controller
            name="content"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel id="blog-content-label">Blog Content</FieldLabel>
                <PostBodyEditor
                  key={`${editorMode.mode}:${editorMode.id ?? "new"}`}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  invalid={fieldState.invalid}
                  isDirty={sessionState.dirty}
                  labelledBy="blog-content-label"
                  initialContent={initialContent}
                  resolvedImageUrls={resolvedImageUrls}
                  onUploadSessionCreated={(sessionId, storageId) =>
                    inlineSessions.current.set(sessionId, storageId)
                  }
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        }
        details={
          <FieldGroup className="gap-y-4">
            <Controller
              name="image"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor="image">Image (optional)</FieldLabel>
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    aria-invalid={fieldState.invalid}
                    placeholder="Choose an image to upload"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      field.onChange(file);
                    }}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
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
          <>
            {capabilities.canSaveDraft && (
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  void form.handleSubmit((values) =>
                    onSubmit(values, "draft"),
                  )();
                }}
              >
                Save Draft
              </Button>
            )}
            {capabilities.canUpdate && (
              <Button
                type="button"
                disabled={isPending}
                onClick={() => {
                  void form.handleSubmit((values) =>
                    onSubmit(values, "publish"),
                  )();
                }}
              >
                {isPending ? "Updating..." : "Update Published Post"}
              </Button>
            )}
            {capabilities.canPublish && (
              <Button
                type="button"
                disabled={isPending}
                onClick={() => {
                  void form.handleSubmit((values) =>
                    onSubmit(values, "publish"),
                  )();
                }}
              >
                {isPending ? (
                  <>
                    <Loader2 className="animate-spin size-4" />
                    <span className="ml-2">Saving...</span>
                  </>
                ) : (
                  <span>Publish</span>
                )}
              </Button>
            )}
          </>
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
