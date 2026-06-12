/**
 * Settings page at `/settings`.
 *
 * Client Component ("use client"), auth-gated via `useConvexAuth`. When
 * the user is unauthenticated, redirects to `/auth/login`. The form
 * pre-fills with the current user's data via `getCurrentUser` and
 * submits `updateProfile` to patch the display name and bio. Email
 * is read-only because it is owned by Better Auth.
 *
 * The avatar is read-only in 1.1 — OAuth/DiceBear only. Custom upload
 * is deferred to a later phase.
 *
 * Form state is keyed on the current user's Convex document ID so the
 * inputs re-initialize from server data when the user record changes,
 * without needing a setState-in-effect pattern.
 */

"use client";

import { useEffect, useState, useTransition } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/web/UserAvatar";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const MAX_BIO_LENGTH = 160;

export default function SettingsRoute() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const currentUser = useQuery(api.users.getCurrentUser);
  const updateProfile = useMutation(api.users.updateProfile);
  const [isPending, startTransition] = useTransition();

  // Key form state off the user's Convex doc ID so it re-initializes
  // from server data whenever the user record changes (e.g., after a
  // successful save). This avoids the setState-in-effect anti-pattern.
  const [formKey, setFormKey] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (currentUser && formKey !== currentUser._id) {
    setFormKey(currentUser._id);
    setDisplayName(currentUser.displayName ?? "");
    setBio(currentUser.bio ?? "");
  }

  if (isLoading || !isAuthenticated || !currentUser) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="animate-spin size-8 text-muted-foreground" />
      </div>
    );
  }

  const displayNameTrimmed = displayName.trim();
  const displayNameInvalid = displayNameTrimmed.length === 0;
  const bioInvalid = bio.length > MAX_BIO_LENGTH;
  const userId = currentUser.userId;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (displayNameInvalid || bioInvalid) return;

    startTransition(async () => {
      try {
        await updateProfile({
          displayName: displayNameTrimmed,
          bio,
        });
        toast.success("Profile updated");
        router.push(`/u/${userId}`);
      } catch {
        toast.error("Failed to update profile");
      }
    });
  }

  return (
    <div className="py-12 flex flex-col items-center gap-8">
      <div className="text-center max-w-xl">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl leading-tight">
          Settings
        </h1>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Update your profile so others can recognize you.
        </p>
      </div>

      <Card
        className="w-full max-w-2xl mx-auto shadow-md"
        data-testid="settings-form"
      >
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit}>
            <FieldGroup className="gap-y-6">
              <FieldGroup className="gap-y-4">
                <Field>
                  <FieldLabel>Avatar</FieldLabel>
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      userId={currentUser.userId}
                      name={
                        displayNameTrimmed ||
                        currentUser.displayName ||
                        "User"
                      }
                      avatarUrl={currentUser.avatarUrl}
                      className="size-12"
                    />
                    <p className="text-xs text-muted-foreground">
                      Avatars come from your OAuth provider. Custom upload
                      coming soon.
                    </p>
                  </div>
                </Field>

                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    value={currentUser.email ?? ""}
                    readOnly
                    disabled
                  />
                  <FieldDescription>
                    Email is managed by your sign-in provider and cannot be
                    changed here.
                  </FieldDescription>
                </Field>
              </FieldGroup>

              <Separator />

              <FieldGroup className="gap-y-4">
                <Field data-invalid={displayNameInvalid}>
                  <FieldLabel htmlFor="displayName">Display Name</FieldLabel>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    aria-invalid={displayNameInvalid}
                    placeholder="How should we call you?"
                  />
                  {displayNameInvalid && (
                    <FieldError>Display name cannot be empty.</FieldError>
                  )}
                </Field>

                <Field data-invalid={bioInvalid}>
                  <FieldLabel htmlFor="bio">Bio</FieldLabel>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    aria-invalid={bioInvalid}
                    placeholder="Tell us a little about yourself."
                    rows={4}
                  />
                  <FieldDescription>
                    {bio.length} / {MAX_BIO_LENGTH} characters
                  </FieldDescription>
                  {bioInvalid && (
                    <FieldError>
                      Bio must be {MAX_BIO_LENGTH} characters or fewer.
                    </FieldError>
                  )}
                </Field>

                <Button
                  type="submit"
                  disabled={isPending || displayNameInvalid || bioInvalid}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="animate-spin size-4" />
                      <span className="ml-2">Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </Button>
              </FieldGroup>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
