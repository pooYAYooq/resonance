"use client";
import { signUpSchema } from "@/schemas/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

/**
 * The sign up page component.
 *
 * This component renders a sign up form which accepts a full name, an email address, and a password.
 * The form is validated using the `signUpSchema` from the `schemas/auth` module.
 * When the form is submitted, the component calls the `signUp.email` method from the `authClient` to create a new user account.
 *
 * The component also renders a `Card` component from the `components/ui/card` module, which contains the form fields and the submit button.
 */
export default function SignUpPage() {
  const form = useForm({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  /**
   * Submits the sign up form and creates a new user account.
   *
   * @param {z.infer<typeof signUpSchema>} data - The form data which is validated against the `signUpSchema`.
   */
  function onSubmit(data: z.infer<typeof signUpSchema>) {
    startTransition(async () => {
      await authClient.signUp.email({
        email: data.email,
        name: data.name,
        password: data.password,
        fetchOptions: {
          /**
           * Called when the sign up request is successful.
           * Shows a success toast message with the message "Account created successfully!" and redirects the user to the home page.
           */
          onSuccess: () => {
            // Show a success toast message when the sign up is successful
            toast.success("Account created successfully!");
            router.push("/");
          },
          /**
           * Called when the sign up request is rejected.
           * Shows an error toast with the error message from the Better Auth error.
           */
          onError: (error) => {
            toast.error(error.error.message);
          },
        },
      });
    });
  }

  return (
    <>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight">
          Create your account
        </h1>
        <p className="mt-3 text-muted-foreground text-base">
          Join the community of curious minds.
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <FieldGroup className="gap-5">
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field className="gap-y-3">
                  <FieldLabel>Full Name</FieldLabel>
                  <Input
                    aria-invalid={fieldState.invalid}
                    placeholder="John Doe"
                    {...field}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field className="gap-y-3">
                  <FieldLabel>Email</FieldLabel>
                  <Input
                    aria-invalid={fieldState.invalid}
                    placeholder="john@example.com"
                    {...field}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              name="password"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field className="gap-y-3">
                  <FieldLabel>Password</FieldLabel>
                  <Input
                    aria-invalid={fieldState.invalid}
                    type="password"
                    placeholder="••••••••"
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
                <span>Sign Up</span>
              )}
            </Button>
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or sign up with
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={() =>
                  authClient.signIn.social({
                    provider: "google",
                    callbackURL: "/",
                  })
                }
              >
                <svg className="size-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Google
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={() =>
                  authClient.signIn.social({
                    provider: "github",
                    callbackURL: "/",
                  })
                }
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                GitHub
              </Button>
            </div>
          </FieldGroup>
        </form>
        </CardContent>
      </Card>
      <p className="mt-8 text-sm text-muted-foreground text-center">
        Already have an account?{" "}
        <Link href="/auth/login" className="underline underline-offset-4 hover:text-primary">
          Log in
        </Link>
      </p>
    </>
  );
}
