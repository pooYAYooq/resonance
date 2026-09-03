"use client";

import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

type Router = { push: (href: string) => void };

export function signOutUser(router: Router) {
  authClient.signOut({
    fetchOptions: {
      onSuccess: () => {
        toast.success("Logged out successfully!");
        router.push("/");
      },
      onError: (error) => {
        toast.error(error.error.message);
      },
    },
  });
}
