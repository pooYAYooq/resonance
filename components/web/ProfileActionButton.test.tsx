/**
 * Component tests for `ProfileActionButton`.
 *
 * Renders one of three states based on `getCurrentUser`:
 *  - own profile → Edit Profile link
 *  - someone else → `FollowButton`
 *  - anonymous (null) → redirect-to-login "Follow" button
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { useQueryMock, pushMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: () => useQueryMock(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    users: { getCurrentUser: "getCurrentUser" },
  },
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

const baseProps = { profileUserId: "author-1", authorName: "Ada" };

describe("ProfileActionButton", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    pushMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing while getCurrentUser is loading", () => {
    useQueryMock.mockReturnValue(undefined);
    const { container } = render(<ProfileActionButton {...baseProps} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the Edit Profile link on the viewer's own profile", () => {
    useQueryMock.mockReturnValue({ userId: "author-1", displayName: "Ada" });
    render(<ProfileActionButton {...baseProps} />);
    const editLink = screen.getByRole("link", { name: /edit profile/i });
    expect(editLink).toBeInTheDocument();
    expect(editLink).toHaveAttribute("href", "/settings");
  });

  it("renders FollowButton when viewing someone else's profile", () => {
    useQueryMock.mockReturnValue({ userId: "me", displayName: "Me" });
    render(<ProfileActionButton {...baseProps} />);
    const follow = screen.getByTestId("follow-button");
    expect(follow).toBeInTheDocument();
    expect(follow).toHaveAttribute("data-profile-user-id", "author-1");
  });

  it("renders an anonymous redirect-to-login Follow button when not authenticated", async () => {
    const user = userEvent.setup();
    useQueryMock.mockReturnValue(null);
    render(<ProfileActionButton {...baseProps} />);

    const button = screen.getByRole("button", { name: /follow/i });
    expect(button).toBeInTheDocument();
    await user.click(button);
    expect(pushMock).toHaveBeenCalledWith("/auth/login");
  });

  it("does not render an Edit Profile link for an anonymous viewer", () => {
    useQueryMock.mockReturnValue(null);
    render(<ProfileActionButton {...baseProps} />);
    expect(
      screen.queryByRole("link", { name: /edit profile/i }),
    ).not.toBeInTheDocument();
  });
});