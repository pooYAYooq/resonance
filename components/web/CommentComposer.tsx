"use client";
import { Loader2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation } from "convex/react";
import { toast } from "sonner";
import z from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { commentBodySchema } from "@/schemas/comment";
import { buildAuthHref, getCurrentReturnTo } from "@/lib/auth-return";
import { Field, FieldError, FieldLabel } from "../ui/field";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";

const subscribe = () => () => {};
const browserSnapshot = () => true;
const serverSnapshot = () => false;

/** Shared post-level reply form for the reader and focused comment view. */
export function CommentComposer({
  postId,
}: {
  postId: Id<"posts"> | undefined;
}) {
  const [isPending, startTransition] = useTransition();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const hydrated = useSyncExternalStore(
    subscribe,
    browserSnapshot,
    serverSnapshot,
  );
  const router = useRouter();
  // React Hook Form with Zod validation. Only the body field is user-provided;
  // The owning view supplies postId; it is injected in the submit handler.
  const form = useForm({
    resolver: zodResolver(commentBodySchema),
    defaultValues: {
      body: "",
    },
  });

  // Submits the comment via a Convex mutation inside a transition.
  // Validate the owning post before invoking the mutation.
  // Errors surface as Sonner toasts so the user can retry.
  async function onSubmit(values: z.infer<typeof commentBodySchema>) {
    if (!postId) {
      toast.error("Missing post ID — cannot submit comment.");
      return;
    }

    startTransition(async () => {
      try {
        await createComment({ ...values, postId });
        toast.success("Comment submitted successfully");
        form.reset();
      } catch {
        toast.error("Failed to submit comment");
      }
    });
  }

  const createComment = useMutation(api.comments.createComment);

  // Match server markup even when auth resolves before the first client render.
  if (!hydrated || isLoading)
    return <div aria-busy="true" className="min-h-44" />;

  return (
    <>
      {isAuthenticated ? (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Controller
            name="body"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field className="gap-y-3">
                <FieldLabel>Reply</FieldLabel>
                <Textarea
                  aria-invalid={fieldState.invalid}
                  placeholder="Add a comment..."
                  {...field}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Button disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="animate-spin size-4" />
                <span className="ml-2">Loading...</span>
              </>
            ) : (
              <span>Comment</span>
            )}
          </Button>
        </form>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Sign in to join the conversation.</span>
          <Button
            variant="link"
            className="h-auto p-0"
            onClick={() =>
              router.push(buildAuthHref("/auth/login", getCurrentReturnTo()))
            }
          >
            Sign in
          </Button>
          <Button
            variant="link"
            className="h-auto p-0"
            onClick={() =>
              router.push(buildAuthHref("/auth/sign-up", getCurrentReturnTo()))
            }
          >
            Sign up
          </Button>
        </div>
      )}
    </>
  );
}
