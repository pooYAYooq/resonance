/**
 * Client component that renders a paginated comment thread and submission form
 * for a blog post. Uses Convex usePaginatedQuery for "Load More" support.
 * Handles form validation via Zod, Convex mutations, and UI transition states.
 */

"use client";
import { Loader2, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { commentBodySchema } from "@/schemas/comment";
import { Field, FieldError, FieldLabel } from "../ui/field";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { useParams, useRouter } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import {
  useConvexAuth,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import { api } from "@/convex/_generated/api";
import z from "zod";
import { toast } from "sonner";
import { useTransition } from "react";
import { CommentCard } from "./CommentCard";
import { buildAuthHref, getCurrentReturnTo } from "@/lib/auth-return";

interface CommentSectionProps {
  initialTotalCount: number;
}

/**
 * Renders the comment section for a single post, including the paginated list
 * of existing comments and a form to submit new ones.
 *
 * @param props - `CommentSectionProps`: initial total count for SSR.
 * @returns JSX.Element: a card containing the comment list and reply form.
 */
export function CommentSection({ initialTotalCount }: CommentSectionProps) {
  // Tracks whether a comment mutation is in-flight so the submit button can
  // show a loading spinner and disable itself during the round-trip.
  const [isPending, startTransition] = useTransition();

  const params = useParams<{ postId: Id<"posts"> }>();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const router = useRouter();
  const postId = params?.postId;
  const queryArgs = isAuthLoading || !postId ? "skip" : { postId };

  // Convex paginated query for comments. Ordered newest-first.
  const {
    results: comments,
    status,
    isLoading,
    loadMore,
  } = usePaginatedQuery(api.comments.getCommentsByPostId, queryArgs, {
    initialNumItems: 50,
  });

  // Fetch the post client-side so commentCount updates reactively when
  // new comments are added via the mutation above.
  const post = useQuery(api.posts.getPostById, queryArgs);
  const totalCount = post?.commentCount ?? initialTotalCount;

  // React Hook Form with Zod validation. Only the body field is user-provided;
  // postId comes from the URL route and is injected in the submit handler.
  const form = useForm({
    resolver: zodResolver(commentBodySchema),
    defaultValues: {
      body: "",
    },
  });

  // Submits the comment via a Convex mutation inside a transition.
  // postId is read from useParams() and validated before the mutation.
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

  const canLoadMore = status === "CanLoadMore";
  const isLoadingMore = status === "LoadingMore";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 border-b border-border">
        <MessageSquare className="size-5" />
        <h2 className="text-xl font-bold">
          {comments.length < totalCount
            ? `Showing ${comments.length} of ${totalCount} comments`
            : `${totalCount} ${totalCount === 1 ? "comment" : "comments"}`}
        </h2>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 mb-6">
          {isLoading && comments.length === 0 ? (
            <p className="text-muted-foreground text-sm">Loading comments...</p>
          ) : comments.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No comments yet. Be the first to reply.
            </p>
          ) : (
            comments.map((comment) => (
              <CommentCard
                key={comment._id}
                commentId={comment._id}
                authorName={comment.authorName}
                body={comment.body}
                createdAt={comment.createdAt}
                authorId={comment.authorId}
                authorAvatarUrl={comment.authorAvatarUrl}
                isLiked={comment.isLiked}
                likeCount={comment.likeCount}
              />
            ))
          )}
        </div>

        {canLoadMore && (
          <div className="mb-6">
            <Button
              variant="outline"
              onClick={() => loadMore(50)}
              disabled={isLoadingMore}
              className="w-full"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="animate-spin size-4" />
                  <span className="ml-2">Loading more...</span>
                </>
              ) : (
                <span>Load more comments</span>
              )}
            </Button>
          </div>
        )}

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
                router.push(
                  buildAuthHref("/auth/sign-up", getCurrentReturnTo()),
                )
              }
            >
              Sign up
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
