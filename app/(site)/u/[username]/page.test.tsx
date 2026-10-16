import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchQueryMock, fetchAuthQueryMock, redirectMock, notFoundMock } =
  vi.hoisted(() => ({
    fetchQueryMock: vi.fn(),
    fetchAuthQueryMock: vi.fn(),
    redirectMock: vi.fn(),
    notFoundMock: vi.fn(),
  }));

vi.mock("convex/nextjs", () => ({ fetchQuery: fetchQueryMock }));
vi.mock("@/lib/auth-server", () => ({ fetchAuthQuery: fetchAuthQueryMock }));
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));
vi.mock("@/convex/_generated/api", () => ({
  api: {
    usernames: { resolveUsername: "resolveUsername" },
    users: { getUserProfile: "getUserProfile" },
    profiles: { getSelectedShowcase: "getSelectedShowcase" },
  },
}));
vi.mock("@/components/web/ProfileHeader", () => ({
  ProfileHeader: () => null,
}));
vi.mock("@/components/web/ProfileActionButton", () => ({
  ProfileActionButton: () => null,
}));
vi.mock("@/components/web/ProfileStats", () => ({ ProfileStats: () => null }));
vi.mock("./_components/ProfilePostList", () => ({
  ProfilePostList: () => null,
}));

import ProfileRoute from "./page";

const profile = {
  userId: "auth-user-1",
  displayName: "Ada Lovelace",
  bio: "Writes things.",
  avatarUrl: null,
  joinedDate: null,
  followerCount: 0,
  followingCount: 0,
  postCount: 0,
  viewerId: null,
  isFollowing: false,
  username: "pooya",
};

describe("username profile route", () => {
  beforeEach(() => {
    fetchQueryMock.mockReset();
    fetchAuthQueryMock.mockReset();
    redirectMock.mockReset();
    notFoundMock.mockReset();
    // Mirror the real runtime: notFound() aborts rendering by throwing.
    notFoundMock.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
  });

  it("renders the profile for the current lowercase address", async () => {
    fetchQueryMock.mockImplementation(async (query: string) =>
      query === "resolveUsername"
        ? { kind: "profile", ownerUserId: "auth-user-1", username: "pooya" }
        : [],
    );
    fetchAuthQueryMock.mockResolvedValue(profile);

    await expect(
      ProfileRoute({ params: Promise.resolve({ username: "pooya" }) }),
    ).resolves.toBeDefined();
    expect(redirectMock).not.toHaveBeenCalled();
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("redirects an owned previous address to the current one", async () => {
    fetchQueryMock.mockResolvedValue({
      kind: "redirect",
      username: "secondname",
    });

    await ProfileRoute({
      params: Promise.resolve({ username: "firstname" }),
    }).catch(() => undefined);
    expect(redirectMock).toHaveBeenCalledWith("/u/secondname");
  });

  it("renders the unavailable state for an unknown address", async () => {
    fetchQueryMock.mockResolvedValue({ kind: "notFound" });

    await expect(
      ProfileRoute({
        params: Promise.resolve({ username: "unknownname" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
