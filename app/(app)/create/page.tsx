"use client";
import { postSchema } from "@/app/schemas/blog";
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
import { api } from "@/convex/_generated/api";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { Controller, useForm } from "react-hook-form";
import z from "zod";

/**
 * The create route component.
 *
 * This component renders a form which allows users to create a new blog article.
 * The form is validated against the `postSchema` using the `zodResolver` from the
 * `@hookform/resolvers/zod` module.
 * When the form is submitted, the component calls the `api.posts.createPost` mutation
 * from the `convex/react` module to create a new blog article.
 */
export default function CreateRoute() {
  const mutation = useMutation(api.posts.createPost);
  const form = useForm({
    resolver: zodResolver(postSchema),
    defaultValues: {
      title: "",
      content: "",
    },
  });

  /**
   * Submits the create post form and creates a new blog article.
   *
   * @param {z.infer<typeof postSchema>} data - The form data which is validated against the `postSchema`.
   */
  const onSubmit = (data: z.infer<typeof postSchema>) => {
    mutation({
      body: data.content,
      title: data.title,
    });
  };

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
                    <Input placeholder="Give your thought a name" {...field} />
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
                      {...field}
                      placeholder="Let the world know what you are thinking..."
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
              <Button type="submit">Create Post</Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
