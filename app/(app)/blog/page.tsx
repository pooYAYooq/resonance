"use client";

import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import Image from "next/image";
import Link from "next/link";

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
          <Card key={post._id}>
            <div className=" relative h-48 w-full overflow-hidden">
              <Image
                src="https://w.wallhaven.cc/full/k7/wallhaven-k7k9j7.jpg"
                alt="Blog Post Image"
                fill
                className="object-cover "
              />
            </div>

            <CardContent>
              <Link href={`/blog/${post._id}`} className="hover:underline">
                <h1 className="text-2xl font-bold hover:text-primary">
                  {post.title}
                </h1>
              </Link>
              <p className="mt-2 text-gray-600">{post.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
