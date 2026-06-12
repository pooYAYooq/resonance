/**
 * Component tests for the `ProfileHeader` composite.
 *
 * Verifies the avatar, name, bio, and optional right action render
 * correctly and that the bio is hidden when null, undefined, empty,
 * or whitespace-only. Asserts the post count is not rendered in the
 * header (it lives in the section heading on the consumer side).
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./UserAvatar", () => ({
  UserAvatar: ({
    userId,
    name,
    avatarUrl,
    className,
  }: {
    userId: string;
    name: string;
    avatarUrl?: string | null;
    className?: string;
  }) => (
    <div
      data-testid="user-avatar"
      data-user-id={userId}
      data-name={name}
      data-avatar-url={avatarUrl ?? ""}
      className={className}
    />
  ),
}));

import { ProfileHeader } from "./ProfileHeader";

describe("ProfileHeader", () => {
  it("renders the avatar via UserAvatar", () => {
    render(
      <ProfileHeader
        displayName="Ada Lovelace"
        avatarUrl="https://example.com/ada.png"
        userId="user-1"
      />,
    );
    const avatar = screen.getByTestId("user-avatar");
    expect(avatar).toHaveAttribute("data-user-id", "user-1");
    expect(avatar).toHaveAttribute("data-name", "Ada Lovelace");
    expect(avatar).toHaveAttribute(
      "data-avatar-url",
      "https://example.com/ada.png",
    );
  });

  it("renders the display name as an h1", () => {
    render(<ProfileHeader displayName="Ada Lovelace" userId="user-1" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Ada Lovelace" }),
    ).toBeInTheDocument();
  });

  it("renders the bio when provided and non-empty", () => {
    render(
      <ProfileHeader
        displayName="Ada Lovelace"
        userId="user-1"
        bio="Mathematician and writer."
      />,
    );
    expect(
      screen.getByText(/mathematician and writer/i),
    ).toBeInTheDocument();
  });

  it("hides the bio when bio is null", () => {
    const { container } = render(
      <ProfileHeader displayName="Ada Lovelace" userId="user-1" bio={null} />,
    );
    expect(screen.queryByText(/mathematician/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll("h1")).toHaveLength(1);
  });

  it("hides the bio when bio is undefined", () => {
    render(<ProfileHeader displayName="Ada Lovelace" userId="user-1" />);
    expect(screen.queryByText(/mathematician/i)).not.toBeInTheDocument();
  });

  it("hides the bio when bio is an empty string", () => {
    render(
      <ProfileHeader displayName="Ada Lovelace" userId="user-1" bio="" />,
    );
    expect(screen.queryByText(/mathematician/i)).not.toBeInTheDocument();
  });

  it("hides the bio when bio is whitespace-only", () => {
    render(
      <ProfileHeader displayName="Ada Lovelace" userId="user-1" bio="   " />,
    );
    expect(screen.queryByText(/mathematician/i)).not.toBeInTheDocument();
  });

  it("renders the right action when provided", () => {
    render(
      <ProfileHeader
        displayName="Ada Lovelace"
        userId="user-1"
        rightAction={<button type="button">Edit Profile</button>}
      />,
    );
    expect(
      screen.getByRole("button", { name: /edit profile/i }),
    ).toBeInTheDocument();
  });

  it("does not render the right action when omitted", () => {
    render(<ProfileHeader displayName="Ada Lovelace" userId="user-1" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("does not render any post count text", () => {
    const { container } = render(
      <ProfileHeader
        displayName="Ada Lovelace"
        userId="user-1"
        bio="Hi there."
      />,
    );
    expect(container.textContent).not.toMatch(/\d+\s*post/);
  });
});
