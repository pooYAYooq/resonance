import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { UserAvatar } from "./UserAvatar";
import { hashUserId } from "@/lib/avatar";

vi.mock("../ui/avatar", () => ({
  Avatar: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  AvatarImage: ({ src, alt }: { src: string; alt: string }) => (
    <div data-src={src} data-alt={alt} role="img" aria-label={alt} />
  ),
  AvatarFallback: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

describe("UserAvatar", () => {
  it("renders the hashed seed in the image src", () => {
    render(<UserAvatar userId="user-123" name="Jane Doe" />);

    const img = screen.getByRole("img", { name: "Jane Doe avatar" });
    const expectedSeed = hashUserId("user-123");
    expect(img).toHaveAttribute(
      "data-src",
      `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(
        expectedSeed,
      )}&scale=90`,
    );
  });

  it("does not include the raw userId in the image src", () => {
    render(<UserAvatar userId="raw-internal-id" name="Jane Doe" />);

    const img = screen.getByRole("img", { name: "Jane Doe avatar" });
    expect(img.getAttribute("data-src")).not.toContain("raw-internal-id");
  });

  it("renders fallback initials immediately in jsdom", () => {
    const { container } = render(
      <UserAvatar userId="user-123" name="Jane Doe" />,
    );

    expect(container).toHaveTextContent("JA");
  });

  it("uses the first two characters of the name in uppercase for initials", () => {
    const { container } = render(
      <UserAvatar userId="user-789" name="alice" />,
    );

    expect(container).toHaveTextContent("AL");
  });

  it("handles single-character names gracefully", () => {
    const { container } = render(
      <UserAvatar userId="user-000" name="B" />,
    );

    expect(container).toHaveTextContent("B");
  });

  it("renders '?' fallback for empty string names", () => {
    const { container } = render(<UserAvatar userId="user-empty" name="" />);

    expect(container).toHaveTextContent("?");
  });

  it("renders '?' fallback for whitespace-only names", () => {
    const { container } = render(
      <UserAvatar userId="user-space" name="   " />,
    );

    expect(container).toHaveTextContent("?");
  });

  it("applies the provided className to the Avatar wrapper", () => {
    const { container } = render(
      <UserAvatar userId="user-abc" name="Test" className="size-10 custom" />,
    );

    const avatarRoot = container.querySelector(".size-10");
    expect(avatarRoot).toBeInTheDocument();
    expect(avatarRoot).toHaveClass("custom");
  });

  it("uses generic alt text when name is empty", () => {
    render(<UserAvatar userId="user-empty" name="" />);

    const img = screen.getByRole("img", { name: "User avatar" });
    expect(img).toBeInTheDocument();
  });
});
