"use client";

import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

type Router = { push: (href: string) => void };

export function signOutUser(
  router: Router,
): Promise<{ ok: boolean; message?: string }> {
  return new Promise((resolve) => {
    const fail = (message: string) => {
      toast.error(message);
      resolve({ ok: false, message });
    };
    try {
      const request = authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            toast.success("Logged out successfully!");
            router.push("/");
            resolve({ ok: true });
          },
          onError: (error) => {
            fail(error.error.message);
          },
        },
      });
      void Promise.resolve(request).catch((error: unknown) =>
        fail(error instanceof Error ? error.message : "Sign out failed"),
      );
    } catch (error) {
      fail(error instanceof Error ? error.message : "Sign out failed");
    }
  });
}
