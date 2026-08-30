import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { fetchQueryMock, fetchAuthQueryMock } = vi.hoisted(() => ({
  fetchQueryMock: vi.fn(),
  fetchAuthQueryMock: vi.fn(),
}));

vi.mock("convex/nextjs", () => ({ fetchQuery: fetchQueryMock }));
vi.mock("@/lib/auth-server", () => ({ fetchAuthQuery: fetchAuthQueryMock }));
vi.mock("@/convex/_generated/api", () => ({
  api: { users: { getUserProfile: "getUserProfile" } },
}));
vi.mock("@/components/web/ProfileHeader", () => ({
  ProfileHeader: ({ displayName }: { displayName: string }) => (
    <h1>{displayName}</h1>
  ),
}));
vi.mock("@/components/web/ProfileActionButton", () => ({
  ProfileActionButton: () => null,
}));
vi.mock("@/components/web/ProfileStats", () => ({ ProfileStats: () => null }));
vi.mock("./_components/ProfilePostList", () => ({
  ProfilePostList: () => null,
}));

import ProfileRoute, { generateMetadata } from "./page";

const params = Promise.resolve({ userId: "author-1" });
const profile = {
  userId: "author-1",
  displayName: "Ada",
  bio: "Writes notes.",
  avatarUrl: null,
  followerCount: 2,
  followingCount: 3,
  postCount: 4,
  viewerId: "viewer-1",
  isFollowing: true,
};

describe("profile route fetch boundaries", () => {
  beforeEach(() => {
    fetchQueryMock.mockReset();
    fetchAuthQueryMock.mockReset();
  });

  it("uses the public query for profile metadata", async () => {
    fetchQueryMock.mockResolvedValue(profile);

    const metadata = await generateMetadata({ params });

    expect(metadata.title).toBe("Ada | Resonance");
    expect(fetchQueryMock).toHaveBeenCalledWith("getUserProfile", {
      userId: "author-1",
    });
    expect(fetchAuthQueryMock).not.toHaveBeenCalled();
  });

  it("uses the authenticated query for the viewer-aware profile render", async () => {
    fetchAuthQueryMock.mockResolvedValue(profile);

    render(await ProfileRoute({ params }));

    expect(screen.getByRole("heading", { name: "Ada" })).toBeInTheDocument();
    expect(fetchAuthQueryMock).toHaveBeenCalledWith("getUserProfile", {
      userId: "author-1",
    });
    expect(fetchQueryMock).not.toHaveBeenCalled();
  });
});
