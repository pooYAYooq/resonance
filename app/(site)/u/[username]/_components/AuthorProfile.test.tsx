/**
 * Integration tests for the public `AuthorProfile` client component.
 *
 * The component is the boundary between the server-rendered identity and the
 * live viewer-aware query, so these tests pin the three action paths, the
 * bounded description inputs, the optional-metadata omissions, and the guard
 * that no private or body listing query is introduced.
 */

import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { useQueryMock, useQueryCalls, useConvexAuthMock, pushMock } = vi.hoisted(
  () => ({
    useQueryMock: vi.fn(),
    useQueryCalls: [] as Array<{ query: unknown; args: unknown }>,
    useConvexAuthMock: vi.fn(),
    pushMock: vi.fn(),
  }),
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => useConvexAuthMock(),
  useQuery: (query: unknown, args: unknown) => {
    useQueryCalls.push({ query, args });
    return useQueryMock(query, args);
  },
  useMutation: () => vi.fn(),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    users: { getUserProfile: "getUserProfile" },
    follows: {
      getFollowCounts: "getFollowCounts",
      isFollowing: "isFollowing",
      toggleFollow: "toggleFollow",
    },
    profiles: {
      getPublicIdentity: "getPublicIdentity",
      getShowcase: "getShowcase",
    },
    posts: { getPostsByAuthorId: "getPostsByAuthorId" },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { AuthorProfile, type PublicIdentityView } from "./AuthorProfile";

const identity = {
  userId: "author-1",
  displayName: "Maya Bennett",
  username: "MayaB",
  bio: "I write about the places we live.",
  avatarUrl: null,
  countryCode: "DK",
  socialProfiles: { instagram: "https://instagram.com/maya" },
  joinedAt: Date.UTC(2024, 2, 5),
  joinDateDisplay: "calendar" as const,
  followerCount: 1248,
  followingCount: 182,
  postCount: 9,
};

const baseLive = {
  userId: "author-1",
  displayName: "Maya Bennett",
  username: "MayaB",
  bio: "I write about the places we live.",
  avatarUrl: null,
  joinedDate: "March 2024",
  followerCount: 1248,
  followingCount: 182,
  postCount: 9,
  viewerId: null as string | null,
  isFollowing: false,
};

let liveProfile: typeof baseLive;
let liveIdentity: PublicIdentityView | undefined;

type ProfileProps = ComponentProps<typeof AuthorProfile>;

function profileElement(overrides: Partial<ProfileProps> = {}) {
  return (
    <AuthorProfile
      initialIdentity={identity}
      initialViewer={{ viewerId: null, isFollowing: false }}
      initialShowcase={{ mode: "selected", posts: [] }}
      initialNow={Date.UTC(2024, 2, 5)}
      {...overrides}
    />
  );
}

const allowedQueries = new Set([
  "getPublicIdentity",
  "getUserProfile",
  "getFollowCounts",
  "isFollowing",
  "getShowcase",
]);

describe("AuthorProfile", () => {
  beforeEach(() => {
    useQueryCalls.length = 0;
    useQueryMock.mockReset();
    useConvexAuthMock.mockReset();
    pushMock.mockReset();
    liveProfile = { ...baseLive };
    // Undefined by default so identity falls back to `initialIdentity`; tests
    // that exercise live identity set it explicitly.
    liveIdentity = undefined;
    useConvexAuthMock.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
    });
    useQueryMock.mockImplementation((query: string, args: unknown) => {
      if (args === "skip") return undefined;
      if (query === "getPublicIdentity") return liveIdentity;
      if (query === "getUserProfile") return liveProfile;
      if (query === "getFollowCounts")
        return { followerCount: 1248, followingCount: 182 };
      if (query === "isFollowing") return false;
      return undefined;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows Edit Profile for the owner", () => {
    liveProfile = { ...baseLive, viewerId: "author-1" };
    render(profileElement());

    expect(
      screen.getByRole("heading", { level: 1, name: "Maya Bennett" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /edit profile/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /follow maya/i })).toBeNull();
  });

  it("sends an anonymous visitor to log in from the follow action", async () => {
    const user = userEvent.setup();
    liveProfile = { ...baseLive, viewerId: null };
    render(profileElement());

    await user.click(
      screen.getByRole("button", { name: "Follow Maya Bennett" }),
    );

    expect(pushMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/auth\/login\?returnTo=/),
    );
  });

  it("renders Follow for another signed-in author", () => {
    liveProfile = { ...baseLive, viewerId: "viewer-9" };
    render(profileElement());

    const follow = screen.getByRole("button", { name: "Follow Maya Bennett" });
    expect(follow).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("link", { name: /edit profile/i })).toBeNull();
  });

  it("skips the viewer query while auth resolves, then replaces the server viewer state", () => {
    useConvexAuthMock.mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
    });
    liveProfile = { ...baseLive, viewerId: "viewer-9" };
    const { rerender } = render(
      profileElement({
        initialViewer: { viewerId: "author-1", isFollowing: false },
      }),
    );

    expect(
      screen.getByRole("link", { name: /edit profile/i }),
    ).toBeInTheDocument();
    expect(useQueryCalls).toContainEqual({
      query: "getUserProfile",
      args: "skip",
    });
    // Identity is public and viewer-independent, so it must never be gated on
    // auth resolution.
    expect(useQueryCalls).toContainEqual({
      query: "getPublicIdentity",
      args: { userId: "author-1" },
    });

    useConvexAuthMock.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
    });
    rerender(
      profileElement({
        initialViewer: { viewerId: "author-1", isFollowing: false },
      }),
    );

    expect(screen.queryByRole("link", { name: /edit profile/i })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Follow Maya Bennett" }),
    ).toBeInTheDocument();
    expect(useQueryCalls).toContainEqual({
      query: "getUserProfile",
      args: { userId: "author-1" },
    });
  });

  it("updates the hero name from the live identity query", () => {
    liveIdentity = { ...identity, displayName: "Maya B. Bennett" };
    render(profileElement());

    expect(
      screen.getByRole("heading", { level: 1, name: "Maya B. Bennett" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 1, name: "Maya Bennett" }),
    ).toBeNull();
  });

  it("refreshes identity fields the viewer query does not carry", () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2025, 2, 5));
    liveIdentity = {
      ...identity,
      countryCode: "JP",
      socialProfiles: { behance: "https://behance.net/maya" },
      joinDateDisplay: "relative",
    };
    render(profileElement());

    expect(screen.getByText("Japan")).toBeInTheDocument();
    expect(screen.queryByText("Denmark")).toBeNull();
    expect(screen.getByRole("link", { name: /behance/i })).toHaveAttribute(
      "href",
      "https://behance.net/maya",
    );
    expect(screen.queryByRole("link", { name: /instagram/i })).toBeNull();
    expect(screen.getByText("Joined 1 year ago")).toBeInTheDocument();
  });

  it("preserves paragraphs in a long introduction", () => {
    const longBio =
      "First paragraph about the work.\n\nSecond paragraph about the walk.";
    render(profileElement({ initialIdentity: { ...identity, bio: longBio } }));

    const bio = screen.getByText(
      (_content, element) =>
        element?.tagName === "P" && element.textContent === longBio,
    );
    expect(bio).toHaveClass("whitespace-pre-line");
  });

  it("omits absent optional metadata and socials entirely", () => {
    render(
      profileElement({
        initialIdentity: {
          ...identity,
          countryCode: null,
          joinedAt: null,
          socialProfiles: {},
        },
      }),
    );

    expect(
      screen.queryByRole("navigation", { name: /social links/i }),
    ).toBeNull();
    expect(screen.queryByText(/^Joined /)).toBeNull();
    expect(screen.queryByText("Denmark")).toBeNull();
  });

  it("shows only the country when there is no join date", () => {
    render(
      profileElement({ initialIdentity: { ...identity, joinedAt: null } }),
    );

    const kicker = screen.getByText("Denmark").closest("p")!;
    expect(kicker).toHaveTextContent("Denmark");
    expect(within(kicker).queryByText("·")).toBeNull();
    expect(screen.queryByText(/^Joined /)).toBeNull();
  });

  it("shows only the join date when there is no country", () => {
    render(
      profileElement({ initialIdentity: { ...identity, countryCode: null } }),
    );

    const kicker = screen.getByText("Joined March 2024").closest("p")!;
    expect(kicker).toHaveTextContent("Joined March 2024");
    expect(within(kicker).queryByText("·")).toBeNull();
  });

  it("separates the country and join date when both are present", () => {
    render(profileElement());

    const kicker = screen.getByText("Denmark").closest("p")!;
    expect(kicker).toHaveTextContent("Denmark·Joined March 2024");
    expect(within(kicker).getByText("·")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("renders a secure, labeled social link for each provided profile", () => {
    render(
      profileElement({
        initialIdentity: {
          ...identity,
          socialProfiles: {
            instagram: "https://instagram.com/maya",
            x: "https://x.com/maya",
          },
        },
      }),
    );

    const instagram = screen.getByRole("link", { name: /instagram/i });
    expect(instagram).toHaveAttribute("href", "https://instagram.com/maya");
    expect(instagram).toHaveAttribute("target", "_blank");
    expect(instagram.getAttribute("rel")).toContain("noopener");
    expect(screen.getByRole("link", { name: /^x/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /behance/i })).toBeNull();
  });

  it("never subscribes to a private or body listing query", () => {
    render(profileElement());

    const usedQueries = useQueryCalls.map((call) => call.query);
    expect(usedQueries).not.toContain("getPostsByAuthorId");
    expect(
      usedQueries.every((query) => allowedQueries.has(query as string)),
    ).toBe(true);
  });
});
