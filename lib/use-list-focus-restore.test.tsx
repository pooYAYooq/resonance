import { useRef } from "react";
import Link from "next/link";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useListFocusRestore } from "./use-list-focus-restore";

function ResponsiveList({
  ids,
  loadMore = false,
}: {
  ids: string[];
  loadMore?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  useListFocusRestore(root, "article", false);
  return (
    <div ref={root}>
      {ids.map((id) => (
        <article key={id}>
          <div style={{ display: "none" }}>
            <a href={`#${id}`}>Mobile {id}</a>
          </div>
          <div>
            <a href={`#${id}`}>Desktop {id}</a>
            <button>Delete {id}</button>
          </div>
        </article>
      ))}
      {loadMore && <button>Load more</button>}
    </div>
  );
}

function GroupedList({
  groups,
  recovery = false,
}: {
  groups: { key: string; ids: string[]; collapsed?: boolean }[];
  recovery?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  useListFocusRestore(root, "article", false, "[data-list-header]");
  return (
    <div ref={root}>
      {groups.map((group) => (
        <section key={group.key}>
          <h2>
            <button type="button" data-list-header>
              {group.key}
            </button>
          </h2>
          <div hidden={group.collapsed}>
            {group.ids.map((id) => (
              <article key={id}>
                <a href={`#${id}`}>Read {id}</a>
                <button type="button">Delete {id}</button>
              </article>
            ))}
          </div>
        </section>
      ))}
      {recovery && <Link href="/blog">Explore Discover</Link>}
    </div>
  );
}

describe("list focus restoration with responsive layouts", () => {
  it.each([
    { removed: "first", remaining: "second" },
    { removed: "second", remaining: "first" },
  ])(
    "focuses a visible control after removing $removed",
    ({ removed, remaining }) => {
      const view = render(<ResponsiveList ids={["first", "second"]} />);
      screen.getByRole("button", { name: `Delete ${removed}` }).focus();

      view.rerender(<ResponsiveList ids={[remaining]} />);

      expect(
        screen.getByRole("link", { name: `Desktop ${remaining}` }),
      ).toHaveFocus();
    },
  );

  it("focuses a visible control in the first appended item", () => {
    const view = render(<ResponsiveList ids={["first"]} loadMore />);
    screen.getByRole("button", { name: "Load more" }).focus();

    view.rerender(<ResponsiveList ids={["first", "second"]} />);

    expect(screen.getByRole("link", { name: "Desktop second" })).toHaveFocus();
  });

  it("focuses a visible surviving control when pagination adds no item", () => {
    const view = render(<ResponsiveList ids={["first"]} loadMore />);
    screen.getByRole("button", { name: "Load more" }).focus();

    view.rerender(<ResponsiveList ids={["first"]} />);

    expect(screen.getByRole("link", { name: "Desktop first" })).toHaveFocus();
  });
});

describe("list focus restoration with collapsed groups", () => {
  it("skips hidden cards and focuses the next visible card", () => {
    const view = render(
      <GroupedList
        groups={[
          { key: "Today", ids: ["today"] },
          { key: "Yesterday", ids: ["yesterday"], collapsed: true },
          { key: "Earlier", ids: ["earlier"] },
        ]}
      />,
    );
    screen.getByRole("button", { name: "Delete today" }).focus();

    view.rerender(
      <GroupedList
        groups={[
          { key: "Yesterday", ids: ["yesterday"], collapsed: true },
          { key: "Earlier", ids: ["earlier"] },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: "Read earlier" })).toHaveFocus();
  });

  it("falls back to a visible recovery action when every card is hidden", () => {
    const view = render(
      <GroupedList
        groups={[
          { key: "Today", ids: ["today"] },
          { key: "Yesterday", ids: ["yesterday"], collapsed: true },
        ]}
        recovery
      />,
    );
    screen.getByRole("button", { name: "Delete today" }).focus();

    view.rerender(
      <GroupedList
        groups={[{ key: "Yesterday", ids: ["yesterday"], collapsed: true }]}
        recovery
      />,
    );

    expect(
      screen.getByRole("link", { name: "Explore Discover" }),
    ).toHaveFocus();
    expect(document.body).not.toHaveFocus();
  });

  it("falls back to a visible group heading when no card or recovery remains", () => {
    const view = render(
      <GroupedList
        groups={[
          { key: "Today", ids: ["today"] },
          { key: "Yesterday", ids: ["yesterday"], collapsed: true },
        ]}
      />,
    );
    screen.getByRole("button", { name: "Delete today" }).focus();

    view.rerender(
      <GroupedList
        groups={[{ key: "Yesterday", ids: ["yesterday"], collapsed: true }]}
      />,
    );

    expect(screen.getByRole("button", { name: "Yesterday" })).toHaveFocus();
  });

  it("records card positions among visible cards only", () => {
    const view = render(
      <GroupedList
        groups={[
          { key: "Earlier", ids: ["hidden"], collapsed: true },
          { key: "Today", ids: ["first", "second", "third"] },
        ]}
      />,
    );
    screen.getByRole("button", { name: "Delete first" }).focus();

    view.rerender(
      <GroupedList
        groups={[
          { key: "Earlier", ids: ["hidden"], collapsed: true },
          { key: "Today", ids: ["second", "third"] },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: "Read second" })).toHaveFocus();
  });
});
