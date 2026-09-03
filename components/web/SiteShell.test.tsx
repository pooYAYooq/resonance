import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./Navbar", () => ({ Navbar: () => <nav>Navbar</nav> }));
vi.mock("./Footer", () => ({
  Footer: ({ variant }: { variant: string }) => (
    <footer>{variant} footer</footer>
  ),
}));

import { SiteShell } from "./SiteShell";

describe("SiteShell", () => {
  it("uses the compact footer for site pages", () => {
    render(<SiteShell footer="compact">Site content</SiteShell>);

    expect(screen.getByText("compact footer")).toBeInTheDocument();
  });

  it("uses the fuller footer for marketing Home", () => {
    render(<SiteShell footer="marketing">Marketing content</SiteShell>);

    expect(screen.getByText("marketing footer")).toBeInTheDocument();
  });
});
