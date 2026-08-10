import { fetchQuery } from "convex/nextjs";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { PostCard } from "@/components/web/PostCard";
import { EmptyState } from "@/components/web/EmptyState";
import { SearchX } from "lucide-react";
import Link from "next/link";
import type { Id } from "@/convex/_generated/dataModel";

type BlogPost = {
  _id: Id<"posts">;
  title: string;
  body: string;
  imageUrl: string | null;
  commentCount: number;
  likeCount?: number;
  isLiked?: boolean;
  createdAt: number;
  authorId: string;
  authorName: string | null;
  authorAvatarUrl: string | null;
  tags?: string[];
};
type GetPostsResult = FunctionReturnType<typeof api.posts.getPosts>;

interface BlogPostListProps {
  tag?: string;
}

/**
 * Displays blog posts, optionally filtered by tag.
 *
 * @param tag - The optional tag used to filter posts.
 * @returns A responsive post grid or an empty state when the tag has no matching posts.
 */
export async function BlogPostList({ tag }: BlogPostListProps) {
  const posts: BlogPost[] = [];
  let cursor: string | null = null;
  let isDone = false;

  while (!isDone && posts.length < 50) {
    const result: GetPostsResult = await fetchQuery(api.posts.getPosts, {
      tag,
      paginationOpts: { numItems: 50, cursor },
    });
    posts.push(...result.page);
    isDone = result.isDone;
    cursor = result.continueCursor;
    if (!tag) break;
  }

  if (posts.length === 0 && tag) {
    return (
      <EmptyState
        icon={SearchX}
        title="No posts found"
        description={`There are no posts tagged “${tag}”.`}
        action={
          <Link
            href="/blog"
            className="text-sm font-medium text-primary hover:underline"
          >
            Clear filter
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid px-6 py-6 items-stretch border-l border-r gap-6 md:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => (
        <PostCard
          key={post._id}
          postId={post._id}
          title={post.title}
          body={post.body}
          imageUrl={post.imageUrl}
          commentCount={post.commentCount}
          likeCount={post.likeCount ?? 0}
          isLiked={post.isLiked ?? false}
          createdAt={post.createdAt}
          authorId={post.authorId}
          authorName={post.authorName}
          authorAvatarUrl={post.authorAvatarUrl}
          tags={post.tags}
        />
      ))}
    </div>
  );
}
