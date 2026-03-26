"use client";
import { loginSchema } from "@/app/schemas/auth";
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
import { authClient } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

/**
 * The login page component.
 *
 * This component renders a login form which accepts an email address and a password.
 * The form is validated using the `loginSchema` from the `schemas/auth` module.
 * When the form is submitted, the component calls the `signIn.email` method from the `authClient` to log the user in.
 *
 * The component also renders a `Card` component from the `components/ui/card` module, which contains the form fields and the submit button.
 */
export default function LoginPage() {
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  /**
   * Submits the login form and logs the user in using the provided email and password.
   *
   * @param {z.infer<typeof loginSchema>} data - The form data which is validated against the `loginSchema`.
   */
  function onSubmit(data: z.infer<typeof loginSchema>) {
    startTransition(async () => {
      await authClient.signIn.email({
        email: data.email,
        password: data.password,
        fetchOptions: {
          /**
           * Called when the login request is successful.
           * Shows a success toast with the message "Logged in successfully!" and redirects the user to the home page.
           */
          onSuccess: () => {
            toast.success("Logged in successfully!");
            router.push("/");
          },

          /**
           * Called when the login request is rejected.
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
    <Card>
      <CardHeader>
        <CardTitle>Login</CardTitle>
        <CardDescription>Login to your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup className="gap-5">
            <Controller
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field className="gap-y-3">
                  <FieldLabel>Email</FieldLabel>
                  <Input placeholder="Enter your email" {...field} />
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
                    type="password"
                    placeholder="Enter your password"
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
                <span>Login</span>
              )}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
