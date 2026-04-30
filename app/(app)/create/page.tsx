"use client";

import { postSchema } from "@/app/schemas/blog";
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
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

export default function CreateRoute() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const generateImageUploadUrl = useMutation(api.posts.generateImageUploadUrl);
  const createPost = useMutation(api.posts.createPost);

  const form = useForm({
    resolver: zodResolver(postSchema),
    defaultValues: {
      title: "",
      content: "",
      image: undefined,
    },
  });

  function onSubmit(values: z.infer<typeof postSchema>) {
    startTransition(async () => {
      try {
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

        const { storageId } = (await uploadResult.json()) as {
          storageId: Id<"_storage">;
        };

        await createPost({
          title: values.title,
          body: values.content,
          imageStorageId: storageId,
        });

        toast.success("Post created successfully!");
        router.push("/blog");
      } catch (error) {
        console.error("Create post failed:", error);
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
                  <Field>
                    <FieldLabel>Blog Content</FieldLabel>
                    <Textarea
                      aria-invalid={fieldState.invalid}
                      {...field}
                      placeholder="Let the world know what you are thinking..."
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
                    <FieldLabel>Image</FieldLabel>
                    <Input
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
