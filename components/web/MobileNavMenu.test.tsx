import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MobileNavMenu } from "./MobileNavMenu";

describe("MobileNavMenu", () => {
  it("exposes New Post, Discover, and Feed links for authenticated users", async () => {
    const user = userEvent.setup();

    render(<MobileNavMenu isAuthenticated />);
    await user.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );

    expect(screen.getByRole("menuitem", { name: "New Post" })).toHaveAttribute(
      "href",
      "/create",
    );
    expect(screen.getByRole("menuitem", { name: "Discover" })).toHaveAttribute(
      "href",
      "/blog",
    );
    expect(screen.getByRole("menuitem", { name: "Feed" })).toHaveAttribute(
      "href",
      "/feed",
    );
  });

  it("exposes Home, Discover, Log In, and Sign Up for anonymous users", async () => {
    const user = userEvent.setup();

    render(<MobileNavMenu isAuthenticated={false} />);
    await user.click(
      screen.getByRole("button", { name: "Open navigation menu" }),
    );

    expect(screen.queryByRole("menuitem", { name: "New Post" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Feed" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("menuitem", { name: "Discover" })).toHaveAttribute(
      "href",
      "/blog",
    );
    expect(screen.getByRole("menuitem", { name: "Log In" })).toHaveAttribute(
      "href",
      "/auth/login",
    );
    expect(screen.getByRole("menuitem", { name: "Sign Up" })).toHaveAttribute(
      "href",
      "/auth/sign-up",
    );
  });
});
