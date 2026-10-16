/**
 * Edit Profile page at `/profile/edit`.
 *
 * Client Component ("use client"), auth-gated via `useConvexAuth`. When the
 * user is unauthenticated, redirects to `/auth/login`. The route resolves the
 * authenticated author's editable profile with `profiles.getEditorProfile` and
 * mounts the conflict-aware identity form; selected-work editing mounts
 * alongside it. One page-level Save requests a save from each dirty section,
 * while identity and selection keep independent save/conflict state.
 *
 * Email and avatar are read-only here: email is owned by Better Auth and
 * avatars come from the sign-in provider. The form is keyed on the
 * authenticated `userId` so switching accounts discards local edits.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buildAuthHref, getCurrentReturnTo } from "@/lib/auth-return";
import { buildProfilePath } from "@/lib/username";
import { ProfileIdentityForm } from "./_components/ProfileIdentityForm";
import { SelectedWorkEditor } from "./_components/SelectedWorkEditor";
import { UsernameEditor } from "./_components/UsernameEditor";
import type { ProfileEditSaveStatus } from "./_components/profileEditSave";

const CLEAN_SAVE_STATUS: ProfileEditSaveStatus = {
  dirty: false,
  pending: false,
  conflict: false,
};

type SaveSection = "identity" | "selection";

function sameSaveStatus(
  current: ProfileEditSaveStatus,
  next: ProfileEditSaveStatus,
) {
  return (
    current.dirty === next.dirty &&
    current.pending === next.pending &&
    current.conflict === next.conflict
  );
}

export default function EditProfileRoute() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const [saveRequest, setSaveRequest] = useState(0);
  const [sectionSaveStatus, setSectionSaveStatus] = useState({
    identity: CLEAN_SAVE_STATUS,
    selection: CLEAN_SAVE_STATUS,
  });
  const editorProfile = useQuery(
    api.profiles.getEditorProfile,
    !isLoading && isAuthenticated ? {} : "skip",
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(buildAuthHref("/auth/login", getCurrentReturnTo()));
    }
  }, [isLoading, isAuthenticated, router]);

  const requestSave = useCallback(() => {
    setSaveRequest((request) => request + 1);
  }, []);

  const reportSaveStatus = useCallback(
    (section: SaveSection, next: ProfileEditSaveStatus) => {
      setSectionSaveStatus((current) =>
        sameSaveStatus(current[section], next)
          ? current
          : { ...current, [section]: next },
      );
    },
    [],
  );
  const reportIdentitySaveStatus = useCallback(
    (status: ProfileEditSaveStatus) => reportSaveStatus("identity", status),
    [reportSaveStatus],
  );
  const reportSelectionSaveStatus = useCallback(
    (status: ProfileEditSaveStatus) => reportSaveStatus("selection", status),
    [reportSaveStatus],
  );

  const identityCanSave =
    sectionSaveStatus.identity.dirty && !sectionSaveStatus.identity.conflict;
  const selectionCanSave =
    sectionSaveStatus.selection.dirty && !sectionSaveStatus.selection.conflict;
  const savePending =
    sectionSaveStatus.identity.pending || sectionSaveStatus.selection.pending;
  const canSave = identityCanSave || selectionCanSave;

  if (isLoading || !isAuthenticated || editorProfile === undefined) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="animate-spin size-8 text-muted-foreground" />
      </div>
    );
  }

  if (editorProfile === null) {
    return (
      <div className="py-12 flex flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-bold">We could not find your profile</h1>
        <p className="text-muted-foreground">
          Try signing in again, or return home.
        </p>
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-190 py-8 sm:py-12 flex flex-col gap-8">
      <header className="flex flex-col gap-4 border-b pb-6">
        <Link
          className="inline-flex w-fit items-center gap-2 rounded-sm py-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          href={
            editorProfile.username
              ? buildProfilePath(editorProfile.username)
              : "/settings"
          }
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to profile
        </Link>
        <div className="flex items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Edit profile
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Introduce yourself and choose the work you’d like to highlight.
            </p>
          </div>
          <Button
            type="button"
            className="cursor-pointer px-6 aria-disabled:cursor-default aria-disabled:opacity-50"
            aria-disabled={!canSave || savePending}
            variant={canSave && !savePending ? "default" : "secondary"}
            onClick={() => {
              if (canSave && !savePending) requestSave();
            }}
          >
            {savePending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-10">
        <section aria-label="Username settings" className="min-w-0">
          <UsernameEditor
            key={editorProfile.userId}
            userId={editorProfile.userId}
            initialUsername={editorProfile.username}
            revision={editorProfile.usernameRevision}
            newClaimAllowed={editorProfile.newUsernameClaim.allowed}
            newClaimRetryAfterMs={editorProfile.newUsernameClaim.retryAfterMs}
          />
        </section>

        <section
          aria-label="Profile details"
          className="min-w-0"
          data-testid="settings-form"
        >
          <ProfileIdentityForm
            key={editorProfile.userId}
            userId={editorProfile.userId}
            email={editorProfile.email}
            avatarUrl={editorProfile.avatarUrl}
            initialIdentity={editorProfile.identity}
            revision={editorProfile.identityRevision}
            saveRequest={saveRequest}
            onSaveRequest={requestSave}
            onSaveStateChange={reportIdentitySaveStatus}
          />
        </section>

        <section aria-label="Featured posts" className="min-w-0 border-t pt-8">
          <SelectedWorkEditor
            key={`${editorProfile.userId}-selection`}
            selectedPostIds={editorProfile.selectedPostIds}
            selectedPosts={editorProfile.selectedPosts}
            selectionRevision={editorProfile.selectionRevision}
            saveRequest={saveRequest}
            onSaveStateChange={reportSelectionSaveStatus}
          />
        </section>
      </div>
    </div>
  );
}
