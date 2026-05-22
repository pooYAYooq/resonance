/**
 * Client component that renders a comment thread and submission form for a blog post.
 * Handles form validation via Zod, Convex mutations, and UI transition states.
 */

"use client";
import { Loader2, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { commentSchema } from "@/app/schemas/comment";
import { Field, FieldError, FieldLabel } from "../ui/field";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { useParams } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import { useMutation, usePreloadedQuery, Preloaded } from "convex/react";
import { api } from "@/convex/_generated/api";
import z from "zod";
import { toast } from "sonner";
import { useTransition } from "react";
import { CommentCard } from "./CommentCard";

interface CommentSectionProps {
  preloadedComments: Preloaded<typeof api.comments.getCommentsByPostId>;
}

/**
 * Renders the comment section for a single post, including the list of existing
 * comments and a form to submit new ones.
 *
 * @param props - `CommentSectionProps`: preloaded Convex comment query result.
 * @returns JSX.Element: a card containing the comment list and reply form.
 */
export function CommentSection({ preloadedComments }: CommentSectionProps) {
  // Tracks whether a comment mutation is in-flight so the submit button can
  // show a loading spinner and disable itself during the round-trip.
  const [isPending, startTransition] = useTransition();

  const params = useParams<{ postId: Id<"posts"> }>();

  // Convex mutation to persist a new comment. Wrapped in a transition so the
  // UI stays responsive while the mutation round-trips.
  const createComment = useMutation(api.comments.createComment);

  // Hydrate the server-preloaded comment list on the client.
  const comments = usePreloadedQuery(preloadedComments);

  // React Hook Form with Zod validation. postId is injected from the route
  // so the submit handler only needs the body field from the user.
  const form = useForm({
    resolver: zodResolver(commentSchema),
    defaultValues: {
      body: "",
      postId: params?.postId,
    },
  });

  // Submits the comment via a Convex mutation inside a transition.
  // Errors surface as Sonner toasts so the user can retry.
  async function onSubmit(values: z.infer<typeof commentSchema>) {
    startTransition(async () => {
      try {
        await createComment(values);
        toast.success("Comment submitted successfully");
        form.reset();
      } catch {
        toast.error("Failed to submit comment");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 border-b border-border">
        <MessageSquare className="size-5" />
        <h2 className="text-xl font-bold">
          {comments.length} {comments.length === 1 ? "comment" : "comments"}
        </h2>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 mb-6">
          {comments.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No comments yet. Be the first to reply.
            </p>
          ) : (
            comments.map((comment) => (
              <CommentCard
                key={comment._id}
                authorName={comment.authorName}
                body={comment.body}
                createdAt={comment._creationTime}
              />
            ))
          )}
        </div>
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
      </CardContent>
    </Card>
  );
}
