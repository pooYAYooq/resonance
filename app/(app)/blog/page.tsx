"use client";

import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";

export default function BlogPost() {
  const data = useQuery(api.posts.getPosts);
  return (
    <div className="py-12">
      <div className="text-center pb-12">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Our Blog
        </h1>
        <p className="pt-4 max-w-2xl text-muted-foreground mx-auto text-xl">
          Insight, thoughts, and stories from our universal team.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {data?.map((post) => (
          <div key={post._id} className="p-4 border rounded-lg">
            <h2 className="text-2xl font-bold">{post.title}</h2>
            <p className="mt-2 text-gray-600">{post.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
