import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MobileNavMenu } from "./MobileNavMenu";

describe("MobileNavMenu", () => {
  it("exposes dashboard, New Post, discovery, and feed links", async () => {
    const user = userEvent.setup();

    render(<MobileNavMenu isAuthenticated />);
    await user.click(screen.getByRole("button", { name: "Open navigation menu" }));

    expect(screen.getByRole("menuitem", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByRole("menuitem", { name: "New Post" })).toHaveAttribute(
      "href",
      "/create",
    );
    expect(screen.getByRole("menuitem", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("menuitem", { name: "Blog" })).toHaveAttribute(
      "href",
      "/blog",
    );
    expect(screen.getByRole("menuitem", { name: "Feed" })).toHaveAttribute(
      "href",
      "/feed",
    );
  });

  it("hides authenticated-only links for anonymous users", async () => {
    const user = userEvent.setup();

    render(<MobileNavMenu isAuthenticated={false} />);
    await user.click(screen.getByRole("button", { name: "Open navigation menu" }));

    expect(screen.queryByRole("menuitem", { name: "Dashboard" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "New Post" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Feed" })).toBeNull();
  });
});
