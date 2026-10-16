/**
 * Conflict-aware identity form for `/profile/edit`.
 *
 * Owns display name, introduction, optional country, the five fixed social
 * links, and the join-date display preference. It keeps its own
 * value/baseline/revision and pending state; the page-level Save requests a
 * save from each dirty section independently.
 *
 * Live query updates arrive through the `initialIdentity`/`revision` props. A
 * clean form adopts them; a dirty form keeps the author's typing and surfaces
 * an explicit Reload, never an automatic overwrite or force-save.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  countCodePoints,
  MAX_PROFILE_BIO_CODE_POINTS,
  MAX_PROFILE_NAME_CODE_POINTS,
  normalizeProfileIdentity,
  type IdentityInput,
} from "@/lib/profile-identity";
import {
  normalizeSocialProfiles,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
} from "@/lib/profile-socials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { UserAvatar } from "@/components/web/UserAvatar";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Behance01Icon,
  InstagramIcon,
  Linkedin01Icon,
  NewTwitterIcon,
  YoutubeIcon,
} from "@hugeicons/core-free-icons";
import { CountryPicker } from "./CountryPicker";
import {
  initialEditState,
  markConflict,
  readEditFieldError,
  receiveSaved,
  reconcileSaved,
  type EditState,
} from "./profileEditState";
import type { ProfileEditSaveStatus } from "./profileEditSave";

const BASE = "profile-identity";

const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  behance: "Behance",
  youtube: "YouTube",
  x: "X",
};

const SOCIAL_PLACEHOLDERS: Record<SocialPlatform, string> = {
  instagram: "https://instagram.com/username",
  linkedin: "https://linkedin.com/in/username",
  behance: "https://behance.net/username",
  youtube: "https://youtube.com/@username",
  x: "https://x.com/username",
};

const SOCIAL_ICONS: Record<SocialPlatform, IconSvgElement> = {
  instagram: InstagramIcon,
  linkedin: Linkedin01Icon,
  behance: Behance01Icon,
  youtube: YoutubeIcon,
  x: NewTwitterIcon,
};

export type ProfileIdentityFormProps = {
  userId: string;
  email: string | null;
  avatarUrl: string | null;
  initialIdentity: IdentityInput;
  revision: number;
  saveRequest: number;
  onSaveRequest: () => void;
  onSaveStateChange: (status: ProfileEditSaveStatus) => void;
};

function identityEquals(a: IdentityInput, b: IdentityInput): boolean {
  return (
    a.displayName === b.displayName &&
    a.bio === b.bio &&
    a.countryCode === b.countryCode &&
    a.joinDateDisplay === b.joinDateDisplay &&
    SOCIAL_PLATFORMS.every(
      (platform) =>
        (a.socialProfiles[platform] ?? "") ===
        (b.socialProfiles[platform] ?? ""),
    )
  );
}

function fieldElementId(field: string): string {
  switch (field) {
    case "displayName":
      return `${BASE}-display-name`;
    case "bio":
      return `${BASE}-bio`;
    case "countryCode":
      return `${BASE}-country`;
    case "socialProfiles":
      return `${BASE}-social-links`;
    default:
      return BASE;
  }
}

function socialValidationMessage(
  platform: SocialPlatform,
  input: string,
): string | undefined {
  const result = normalizeSocialProfiles({ [platform]: input });
  return result.ok ? undefined : result.message;
}

export function ProfileIdentityForm({
  userId,
  email,
  avatarUrl,
  initialIdentity,
  revision,
  saveRequest,
  onSaveRequest,
  onSaveStateChange,
}: ProfileIdentityFormProps) {
  const updateIdentity = useMutation(api.profiles.updateIdentity);
  const [state, setState] = useState<EditState<IdentityInput>>(() =>
    initialEditState(initialIdentity, revision),
  );
  const [processedRevision, setProcessedRevision] = useState(revision);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof IdentityInput, string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [visibleSocials, setVisibleSocials] = useState<SocialPlatform[]>(() =>
    SOCIAL_PLATFORMS.filter((platform) =>
      Boolean(initialIdentity.socialProfiles[platform]),
    ),
  );
  const [socialValidationErrors, setSocialValidationErrors] = useState<
    Partial<Record<SocialPlatform, string>>
  >({});
  const [socialStatus, setSocialStatus] = useState("");
  const addSocialRef = useRef<HTMLButtonElement>(null);
  const menuFocusTarget = useRef<SocialPlatform | null>(null);
  const socialInputRefs = useRef(new Map<SocialPlatform, HTMLInputElement>());
  const socialFocusRequest = useRef<{
    platform: SocialPlatform;
    input: boolean;
  } | null>(null);
  const handledSaveRequest = useRef(saveRequest);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const request = socialFocusRequest.current;
    if (!request) return;
    socialFocusRequest.current = null;
    if (request.input) socialInputRefs.current.get(request.platform)?.focus();
    else addSocialRef.current?.focus();
  }, [visibleSocials, state.value.socialProfiles]);

  // Adopt a newer saved revision only while the form is clean. Adjusting state
  // during render (rather than in an effect) avoids a stale frame of dirty
  // input being clobbered.
  // A query echo can arrive before the mutation result. Wait for submission
  // reconciliation even if newer typing has returned to the old baseline.
  if (revision !== processedRevision && !pending) {
    setProcessedRevision(revision);
    setState((current) =>
      receiveSaved(current, initialIdentity, revision, identityEquals),
    );
  }

  const { value, conflict } = state;
  const dirty = !identityEquals(value, state.baseline);
  const nameCount = countCodePoints(value.displayName.trim());
  const bioCount = countCodePoints(value.bio);
  function patch<K extends keyof IdentityInput>(
    key: K,
    next: IdentityInput[K],
  ) {
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
    setState((current) => ({
      ...current,
      value: { ...current.value, [key]: next },
    }));
  }

  function patchSocial(platform: SocialPlatform, next: string) {
    setFieldErrors((current) => ({ ...current, socialProfiles: undefined }));
    setState((current) => ({
      ...current,
      value: {
        ...current.value,
        socialProfiles: {
          ...current.value.socialProfiles,
          [platform]: next,
        },
      },
    }));
  }

  function validateSocial(platform: SocialPlatform, input: string) {
    setSocialValidationErrors((current) => ({
      ...current,
      [platform]: socialValidationMessage(platform, input),
    }));
  }

  function openSocial(platform: SocialPlatform) {
    if (pending) return;
    menuFocusTarget.current = platform;
    socialFocusRequest.current = { platform, input: true };
    setVisibleSocials((current) =>
      current.includes(platform) ? current : [...current, platform],
    );
  }

  function removeSocial(platform: SocialPlatform) {
    if (pending) return;
    socialFocusRequest.current = { platform, input: false };
    patchSocial(platform, "");
    setSocialValidationErrors((current) => ({
      ...current,
      [platform]: undefined,
    }));
    setVisibleSocials((current) => current.filter((item) => item !== platform));
    setSocialStatus(
      `${SOCIAL_LABELS[platform]} link removed. Save your changes to update your profile.`,
    );
  }

  function handleReload() {
    setState(initialEditState(initialIdentity, revision));
    setProcessedRevision(revision);
    setFieldErrors({});
    setFormError(null);
    setVisibleSocials(
      SOCIAL_PLATFORMS.filter((platform) =>
        Boolean(initialIdentity.socialProfiles[platform]),
      ),
    );
    setSocialStatus("");
    setSocialValidationErrors({});
  }

  const handleSave = useCallback(async () => {
    if (pending || !dirty || conflict) return;
    setFieldErrors({});
    setFormError(null);

    const submitted = state.value;
    const invalidSocials = Object.fromEntries(
      SOCIAL_PLATFORMS.map((platform) => [
        platform,
        socialValidationMessage(
          platform,
          submitted.socialProfiles[platform] ?? "",
        ),
      ]),
    );
    const firstInvalidSocial = SOCIAL_PLATFORMS.find((platform) =>
      Boolean(invalidSocials[platform]),
    );
    setSocialValidationErrors(invalidSocials);
    const normalized = normalizeProfileIdentity(submitted);
    if (!normalized.ok) {
      setFieldErrors({ [normalized.field]: normalized.message });
      if (normalized.field === "socialProfiles" && firstInvalidSocial) {
        const input = socialInputRefs.current.get(firstInvalidSocial);
        if (input) input.focus();
        else {
          socialFocusRequest.current = {
            platform: firstInvalidSocial,
            input: true,
          };
          setVisibleSocials((current) => [...current, firstInvalidSocial]);
        }
      } else {
        document.getElementById(fieldElementId(normalized.field))?.focus();
      }
      return;
    }
    const savedValue = normalized.value;

    setPending(true);
    try {
      const result = await updateIdentity({
        expectedRevision: state.revision,
        identity: savedValue,
      });
      if (!mounted.current) return;
      if (result.kind === "saved") {
        setSocialStatus("");
        setState((current) =>
          identityEquals(current.value, submitted)
            ? initialEditState(savedValue, result.revision)
            : reconcileSaved(current, savedValue, result.revision),
        );
        toast.success("Profile updated");
        return;
      }
      setState(markConflict);
    } catch (error) {
      if (!mounted.current) return;
      const fieldError = readEditFieldError(error);
      if (fieldError) {
        setFieldErrors({ [fieldError.field]: fieldError.message });
        document.getElementById(fieldElementId(fieldError.field))?.focus();
      } else {
        setFormError("Failed to save your profile. Try again.");
      }
    } finally {
      if (mounted.current) setPending(false);
    }
  }, [conflict, dirty, pending, state.revision, state.value, updateIdentity]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSaveRequest();
  }

  useEffect(() => {
    onSaveStateChange({ dirty, pending, conflict });
  }, [dirty, pending, conflict, onSaveStateChange]);

  useEffect(() => {
    if (handledSaveRequest.current === saveRequest) return;
    handledSaveRequest.current = saveRequest;
    if (dirty && !pending && !conflict) void handleSave();
  }, [saveRequest, dirty, pending, conflict, handleSave]);

  function fieldErrorProps(field: keyof IdentityInput) {
    const message = fieldErrors[field];
    return {
      invalid: Boolean(message),
      error: message,
    };
  }

  const nameMessage =
    nameCount > MAX_PROFILE_NAME_CODE_POINTS
      ? `Use at most ${MAX_PROFILE_NAME_CODE_POINTS} characters.`
      : fieldErrors.displayName;
  const nameError = { invalid: Boolean(nameMessage), error: nameMessage };
  const bioError = fieldErrorProps("bio");
  const countryError = fieldErrorProps("countryCode");
  const socialError = fieldErrors.socialProfiles;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FieldGroup className="gap-y-6">
        <div className="flex flex-col items-start gap-3">
          <UserAvatar
            userId={userId}
            name={value.displayName || "User"}
            avatarUrl={avatarUrl}
            className="size-24 shrink-0 ring-1 ring-border ring-offset-4 ring-offset-background"
          />
          {email && (
            <p className="break-all text-xs text-muted-foreground">
              Signed in as {email}
            </p>
          )}
        </div>

        <Separator />

        <FieldGroup className="gap-y-4">
          <Field data-invalid={nameError.invalid || undefined}>
            <FieldLabel htmlFor={`${BASE}-display-name`}>
              Display name
            </FieldLabel>
            <div className="relative w-full">
              <Input
                id={`${BASE}-display-name`}
                value={value.displayName}
                onChange={(event) => patch("displayName", event.target.value)}
                aria-describedby={
                  nameError.error
                    ? `${BASE}-display-name-error ${BASE}-display-name-count`
                    : `${BASE}-display-name-count`
                }
                aria-invalid={nameError.invalid || undefined}
                className="w-full pr-16 aria-invalid:text-destructive"
                placeholder="Your name"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs tabular-nums text-muted-foreground"
              >
                {nameCount}/30
              </span>
            </div>
            <span id={`${BASE}-display-name-count`} className="sr-only">
              {nameCount} of 30 characters
            </span>
            <div className="min-h-5">
              {nameError.error && (
                <FieldError id={`${BASE}-display-name-error`}>
                  {nameError.error}
                </FieldError>
              )}
            </div>
          </Field>

          <Field data-invalid={bioError.invalid || undefined}>
            <FieldLabel htmlFor={`${BASE}-bio`}>Bio</FieldLabel>
            <Textarea
              id={`${BASE}-bio`}
              value={value.bio}
              onChange={(event) => patch("bio", event.target.value)}
              aria-describedby={`${BASE}-bio-count${bioError.error ? ` ${BASE}-bio-error` : ""}`}
              aria-invalid={bioError.invalid || undefined}
              className="field-sizing-fixed"
              placeholder="What do you create? What interests you?"
              rows={8}
            />
            <FieldDescription id={`${BASE}-bio-count`}>
              {bioCount} / {MAX_PROFILE_BIO_CODE_POINTS} characters
            </FieldDescription>
            <div className="min-h-5">
              {bioError.error && (
                <FieldError id={`${BASE}-bio-error`}>
                  {bioError.error}
                </FieldError>
              )}
            </div>
          </Field>

          <CountryPicker
            id={`${BASE}-country`}
            label="Country"
            value={value.countryCode}
            onChange={(code) => patch("countryCode", code)}
            invalid={countryError.invalid}
            error={countryError.error}
          />
        </FieldGroup>

        <Separator />

        <FieldSet id={`${BASE}-social-links`} tabIndex={-1} className="gap-2">
          <FieldLegend variant="label" className="mb-0">
            Social links
          </FieldLegend>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                ref={addSocialRef}
                type="button"
                variant="outline"
                className="mt-2 w-fit"
                disabled={
                  pending ||
                  SOCIAL_PLATFORMS.every(
                    (platform) =>
                      visibleSocials.includes(platform) ||
                      Boolean(value.socialProfiles[platform]),
                  )
                }
              >
                <Plus data-icon="inline-start" />
                Add social link
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              onCloseAutoFocus={(event) => {
                const platform = menuFocusTarget.current;
                if (platform) {
                  event.preventDefault();
                  socialInputRefs.current.get(platform)?.focus();
                  menuFocusTarget.current = null;
                }
              }}
            >
              <DropdownMenuGroup>
                {SOCIAL_PLATFORMS.filter(
                  (platform) =>
                    !visibleSocials.includes(platform) &&
                    !value.socialProfiles[platform],
                ).map((platform) => (
                  <DropdownMenuItem
                    key={platform}
                    onSelect={() => openSocial(platform)}
                  >
                    {SOCIAL_LABELS[platform]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="min-h-5">
            {socialError && (
              <FieldError id={`${BASE}-social-error`}>{socialError}</FieldError>
            )}
          </div>
          <FieldGroup className="gap-3">
            {SOCIAL_PLATFORMS.filter(
              (platform) =>
                visibleSocials.includes(platform) ||
                Boolean(value.socialProfiles[platform]),
            ).map((platform) => {
              const label = SOCIAL_LABELS[platform];
              const inputId = `${BASE}-social-${platform}`;
              const validationError = socialValidationErrors[platform];
              return (
                <Field
                  key={platform}
                  data-invalid={
                    Boolean(validationError || socialError) || undefined
                  }
                  className="gap-1.5 data-[invalid=true]:text-foreground"
                >
                  <div className="w-full max-w-3xl">
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon
                        icon={SOCIAL_ICONS[platform]}
                        size={18}
                        aria-hidden="true"
                        className="shrink-0 text-muted-foreground"
                      />
                      <Input
                        id={inputId}
                        aria-label={label}
                        type="url"
                        inputMode="url"
                        ref={(node) => {
                          if (node) socialInputRefs.current.set(platform, node);
                          else socialInputRefs.current.delete(platform);
                        }}
                        aria-invalid={
                          Boolean(validationError || socialError) || undefined
                        }
                        aria-describedby={
                          validationError
                            ? `${inputId}-error`
                            : socialError
                              ? `${BASE}-social-error`
                              : undefined
                        }
                        value={value.socialProfiles[platform] ?? ""}
                        onChange={(event) => {
                          const input = event.target.value;
                          setVisibleSocials((current) =>
                            current.includes(platform)
                              ? current
                              : [...current, platform],
                          );
                          patchSocial(platform, input);
                          if (socialValidationErrors[platform])
                            validateSocial(platform, input);
                        }}
                        onBlur={(event) =>
                          validateSocial(platform, event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.nativeEvent.isComposing) return;
                          if (event.key === "Enter") {
                            event.preventDefault();
                          }
                        }}
                        placeholder={SOCIAL_PLACEHOLDERS[platform]}
                        className="min-w-0 flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove ${label} link`}
                        disabled={pending}
                        className="min-h-9 shrink-0 hover:bg-transparent! hover:text-destructive"
                        onClick={() => removeSocial(platform)}
                      >
                        Remove
                      </Button>
                    </div>
                    <div className="min-h-5">
                      {validationError && (
                        <FieldError id={`${inputId}-error`}>
                          {validationError}
                        </FieldError>
                      )}
                    </div>
                  </div>
                </Field>
              );
            })}
          </FieldGroup>
          <p role="status" aria-live="polite" className="sr-only">
            {socialStatus}
          </p>
        </FieldSet>

        {(conflict || formError) && (
          <div role="alert" className="text-sm text-destructive">
            <p>
              {conflict
                ? "Another version of your profile was saved. Loading it will replace your unsaved changes."
                : formError}
            </p>
            {conflict && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={handleReload}
              >
                Load saved version
              </Button>
            )}
          </div>
        )}
      </FieldGroup>
    </form>
  );
}
