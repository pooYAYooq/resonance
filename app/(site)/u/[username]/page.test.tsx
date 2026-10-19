import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

const {
  fetchQueryMock,
  fetchAuthQueryMock,
  redirectMock,
  notFoundMock,
  authorProfileMock,
} = vi.hoisted(() => ({
  fetchQueryMock: vi.fn(),
  fetchAuthQueryMock: vi.fn(),
  redirectMock: vi.fn(),
  notFoundMock: vi.fn(),
  authorProfileMock: vi.fn<(props: Record<string, unknown>) => null>(
    () => null,
  ),
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
    profiles: {
      getPublicIdentity: "getPublicIdentity",
      getShowcase: "getShowcase",
    },
  },
}));
vi.mock("./_components/AuthorProfile", () => ({
  AuthorProfile: authorProfileMock,
}));

import ProfileRoute, { generateMetadata } from "./page";

const identity = {
  userId: "author-1",
  displayName: "Ada Lovelace",
  username: "pooya",
  bio: "Writes things.",
  avatarUrl: null,
  countryCode: "GB",
  socialProfiles: {},
  joinedAt: Date.UTC(2024, 2, 5),
  joinDateDisplay: "calendar" as const,
  followerCount: 0,
  followingCount: 0,
  postCount: 0,
};

const showcase = { mode: "latest" as const, posts: [] };

const resolved = {
  kind: "profile" as const,
  ownerUserId: "author-1",
  username: "pooya",
};

describe("username profile route", () => {
  beforeEach(() => {
    fetchQueryMock.mockReset();
    fetchAuthQueryMock.mockReset();
    redirectMock.mockReset();
    notFoundMock.mockReset();
    authorProfileMock.mockClear();
    // Mirror the real runtime: redirect()/notFound() abort by throwing.
    redirectMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
    notFoundMock.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
  });

  it("fetches identity, viewer state, and the showcase, then renders the profile", async () => {
    fetchQueryMock.mockImplementation(async (query: string) => {
      if (query === "resolveUsername") return resolved;
      if (query === "getPublicIdentity") return identity;
      return showcase;
    });
    fetchAuthQueryMock.mockResolvedValue({
      userId: "author-1",
      viewerId: "viewer-9",
      isFollowing: true,
    });

    const element = await ProfileRoute({
      params: Promise.resolve({ username: "pooya" }),
    });
    render(element);

    expect(redirectMock).not.toHaveBeenCalled();
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(fetchQueryMock).toHaveBeenCalledWith("getPublicIdentity", {
      userId: "author-1",
    });
    expect(fetchQueryMock).toHaveBeenCalledWith("getShowcase", {
      userId: "author-1",
    });
    expect(fetchAuthQueryMock).toHaveBeenCalledWith("getUserProfile", {
      userId: "author-1",
    });

    const props = authorProfileMock.mock.calls[0][0];
    expect(props.initialIdentity).toBe(identity);
    expect(props.initialViewer).toEqual({
      viewerId: "viewer-9",
      isFollowing: true,
    });
    expect(props.initialShowcase).toBe(showcase);
    expect(typeof props.initialNow).toBe("number");
  });

  it("renders the unavailable state when the public identity is missing", async () => {
    fetchQueryMock.mockImplementation(async (query: string) =>
      query === "resolveUsername" ? resolved : null,
    );

    await expect(
      ProfileRoute({ params: Promise.resolve({ username: "pooya" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
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

  it("bounds the metadata description to the first 160 characters of the bio", async () => {
    const bio = "word ".repeat(80);
    fetchQueryMock.mockImplementation(async (query: string) =>
      query === "resolveUsername" ? resolved : { ...identity, bio },
    );

    const metadata = await generateMetadata({
      params: Promise.resolve({ username: "pooya" }),
    });

    expect(metadata.title).toBe("Ada Lovelace | Resonance");
    expect(metadata.description).toBe(
      bio.replace(/\s+/g, " ").trim().slice(0, 160),
    );
  });

  it("falls back to the author tagline when the bio is empty", async () => {
    fetchQueryMock.mockImplementation(async (query: string) =>
      query === "resolveUsername" ? resolved : { ...identity, bio: "   " },
    );

    const metadata = await generateMetadata({
      params: Promise.resolve({ username: "pooya" }),
    });

    expect(metadata.description).toBe("Posts by Ada Lovelace on Resonance.");
  });
});
