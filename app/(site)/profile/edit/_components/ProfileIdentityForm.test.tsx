import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  act,
  render,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import type { IdentityInput } from "@/lib/profile-identity";
import { ProfileIdentityForm } from "./ProfileIdentityForm";

const { updateIdentityMock, toastSuccessMock, toastErrorMock } = vi.hoisted(
  () => ({
    updateIdentityMock: vi.fn(),
    toastSuccessMock: vi.fn(),
    toastErrorMock: vi.fn(),
  }),
);

vi.mock("convex/react", () => ({
  useMutation: () => updateIdentityMock,
}));

vi.mock("@/convex/_generated/api", () => ({
  api: { profiles: { updateIdentity: "updateIdentity" } },
}));

vi.mock("sonner", () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}));

const savedIdentity: IdentityInput = {
  displayName: "Ada Lovelace",
  bio: "Initial bio.",
  countryCode: "GB",
  socialProfiles: { instagram: "https://instagram.com/ada" },
  joinDateDisplay: "calendar",
};

function ProfileIdentityHarness({
  revision = 0,
  identity = savedIdentity,
}: {
  revision?: number;
  identity?: IdentityInput;
}) {
  const [saveRequest, setSaveRequest] = useState(0);
  const requestSave = () => setSaveRequest((request) => request + 1);

  return (
    <>
      <button type="button" onClick={requestSave}>
        Save profile details
      </button>
      <ProfileIdentityForm
        userId="auth-user-1"
        email="ada@example.com"
        avatarUrl="https://example.com/ada.png"
        initialIdentity={identity}
        revision={revision}
        saveRequest={saveRequest}
        onSaveRequest={requestSave}
        onSaveStateChange={() => {}}
      />
    </>
  );
}

function renderForm(
  overrides: { revision?: number; identity?: IdentityInput } = {},
) {
  return render(<ProfileIdentityHarness {...overrides} />);
}

describe("ProfileIdentityForm", () => {
  it("preserves a newer revert to the baseline when the save query echoes first", async () => {
    const user = userEvent.setup();
    let resolveSave!: (value: { kind: "saved"; revision: number }) => void;
    updateIdentityMock.mockImplementation(
      () => new Promise((resolve) => (resolveSave = resolve)),
    );
    const { rerender } = renderForm();
    await user.clear(screen.getByLabelText("Bio"));
    await user.type(screen.getByLabelText("Bio"), "Submitted");
    await user.click(
      screen.getByRole("button", { name: "Save profile details" }),
    );
    await user.clear(screen.getByLabelText("Bio"));
    await user.type(screen.getByLabelText("Bio"), "Initial bio.");
    rerender(
      <ProfileIdentityHarness
        revision={1}
        identity={{ ...savedIdentity, bio: "Submitted" }}
      />,
    );
    expect(screen.getByLabelText("Bio")).toHaveValue("Initial bio.");
    await act(async () => resolveSave({ kind: "saved", revision: 1 }));
    expect(screen.getByLabelText("Bio")).toHaveValue("Initial bio.");
    expect(screen.queryByText(/another version/i)).not.toBeInTheDocument();
  });
  it("shows the signed-in account email in the avatar section", () => {
    renderForm();

    const signedInEmail = screen.getByText("Signed in as ada@example.com");
    const avatarSection = signedInEmail.parentElement;

    expect(
      screen.queryByText(
        "Your avatar uses the photo from your sign-in account, if available.",
      ),
    ).not.toBeInTheDocument();
    expect(avatarSection?.querySelector('[data-slot="avatar"]')).not.toBeNull();
  });

  it("offers Country without a separate Location field or automatic saving", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.queryByRole("textbox", { name: "Location" })).toBeNull();
    const country = screen.getByLabelText("Country");
    await user.click(country);
    await user.type(
      screen.getByRole("combobox", { name: "Search country" }),
      "Japan",
    );
    await user.keyboard("{ArrowDown}{Enter}");
    expect(country).toHaveTextContent("Japan");
    expect(updateIdentityMock).not.toHaveBeenCalled();
  });

  it("saves a cleared country as null only when Save is requested", async () => {
    const user = userEvent.setup();
    updateIdentityMock.mockResolvedValue({ kind: "saved", revision: 1 });
    renderForm();
    await user.click(screen.getByLabelText("Country"));
    await user.keyboard("{ArrowDown}{Enter}");
    expect(screen.getByLabelText("Country")).toHaveTextContent(
      "Choose a country",
    );
    expect(updateIdentityMock).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Save profile details" }),
    );
    await waitFor(() =>
      expect(updateIdentityMock).toHaveBeenCalledExactlyOnceWith({
        expectedRevision: 0,
        identity: { ...savedIdentity, countryCode: null },
      }),
    );
  });

  it("shows inline name-limit feedback at 31 code points without a permanent counter", () => {
    renderForm();
    const input = screen.getByRole("textbox", { name: "Display name" });
    expect(screen.queryByText(/\/ 100 characters/)).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "😀".repeat(31) } });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(
      "Use at most 30 characters. 31 of 30 characters",
    );
    expect(input).toHaveValue("😀".repeat(31));
    fireEvent.change(input, { target: { value: "😀".repeat(30) } });
    expect(input).not.toHaveAttribute("aria-invalid", "true");
    expect(
      screen.queryByText("Use at most 30 characters."),
    ).not.toBeInTheDocument();
  });

  it("removes a social link and returns keyboard focus to the add control", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(
      screen.getByRole("button", { name: "Remove Instagram link" }),
    );
    expect(
      screen.queryByRole("textbox", { name: "Instagram" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add social link" }),
    ).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Instagram link removed. Save your changes to update your profile.",
    );
  });

  it("keeps selected social links compact while retaining names in the add menu", async () => {
    const user = userEvent.setup();
    renderForm();

    const section = screen.getByRole("group", { name: "Social links" });
    const instagramInput = screen.getByRole("textbox", { name: "Instagram" });
    const instagramRow = instagramInput.closest('[data-slot="field"]');
    const addButton = screen.getByRole("button", { name: "Add social link" });

    expect(
      screen.queryByText("Help readers find you elsewhere."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Instagram", { exact: true }),
    ).not.toBeInTheDocument();
    expect(instagramRow).not.toHaveClass("border-b");
    expect(screen.getByText("Social links").nextElementSibling).toBe(addButton);

    await user.click(addButton);
    expect(
      screen.getByRole("menuitem", { name: "LinkedIn" }),
    ).toBeInTheDocument();
    expect(section).toContainElement(instagramInput);
  });

  it("adds a chosen platform with focus in its URL field and keeps other fields hidden", async () => {
    const user = userEvent.setup();
    renderForm();
    expect(
      screen.queryByRole("textbox", { name: "LinkedIn" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add social link" }));
    expect(
      screen.queryByRole("menuitem", { name: "Instagram" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "LinkedIn" }));
    const linkedInInput = screen.getByRole("textbox", { name: "LinkedIn" });
    expect(linkedInInput).toHaveFocus();
    expect(linkedInInput).toHaveAttribute(
      "placeholder",
      "https://linkedin.com/in/username",
    );
    expect(linkedInInput.parentElement).toHaveClass("flex");
    expect(linkedInInput.parentElement).toContainElement(
      screen.getByRole("button", { name: "Remove LinkedIn link" }),
    );
    expect(
      screen.queryByRole("textbox", { name: "Behance" }),
    ).not.toBeInTheDocument();
    expect(updateIdentityMock).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    updateIdentityMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
  });

  it("initializes every identity field from the saved record", () => {
    renderForm();

    expect(screen.getByLabelText(/display name/i)).toHaveValue("Ada Lovelace");
    expect(screen.getByLabelText(/bio/i)).toHaveValue("Initial bio.");
    expect(screen.getByLabelText("Country")).toHaveTextContent(
      "United Kingdom",
    );
    expect(screen.getByRole("textbox", { name: "Instagram" })).toHaveValue(
      "https://instagram.com/ada",
    );
  });

  it("counts bio code points rather than UTF-16 units", async () => {
    const user = userEvent.setup();
    renderForm();

    const bio = screen.getByLabelText(/bio/i);
    await user.clear(bio);
    await user.type(bio, "a\u{1F44D}");

    expect(screen.getByText(/2 \/ 1000 characters/i)).toBeInTheDocument();
  });

  it("submits the normalized identity, clearing optional values", async () => {
    const user = userEvent.setup();
    updateIdentityMock.mockResolvedValue({ kind: "saved", revision: 1 });
    renderForm();

    await user.click(screen.getByLabelText("Country"));
    await user.click(screen.getByRole("option", { name: "No country" }));
    await user.clear(screen.getByRole("textbox", { name: "Instagram" }));
    await user.click(
      screen.getByRole("button", { name: /save profile details/i }),
    );

    await waitFor(() => {
      expect(updateIdentityMock).toHaveBeenCalledWith({
        expectedRevision: 0,
        identity: {
          displayName: "Ada Lovelace",
          bio: "Initial bio.",
          countryCode: null,
          socialProfiles: {},
          joinDateDisplay: "calendar",
        },
      });
    });
  });

  it("attaches a structured server field error to the control and keeps input", async () => {
    const user = userEvent.setup();
    updateIdentityMock.mockRejectedValue({
      data: { field: "displayName", message: "Add a display name." },
    });
    renderForm();

    await user.clear(screen.getByLabelText(/display name/i));
    await user.type(screen.getByLabelText(/display name/i), "Ada L.");
    await user.click(
      screen.getByRole("button", { name: /save profile details/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("Add a display name.")).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/display name/i)).toHaveValue("Ada L.");
  });

  it("keeps typing that arrives while a save is in flight", async () => {
    const user = userEvent.setup();
    let resolveSave: (value: {
      kind: "saved";
      revision: number;
    }) => void = () => {};
    updateIdentityMock.mockImplementation(
      () => new Promise((resolve) => (resolveSave = resolve)),
    );
    renderForm();

    await user.type(screen.getByLabelText(/bio/i), " submitted");
    await user.click(
      screen.getByRole("button", { name: /save profile details/i }),
    );
    await user.type(screen.getByLabelText(/bio/i), " more");

    resolveSave({ kind: "saved", revision: 1 });

    await waitFor(() => {
      expect(screen.getByLabelText(/bio/i)).toHaveValue(
        "Initial bio. submitted more",
      );
    });
    expect(toastSuccessMock).toHaveBeenCalled();
  });

  it("flags a conflict from a stale save without clearing input", async () => {
    const user = userEvent.setup();
    updateIdentityMock.mockResolvedValue({ kind: "conflict" });
    renderForm();

    await user.type(screen.getByLabelText(/bio/i), " dirty");
    await user.click(
      screen.getByRole("button", { name: /save profile details/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/another version/i)).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /load saved version/i }),
    ).toBeEnabled();
    expect(screen.getByLabelText(/display name/i)).toHaveValue("Ada Lovelace");
  });

  it("does not overwrite dirty input when a newer revision arrives", () => {
    const { rerender } = renderForm();

    // user types before the live query advances
    const nameInput = screen.getByLabelText(/display name/i);
    fireEvent.change(nameInput, { target: { value: "Newer typing" } });

    rerender(
      <ProfileIdentityHarness
        identity={{ ...savedIdentity, displayName: "Other session" }}
        revision={1}
      />,
    );

    expect(screen.getByLabelText(/display name/i)).toHaveValue("Newer typing");
    expect(
      screen.getByRole("button", { name: /load saved version/i }),
    ).toBeInTheDocument();
  });

  it("adopts a clean external update", () => {
    const { rerender } = renderForm();

    rerender(
      <ProfileIdentityHarness
        identity={{ ...savedIdentity, displayName: "Updated elsewhere" }}
        revision={1}
      />,
    );

    expect(screen.getByLabelText(/display name/i)).toHaveValue(
      "Updated elsewhere",
    );
    expect(
      screen.queryByRole("button", { name: /load saved version/i }),
    ).not.toBeInTheDocument();
  });
});
