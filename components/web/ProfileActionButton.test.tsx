/**
 * Component tests for `ProfileActionButton`.
 *
 * Renders one of three states based on server-provided viewer state:
 *  - own profile → Edit Profile link
 *  - someone else → `FollowButton`
 *  - anonymous (null) → redirect-to-login "Follow" button
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { pushMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("./FollowButton", () => ({
  FollowButton: ({
    profileUserId,
    authorName,
  }: {
    profileUserId: string;
    authorName: string;
  }) => (
    <button
      type="button"
      data-testid="follow-button"
      data-profile-user-id={profileUserId}
    >
      Follow {authorName}
    </button>
  ),
}));

import { ProfileActionButton } from "./ProfileActionButton";

const baseProps = {
  profileUserId: "author-1",
  authorName: "Ada",
  viewerId: null,
  isFollowing: false,
};

describe("ProfileActionButton", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Edit Profile link on the viewer's own profile", () => {
    render(<ProfileActionButton {...baseProps} viewerId="author-1" />);
    const editLink = screen.getByRole("link", { name: /edit profile/i });
    expect(editLink).toBeInTheDocument();
    expect(editLink).toHaveAttribute("href", "/profile/edit");
  });

  it("renders FollowButton when viewing someone else's profile", () => {
    render(
      <ProfileActionButton {...baseProps} viewerId="me" isFollowing={true} />,
    );
    const follow = screen.getByTestId("follow-button");
    expect(follow).toBeInTheDocument();
    expect(follow).toHaveAttribute("data-profile-user-id", "author-1");
  });

  it("renders an anonymous redirect-to-login Follow button when not authenticated", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/u/author-1?view=about#follow");
    render(<ProfileActionButton {...baseProps} />);

    const button = screen.getByRole("button", { name: /follow/i });
    expect(button).toBeInTheDocument();
    await user.click(button);
    expect(pushMock).toHaveBeenCalledWith(
      "/auth/login?returnTo=%2Fu%2Fauthor-1%3Fview%3Dabout%23follow",
    );
  });

  it("does not render an Edit Profile link for an anonymous viewer", () => {
    render(<ProfileActionButton {...baseProps} />);
    expect(
      screen.queryByRole("link", { name: /edit profile/i }),
    ).not.toBeInTheDocument();
  });
});
