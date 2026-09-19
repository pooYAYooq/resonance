import { useMutation } from "convex/react";
import { useEffect, useRef } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { isSafeEmbeddedMediaUrl } from "@/lib/blocknote-contract";
import {
  isAllowedBlockNoteFile,
  MAX_BLOCKNOTE_FILE_SIZE_BYTES,
} from "@/lib/inline-image";

async function retryFinalize(
  finalizePendingUpload: (args: {
    sessionId: Id<"pendingUploads">;
    storageId: Id<"_storage">;
  }) => Promise<{ accepted: boolean }>,
  args: { sessionId: Id<"pendingUploads">; storageId: Id<"_storage"> },
) {
  try {
    return await finalizePendingUpload(args);
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return finalizePendingUpload(args);
  }
}

export type UseBlockNoteFileUploadOptions = {
  resolvedImageUrls?: Record<string, string | null>;
  onUploadSessionCreated?: (
    sessionId: Id<"pendingUploads">,
    storageId: Id<"_storage">,
    objectUrl: string,
  ) => void;
};

export function useBlockNoteFileUpload({
  resolvedImageUrls = {},
  onUploadSessionCreated,
}: UseBlockNoteFileUploadOptions = {}) {
  const createPendingUpload = useMutation(
    api.pendingUploads.createPendingUpload,
  );
  const cleanupPending = useMutation(api.pendingUploads.cleanupPending);
  const finalizePendingUpload = useMutation(
    api.pendingUploads.finalizePendingUpload,
  );
  const objectUrls = useRef(new Map<string, string>());
  const disposed = useRef(false);
  const onUploadSessionCreatedRef = useRef(onUploadSessionCreated);

  useEffect(() => {
    onUploadSessionCreatedRef.current = onUploadSessionCreated;
  }, [onUploadSessionCreated]);

  useEffect(() => {
    disposed.current = false;
    const urls = objectUrls.current;
    return () => {
      disposed.current = true;
      for (const url of urls.values()) {
        URL.revokeObjectURL(url);
      }
      urls.clear();
    };
  }, []);

  const uploadFile = async (file: File): Promise<string> => {
    if (
      !isAllowedBlockNoteFile(file.type) ||
      file.size > MAX_BLOCKNOTE_FILE_SIZE_BYTES
    ) {
      throw new Error("Invalid BlockNote file");
    }

    const session = await createPendingUpload({});
    let uploadedStorageId: Id<"_storage"> | undefined;
    try {
      const uploadResult = await fetch(session.uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadResult.ok) {
        throw new Error("Failed to upload inline image");
      }

      const result = (await uploadResult.json()) as {
        storageId: Id<"_storage">;
      };
      uploadedStorageId = result.storageId;
      const finalizeResult = await retryFinalize(finalizePendingUpload, {
        sessionId: session.sessionId,
        storageId: result.storageId,
      });
      if (!finalizeResult.accepted) {
        throw new Error("Invalid inline upload session");
      }

      const objectUrl = URL.createObjectURL(file);
      if (disposed.current) {
        // The hook unmounted mid-upload; revoke and skip the callback so a
        // stale, revoked URL is never registered as the media's preview.
        URL.revokeObjectURL(objectUrl);
        return result.storageId;
      }
      objectUrls.current.set(result.storageId, objectUrl);
      onUploadSessionCreatedRef.current?.(
        session.sessionId,
        result.storageId,
        objectUrl,
      );
      return result.storageId;
    } catch (error) {
      try {
        await cleanupPending({
          uploads: [
            {
              sessionId: session.sessionId,
              ...(uploadedStorageId && { storageId: uploadedStorageId }),
            },
          ],
        });
      } catch {
        // Preserve the upload/finalization error if cleanup also fails.
      }
      throw error;
    }
  };

  // BlockNote resolves every media `url` prop through this hook. Storage bytes
  // resolve through an object URL or the server-resolved URL; a remote Embed
  // URL must pass through unchanged so native embeds render.
  const resolveFileUrl = async (value: string): Promise<string> => {
    const resolved = objectUrls.current.get(value) ?? resolvedImageUrls[value];
    if (resolved) return resolved;
    return isSafeEmbeddedMediaUrl(value) ? value : "";
  };

  return { uploadFile, resolveFileUrl };
}

/** @deprecated Use useBlockNoteFileUpload for new authoring code. */
export const useInlineImageUpload = useBlockNoteFileUpload;
export type UseInlineImageUploadOptions = UseBlockNoteFileUploadOptions;
