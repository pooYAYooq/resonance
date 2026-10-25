import type { Metadata } from "next";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";
import { CommentDestination } from "@/components/web/CommentDestination";

export const metadata: Metadata = {
  title: "Conversation",
  robots: { index: false },
};

/** No loading boundary: retain the source until the complete destination is ready. */
export default async function CommentDestinationPage({
  params,
}: {
  params: Promise<{ postId: string; commentId: string }>;
}) {
  const { postId, commentId } = await params;
  const initialData = await fetchAuthQuery(api.comments.getCommentDestination, {
    postId,
    commentId,
  });
  return (
    <CommentDestination
      key={`${postId}:${commentId}`}
      postId={postId}
      commentId={commentId}
      initialData={initialData}
    />
  );
}
