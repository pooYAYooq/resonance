"use client";

import { postSchema } from "@/schemas/blog";
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PostTagSelector } from "@/components/web/PostTagSelector";
import type { BlockNoteDocument } from "@/lib/post-content";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useConvexAuth } from "convex/react";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useTransition, useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

const PostBodyEditor = dynamic(
  () => import("./_components/PostBodyEditor"),
  {
    ssr: false,
    loading: () => (
      <div
        className="min-h-80 rounded-md border border-input bg-background px-3 py-2"
        aria-hidden="true"
      />
    ),
  },
);

const emptyDocument: BlockNoteDocument = {
  format: "blocknote@1",
  blocks: [],
};

type PostFormInput = z.input<typeof postSchema>;
type PostFormOutput = z.output<typeof postSchema>;

/**
 * Renders the authenticated blog post creation page.
 *
 * Redirects unauthenticated users to the login page and displays a loading state while authentication is unresolved.
 *
 * @returns The blog post creation interface
 */
export default function CreateRoute() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const generateImageUploadUrl = useMutation(api.posts.generateImageUploadUrl);
  const createPost = useMutation(api.posts.createPost);

  const form = useForm<PostFormInput, undefined, PostFormOutput>({
    resolver: zodResolver(postSchema),
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

  if (isLoading || !isAuthenticated) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="animate-spin size-8 text-muted-foreground" />
      </div>
    );
  }

  function onSubmit(values: PostFormOutput) {
    startTransition(async () => {
      try {
        // Track the uploaded image's storage ID. It stays undefined when no image is provided,
        // allowing posts to be created without an attached image.
        let storageId: Id<"_storage"> | undefined;

        // Only attempt to upload when the user selected an image. The field is optional in the form schema.
        if (values.image) {
          // Request a pre-signed upload URL from Convex so we can POST the file directly to storage.
          const imageUrl = await generateImageUploadUrl({});
          const uploadResult = await fetch(imageUrl, {
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
        }

        await createPost({
          title: values.title,
          body: JSON.stringify(values.content),
          tags: values.tags,
          ...(storageId && { imageStorageId: storageId }),
        });

        toast.success("Post created successfully!");
        router.push("/blog");
      } catch (error) {
        console.error("Create post failed", error);
        toast.error("Failed to create post");
      }
    });
  }

  return (
    <div className="py-12 flex flex-col items-center gap-6">
      <div className="text-center py-12 max-w-xl">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl leading-tight">
          New Post
        </h1>

        <p className="text-xl leading-relaxed">
          Give your ideas a home. Draft a deep dive, share a quick update, or
          capture a fleeting thought to share with your community.
        </p>
      </div>
      <Card className="w-full max-w-xl  mx-auto shadow-md">
        <CardHeader>
          <CardTitle>Create Blog Article</CardTitle>
          <CardDescription>Create a new blog article</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <FieldGroup className="gap-y-4">
              <Controller
                name="title"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel>Blog Title</FieldLabel>
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
                    <FieldLabel id="blog-content-label">Blog Content</FieldLabel>
                    <PostBodyEditor
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      invalid={fieldState.invalid}
                      labelledBy="blog-content-label"
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
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="animate-spin size-4" />
                    <span className="ml-2">Creating...</span>
                  </>
                ) : (
                  <span>Create Post</span>
                )}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
