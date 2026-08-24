"use client";

import { draftPostSchema, publishPostSchema } from "@/schemas/blog";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useConvexAuth, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useTransition, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";
import { getEditorCapabilities, resolveEditorMode } from "./editorMode";

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
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [isPending, startTransition] = useTransition();
  const [draftId, setDraftId] = useState<Id<"posts"> | undefined>();
  const [coverStorageId, setCoverStorageId] = useState<Id<"_storage">>();
  const [initialContent, setInitialContent] = useState<BlockNoteDocument>();
  const [resolvedImageUrls, setResolvedImageUrls] = useState<
    Record<string, string | null>
  >({});
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedDraftId = searchParams.get("draftId");
  const requestedEditPostId = searchParams.get("editPostId");
  const editorMode = resolveEditorMode({
    draftId: requestedDraftId ?? undefined,
    editPostId: requestedEditPostId ?? undefined,
  });
  const capabilities = getEditorCapabilities(editorMode.mode);
  const hydratedDraft = useQuery(
    api.posts.getDraftById,
    !isLoading &&
      isAuthenticated &&
      editorMode.mode === "draft" &&
      requestedDraftId
      ? { draftId: requestedDraftId as Id<"posts"> }
      : "skip",
  );
  const hydratedPublishedPost = useQuery(
    api.posts.getPublishedPostForEditing,
    !isLoading &&
      isAuthenticated &&
      editorMode.mode === "published-edit" &&
      requestedEditPostId
      ? { postId: requestedEditPostId as Id<"posts"> }
      : "skip",
  );
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
  const inlineSessions = useRef(
    new Map<Id<"pendingUploads">, Id<"_storage">>(),
  );
  const submitMode = useRef<SubmitMode>("publish");

  const form = useForm<PostFormInput, undefined, PostFormOutput>({
    resolver: zodResolver(draftPostSchema),
    defaultValues: {
      title: "",
      content: emptyDocument,
      tags: [],
      image: undefined,
    },
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (editorMode.mode === "invalid") {
      toast.error("Invalid editor request.");
      router.replace("/dashboard");
    }
  }, [editorMode.mode, router]);

  useEffect(() => {
    const target =
      editorMode.mode === "draft" ? hydratedDraft : hydratedPublishedPost;
    if (
      (editorMode.mode !== "draft" && editorMode.mode !== "published-edit") ||
      target === undefined
    ) {
      return;
    }
    if (target === null) {
      toast.error(
        editorMode.mode === "draft"
          ? "That draft is unavailable."
          : "That published post is unavailable.",
      );
      router.replace(
        editorMode.mode === "draft"
          ? "/dashboard/drafts"
          : "/dashboard/published",
      );
      return;
    }

    const parsed = parsePostBody(target.body);
    if (parsed.kind !== "structured") {
      toast.error(
        editorMode.mode === "draft"
          ? "That draft is unavailable."
          : "That published post is unavailable.",
      );
      router.replace(
        editorMode.mode === "draft"
          ? "/dashboard/drafts"
          : "/dashboard/published",
      );
      return;
    }

    queueMicrotask(() => {
      form.reset({
        title: target.title,
        content: parsed.document,
        tags: target.tags as PostFormInput["tags"],
        image: undefined,
      });
      if (editorMode.mode === "draft") setDraftId(target._id);
      setCoverStorageId(target.imageStorageId ?? undefined);
      setInitialContent(parsed.document);
      setResolvedImageUrls(
        Object.fromEntries(
          target.inlineImages.map(({ storageId, url }) => [storageId, url]),
        ),
      );
    });
  }, [editorMode.mode, form, hydratedDraft, hydratedPublishedPost, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="animate-spin size-8 text-muted-foreground" />
      </div>
    );
  }

  if (editorMode.mode === "invalid") {
    return null;
  }

  if (
    (editorMode.mode === "draft" &&
      (hydratedDraft === undefined || hydratedDraft === null)) ||
    (editorMode.mode === "published-edit" &&
      (hydratedPublishedPost === undefined || hydratedPublishedPost === null))
  ) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
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
          await finalizePendingUpload({
            sessionId: session.sessionId,
            storageId,
          });
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

        if (editorMode.mode === "published-edit") {
          await updatePublishedPost({
            postId: editorMode.id as Id<"posts">,
            title: values.title,
            body: JSON.stringify(values.content),
            tags: values.tags,
            ...(savedCoverStorageId && { imageStorageId: savedCoverStorageId }),
          });
        } else {
          const saved = await saveDraft({
            ...(draftId && { draftId }),
            title: values.title,
            body: JSON.stringify(values.content),
            tags: values.tags,
            ...(savedCoverStorageId && { imageStorageId: savedCoverStorageId }),
          });
          draftSaved = true;
          setDraftId(saved.draftId);
          setCoverStorageId(savedCoverStorageId);

          if (mode === "publish") {
            await publishPost({ draftId: saved.draftId });
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
    <div className="py-12 flex flex-col items-center gap-6">
      <div className="text-center py-12 max-w-xl">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl leading-tight">
          {editorMode.mode === "published-edit"
            ? "Edit Published Post"
            : "New Post"}
        </h1>

        <p className="text-xl leading-relaxed">
          Give your ideas a home. Draft a deep dive, share a quick update, or
          capture a fleeting thought to share with your community.
        </p>
      </div>
      <Card className="w-full max-w-xl  mx-auto shadow-md">
        <CardHeader>
          <CardTitle>
            {editorMode.mode === "published-edit"
              ? "Update Blog Article"
              : "Create Blog Article"}
          </CardTitle>
          <CardDescription>
            {editorMode.mode === "published-edit"
              ? "Update your published blog article"
              : "Create a new blog article"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit((values) =>
                onSubmit(values, submitMode.current),
              )(event);
            }}
          >
            <FieldGroup className="gap-y-4">
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
              <Controller
                name="content"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel id="blog-content-label">
                      Blog Content
                    </FieldLabel>
                    <PostBodyEditor
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      invalid={fieldState.invalid}
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
              <div className="flex gap-2">
                {capabilities.canSaveDraft && (
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => {
                      submitMode.current = "draft";
                    }}
                  >
                    Save Draft
                  </Button>
                )}
                {capabilities.canUpdate && (
                  <Button type="submit" disabled={isPending}>
                    {isPending ? "Updating..." : "Update Published Post"}
                  </Button>
                )}
                {capabilities.canPublish && (
                  <Button
                    type="submit"
                    disabled={isPending}
                    onClick={() => {
                      submitMode.current = "publish";
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
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
