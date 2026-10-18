import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CountryPicker } from "./CountryPicker";

function Harness({
  initial = null,
  onChange,
}: {
  initial?: string | null;
  onChange?: (value: string | null) => void;
}) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <CountryPicker
      id="country"
      label="Location"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe("CountryPicker", () => {
  it.each([false, true])(
    "ignores composing Enter with an active option: %s",
    async (activeOption) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Harness onChange={onChange} />);
      const trigger = screen.getByLabelText("Location");
      await user.click(trigger);
      const search = screen.getByRole("combobox", { name: "Search location" });
      await user.type(search, "Japan");
      if (activeOption) await user.keyboard("{ArrowDown}");

      const composingEnter = createEvent.keyDown(search, {
        key: "Enter",
        isComposing: true,
        cancelable: true,
      });
      fireEvent(search, composingEnter);
      expect(composingEnter.defaultPrevented).toBe(false);
      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByRole("listbox")).toBeVisible();
      expect(search).toHaveFocus();

      await user.keyboard("{Enter}");
      expect(onChange).toHaveBeenCalledExactlyOnceWith("JP");
      expect(trigger).toHaveAccessibleName("Location: Japan");
      expect(trigger).toHaveFocus();
      expect(screen.queryByRole("listbox")).toBeNull();
    },
  );

  it.each([
    ["FI", "Finland", "fi-fi"],
    ["IN", "India", "fi-in"],
  ])(
    "uses ASCII flag classes for %s in a Turkish locale",
    async (code, name, flagClass) => {
      const user = userEvent.setup();
      const original = String.prototype.toLocaleLowerCase;
      const casing = vi
        .spyOn(String.prototype, "toLocaleLowerCase")
        .mockImplementation(function (
          this: string,
          locales?: Intl.LocalesArgument,
        ) {
          return original.call(this, locales ?? "tr");
        });
      try {
        render(<Harness initial={code} />);
        const trigger = screen.getByLabelText("Location");
        expect(trigger.querySelector(".fi")).toHaveClass(flagClass);
        await user.click(trigger);
        const option = screen.getByRole("option", { name });
        expect(option.querySelector(".fi")).toHaveClass(flagClass);
        expect(option).toHaveAttribute("aria-selected", "true");
      } finally {
        casing.mockRestore();
      }
    },
  );

  it.each([
    ["india", "India"],
    ["iran", "Iran"],
    ["italy", "Italy"],
    ["BRITAIN", "United Kingdom"],
  ])("finds and selects %s in a Turkish locale", async (query, name) => {
    const user = userEvent.setup();
    const original = String.prototype.toLocaleLowerCase;
    const casing = vi
      .spyOn(String.prototype, "toLocaleLowerCase")
      .mockImplementation(function (
        this: string,
        locales?: Intl.LocalesArgument,
      ) {
        return original.call(this, locales ?? "tr");
      });
    try {
      render(<Harness />);
      const trigger = screen.getByLabelText("Location");
      await user.click(trigger);
      await user.type(
        screen.getByRole("combobox", { name: "Search location" }),
        query,
      );
      expect(screen.getByRole("option", { name })).toBeVisible();
      await user.keyboard("{ArrowDown}{Enter}");
      expect(trigger).toHaveTextContent(name);
      expect(trigger).toHaveFocus();
      await user.click(trigger);
      expect(screen.getByRole("option", { name })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    } finally {
      casing.mockRestore();
    }
  });

  it("exposes the selected country in the closed trigger's accessible name", () => {
    render(
      <CountryPicker
        id="country"
        label="Country"
        value="GB"
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("button")).toHaveAccessibleName(
      "Country: United Kingdom",
    );
  });

  it("announces the empty value after keyboard clearing", async () => {
    const user = userEvent.setup();
    render(<Harness initial="JP" />);
    const trigger = screen.getByRole("button");
    expect(trigger).toHaveAccessibleName("Location: Japan");
    trigger.focus();
    await user.keyboard("{Enter}{ArrowDown}{Enter}");
    expect(trigger).toHaveAccessibleName("Location: No country selected");
    expect(trigger).toHaveFocus();
  });
  it.each([
    ["BO", "Bolivia"],
    ["KP", "North Korea"],
    ["KR", "South Korea"],
    ["LA", "Laos"],
    ["FM", "Micronesia"],
    ["MD", "Moldova"],
    ["NL", "Netherlands"],
    ["RU", "Russia"],
    ["TW", "Taiwan"],
    ["TR", "Turkey"],
    ["GB", "United Kingdom"],
    ["US", "United States"],
    ["VA", "Vatican City"],
    ["VE", "Venezuela"],
    ["VN", "Vietnam"],
  ])(
    "finds and keyboard-selects %s by its common name %s",
    async (code, name) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <CountryPicker
          id="country"
          label="Country"
          value={null}
          onChange={onChange}
        />,
      );
      await user.click(screen.getByLabelText("Country"));
      await user.type(
        screen.getByRole("combobox", { name: "Search country" }),
        name.toUpperCase(),
      );
      expect(screen.getByRole("option", { name })).toBeVisible();
      await user.keyboard("{ArrowDown}{Enter}");
      expect(onChange).toHaveBeenCalledWith(code);
    },
  );

  it.each([
    ["UK", "United Kingdom"],
    ["Britain", "United Kingdom"],
    ["USA", "United States"],
    ["America", "United States"],
    ["Czech Republic", "Czechia"],
    ["Burma", "Myanmar"],
    ["Persia", "Iran"],
    ["East Timor", "Timor-Leste"],
    ["Türkiye", "Turkey"],
  ])("matches search %s to country %s", async (query, name) => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByLabelText("Location"));
    await user.type(
      screen.getByRole("combobox", { name: "Search location" }),
      query,
    );
    expect(screen.getByRole("option", { name })).toBeVisible();
  });
  it("exposes a closed select button with its visible label and open indicator", () => {
    render(<Harness />);

    const trigger = screen.getByLabelText("Location");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
    expect(trigger.querySelector("svg")).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("toggles the country options open and closed from the select button", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const trigger = screen.getByLabelText("Location");
    await user.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.click(trigger);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("filters options by name and selects one with the keyboard", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByLabelText("Location"));
    const search = screen.getByRole("combobox", { name: "Search location" });
    expect(search).toHaveFocus();
    await user.type(search, "japan");

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Japan");
    expect(screen.getByRole("listbox").parentElement).toHaveClass(
      "absolute",
      "top-full",
      "z-50",
    );
    expect(screen.queryByRole("option", { name: /france/i })).toBeNull();

    await user.keyboard("{ArrowDown}{Enter}");

    expect(screen.getByLabelText("Location")).toHaveTextContent("Japan");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("moves through options with the arrow keys before selecting", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByLabelText("Location"));
    const search = screen.getByRole("combobox", { name: "Search location" });
    await user.type(search, "united");

    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThan(1);
    const secondName = options[1].textContent ?? "";

    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(screen.getByLabelText("Location")).toHaveTextContent(secondName);
  });

  it("closes on Escape and keeps the current selection", async () => {
    const user = userEvent.setup();
    render(<Harness initial="FR" />);

    const trigger = screen.getByLabelText("Location");
    expect(trigger).toHaveTextContent("France");

    await user.click(trigger);
    await user.type(
      screen.getByRole("combobox", { name: "Search location" }),
      "zzz",
    );
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveTextContent("France");
    expect(trigger).toHaveFocus();
  });

  it("clears a chosen country through No country and restores trigger focus", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="JP" onChange={onChange} />);

    const trigger = screen.getByLabelText("Location");
    expect(screen.queryByRole("button", { name: /clear country/i })).toBeNull();
    await user.click(trigger);
    const clear = screen.getByRole("option", { name: "No country" });
    expect(clear).toHaveAttribute("aria-selected", "false");
    await user.click(clear);

    expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
    expect(trigger).toHaveTextContent("Choose a country");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("keeps No country as the first browsing option and hides it during search", async () => {
    const user = userEvent.setup();
    render(<Harness initial="JP" />);
    await user.click(screen.getByLabelText("Location"));
    expect(screen.getAllByRole("option")[0]).toHaveAccessibleName("No country");
    const search = screen.getByRole("combobox", { name: "Search location" });
    await user.type(search, "France");
    expect(screen.queryByRole("option", { name: "No country" })).toBeNull();
    expect(screen.getAllByRole("option")).toHaveLength(1);
    await user.clear(search);
    expect(screen.getAllByRole("option")[0]).toHaveAccessibleName("No country");
    await user.type(search, "France");
    await user.keyboard("{Enter}");
    expect(screen.getByLabelText("Location")).toHaveTextContent("France");
  });

  it("clears the selection with ArrowDown and Enter without submitting the form", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const onChange = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <Harness initial="JP" onChange={onChange} />
      </form>,
    );
    const trigger = screen.getByLabelText("Location");
    trigger.focus();
    await user.keyboard("{Enter}{ArrowDown}");
    expect(
      screen.getByRole("combobox", { name: "Search location" }),
    ).toHaveAttribute("aria-activedescendant", "country-option-none");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveTextContent("Choose a country");
    await user.keyboard("{Enter}");
    expect(screen.getByRole("option", { name: "No country" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("renders the complete long selected name and matching selected option", async () => {
    const user = userEvent.setup();
    render(<Harness initial="VC" />);
    const trigger = screen.getByLabelText("Location");
    expect(trigger).toHaveTextContent("Saint Vincent and the Grenadines");
    await user.click(trigger);
    expect(
      screen.getByRole("option", {
        name: "Saint Vincent and the Grenadines",
      }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("scrolls the keyboard-active country into view without moving search focus", async () => {
    const user = userEvent.setup();
    const scroll = vi.fn();
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scroll;
    try {
      render(<Harness />);
      await user.click(screen.getByLabelText("Location"));
      await user.keyboard("{ArrowDown>20/}");
      const search = screen.getByRole("combobox", { name: "Search location" });
      expect(search).toHaveFocus();
      expect(scroll).toHaveBeenCalledWith({ block: "nearest" });
      expect(scroll.mock.instances.at(-1)).toBe(
        document.getElementById(search.getAttribute("aria-activedescendant")!),
      );
    } finally {
      HTMLElement.prototype.scrollIntoView = original;
    }
  });

  it("does not submit the surrounding form on Enter while the list is open", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const onChange = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <CountryPicker
          id="country"
          label="Location"
          value={null}
          onChange={onChange}
        />
      </form>,
    );

    await user.click(screen.getByLabelText("Location"));
    await user.type(
      screen.getByRole("combobox", { name: "Search location" }),
      "japan",
    );
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith("JP");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("reports no matches without persisting anything", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CountryPicker
        id="country"
        label="Location"
        value={null}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByLabelText("Location"));
    await user.type(
      screen.getByRole("combobox", { name: "Search location" }),
      "notacountry",
    );

    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText(/no countries match/i)).toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });
});
