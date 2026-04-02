"use client";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import Image from "next/image";
import Link from "next/link";

export default function BlogPost() {
  const data = useQuery(api.posts.getPosts);

  return (
    <div className="container mx-auto">
      <div className="text-center py-12">
        <h1 className="text-4xlxl font-extrabold tracking-tight sm:text-5xl">
          Our Blog
        </h1>
        <p className="pt-2 max-w-2xl text-muted-foreground mx-auto text-xl">
          Insight, thoughts, and stories from our universal team.
        </p>
      </div>
      <div className="grid px-6 py-6 border-l border-r gap-6 md:grid-cols-2 lg:grid-cols-3">
        {data?.map((post) => (
          <Card key={post._id} className="pt-0 gap-4">
            <div className=" relative h-48 w-full overflow-hidden mb-8">
              <Image
                src="https://w.wallhaven.cc/full/k7/wallhaven-k7k9j7.jpg"
                alt="Blog Post Image"
                fill
                className="object-cover"
              />
            </div>

            <CardContent className="mb-0">
              <Link href={`/blog/${post._id}`}>
                <h1 className="text-xl mb-4 font-semibold hover:text-primary">
                  {post.title}
                </h1>
              </Link>
              <p className="text-muted-foreground line-clamp-3">{post.body}</p>
            </CardContent>
            <CardFooter>
              <Link
                className={cn(
                  buttonVariants({
                    variant: "link",
                    className: "font-light",
                  }),
                  "px-0 py-0 text-muted-foreground hover:text-primary hover:no-underline",
                )}
                href={`/blog/${post._id}`}
              >
                Read More...
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
