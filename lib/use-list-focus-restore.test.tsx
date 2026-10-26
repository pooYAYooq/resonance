import { useRef } from "react";
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
