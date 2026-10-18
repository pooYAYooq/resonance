/**
 * Route tests for the public author post catalogue at `/u/[username]/posts`.
 *
 * The route resolves the same address as the profile page, so it must redirect
 * preserved spellings with the `/posts` suffix, 404 unknown and ownerless
 * names, render only the compact identity header, and hand the resolved owner
 * to the client catalogue. The catalogue itself streams `listAuthorPosts`, so
 * the server deliberately fetches nothing for it.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const {
  fetchQueryMock,
  redirectMock,
  notFoundMock,
  authorCatalogueMock,
  userAvatarMock,
} = vi.hoisted(() => ({
  fetchQueryMock: vi.fn(),
  redirectMock: vi.fn(),
  notFoundMock: vi.fn(),
  authorCatalogueMock: vi.fn<(props: Record<string, unknown>) => null>(
    () => null,
  ),
  userAvatarMock: vi.fn<(props: Record<string, unknown>) => null>(() => null),
}));

vi.mock("convex/nextjs", () => ({ fetchQuery: fetchQueryMock }));
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));
vi.mock("@/convex/_generated/api", () => ({
  api: {
    usernames: { resolveUsername: "resolveUsername" },
    profiles: { getPublicIdentity: "getPublicIdentity" },
  },
}));
vi.mock("@/components/web/UserAvatar", () => ({ UserAvatar: userAvatarMock }));
vi.mock("./_components/AuthorCatalogue", () => ({
  AuthorCatalogue: authorCatalogueMock,
}));

import CatalogueRoute, { generateMetadata } from "./page";

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

const resolved = {
  kind: "profile" as const,
  ownerUserId: "author-1",
  username: "pooya",
};

describe("username post catalogue route", () => {
  beforeEach(() => {
    fetchQueryMock.mockReset();
    redirectMock.mockReset();
    notFoundMock.mockReset();
    authorCatalogueMock.mockClear();
    userAvatarMock.mockClear();
    // Mirror the real runtime: redirect()/notFound() abort by throwing.
    redirectMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
    notFoundMock.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
  });

  it("renders the compact identity header and the resolved author's catalogue", async () => {
    fetchQueryMock.mockImplementation(async (query: string) =>
      query === "resolveUsername" ? resolved : identity,
    );

    const element = await CatalogueRoute({
      params: Promise.resolve({ username: "pooya" }),
    });
    render(element);

    expect(redirectMock).not.toHaveBeenCalled();
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { level: 1, name: "Ada Lovelace" }),
    ).toBeInTheDocument();
    expect(screen.getByText("@pooya")).toBeInTheDocument();

    const back = screen.getByRole("link", { name: /back to profile/i });
    expect(back).toHaveAttribute("href", "/u/pooya");
    expect(back.querySelector("svg")).not.toBeNull();

    expect(userAvatarMock.mock.calls[0][0]).toMatchObject({
      userId: "author-1",
      name: "Ada Lovelace",
      avatarUrl: null,
    });

    expect(authorCatalogueMock.mock.calls[0][0]).toMatchObject({
      userId: "author-1",
      username: "pooya",
    });

    // Nothing but the address and the public identity is read on the server;
    // the catalogue streams from the client.
    expect(fetchQueryMock.mock.calls.map(([query]) => query)).toEqual([
      "resolveUsername",
      "getPublicIdentity",
    ]);
  });

  it("does not repeat the profile's bio or showcase on the catalogue", async () => {
    fetchQueryMock.mockImplementation(async (query: string) =>
      query === "resolveUsername" ? resolved : identity,
    );

    render(
      await CatalogueRoute({ params: Promise.resolve({ username: "pooya" }) }),
    );

    expect(screen.queryByText("Writes things.")).toBeNull();
  });

  it("redirects a preserved spelling to the canonical catalogue address", async () => {
    fetchQueryMock.mockResolvedValue({
      kind: "redirect",
      username: "secondname",
    });

    await CatalogueRoute({
      params: Promise.resolve({ username: "FirstName" }),
    }).catch(() => undefined);

    expect(redirectMock).toHaveBeenCalledWith("/u/secondname/posts");
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("renders the shared unavailable state for an unknown address", async () => {
    fetchQueryMock.mockResolvedValue({ kind: "notFound" });

    await expect(
      CatalogueRoute({ params: Promise.resolve({ username: "unknownname" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFoundMock).toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("renders the shared unavailable state when the public identity is missing", async () => {
    fetchQueryMock.mockImplementation(async (query: string) =>
      query === "resolveUsername" ? resolved : null,
    );

    await expect(
      CatalogueRoute({ params: Promise.resolve({ username: "pooya" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFoundMock).toHaveBeenCalled();
  });

  it("titles the catalogue after the author and bounds the description", async () => {
    const bio = "word ".repeat(80);
    fetchQueryMock.mockImplementation(async (query: string) =>
      query === "resolveUsername" ? resolved : { ...identity, bio },
    );

    const metadata = await generateMetadata({
      params: Promise.resolve({ username: "pooya" }),
    });

    expect(metadata.title).toBe("All posts by Ada Lovelace | Resonance");
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

    expect(metadata.title).toBe("All posts by Ada Lovelace | Resonance");
    expect(metadata.description).toBe("Posts by Ada Lovelace on Resonance.");
  });
});
