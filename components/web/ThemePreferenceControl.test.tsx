import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemePreferenceControl } from "./ThemePreferenceControl";

const { themeState, setThemeMock } = vi.hoisted(() => ({
  themeState: { theme: "system", resolvedTheme: "dark" },
  setThemeMock: vi.fn(),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ ...themeState, setTheme: setThemeMock }),
}));

describe("ThemePreferenceControl", () => {
  it("selects the stored system preference even when dark is resolved", () => {
    render(<ThemePreferenceControl />);

    expect(screen.getByLabelText(/appearance/i)).toHaveValue("system");
  });

  it("offers all approved themes and updates the stored preference", async () => {
    const user = userEvent.setup();
    render(<ThemePreferenceControl />);

    expect(screen.getByRole("option", { name: "Light" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Dark" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "System" })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/appearance/i), "light");
    expect(setThemeMock).toHaveBeenCalledWith("light");
  });
});
