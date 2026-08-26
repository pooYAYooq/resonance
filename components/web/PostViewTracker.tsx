"use client";

import { useEffect } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface PostViewTrackerProps {
  postId: Id<"posts">;
}

export function PostViewTracker({ postId }: PostViewTrackerProps) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const recordView = useMutation(api.analytics.recordView);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      recordView({ postId }).catch(() => {});
    }
  }, [isAuthenticated, isLoading, postId, recordView]);

  return null;
}
