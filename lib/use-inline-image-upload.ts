import { useMutation } from "convex/react";
import { useEffect, useRef } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  isAllowedInlineImageType,
  MAX_INLINE_IMAGE_SIZE_BYTES,
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

export type UseInlineImageUploadOptions = {
  resolvedImageUrls?: Record<string, string | null>;
  onUploadSessionCreated?: (
    sessionId: Id<"pendingUploads">,
    storageId: Id<"_storage">,
  ) => void;
};

export function useInlineImageUpload({
  resolvedImageUrls = {},
  onUploadSessionCreated,
}: UseInlineImageUploadOptions = {}) {
  const createPendingUpload = useMutation(
    api.pendingUploads.createPendingUpload,
  );
  const cleanupPending = useMutation(api.pendingUploads.cleanupPending);
  const finalizePendingUpload = useMutation(
    api.pendingUploads.finalizePendingUpload,
  );
  const objectUrls = useRef(new Map<string, string>());
  const onUploadSessionCreatedRef = useRef(onUploadSessionCreated);

  useEffect(() => {
    onUploadSessionCreatedRef.current = onUploadSessionCreated;
  }, [onUploadSessionCreated]);

  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      for (const url of urls.values()) {
        URL.revokeObjectURL(url);
      }
      urls.clear();
    };
  }, []);

  const uploadFile = async (file: File): Promise<string> => {
    if (
      !isAllowedInlineImageType(file.type) ||
      file.size > MAX_INLINE_IMAGE_SIZE_BYTES
    ) {
      throw new Error("Invalid inline image file");
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

      onUploadSessionCreatedRef.current?.(session.sessionId, result.storageId);
      objectUrls.current.set(result.storageId, URL.createObjectURL(file));
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

  const resolveFileUrl = async (storageId: string): Promise<string> =>
    objectUrls.current.get(storageId) ?? resolvedImageUrls[storageId] ?? "";

  return { uploadFile, resolveFileUrl };
}
