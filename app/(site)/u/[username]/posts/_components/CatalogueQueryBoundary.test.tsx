/**
 * Component tests for `CatalogueQueryBoundary`.
 *
 * A Convex query hook throws during render when its subscription fails, so the
 * catalogue needs a React error boundary above the paginated subtree: the
 * surrounding server-rendered header must keep its pixels and the reader must
 * get an explanation plus a Retry that restarts the subscription rather than a
 * blank page. These tests pin the recovery copy, the focus move into the
 * fallback, the refresh-mount semantics of Retry, and that a healthy subtree is
 * untouched.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect, useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CatalogueQueryBoundary } from "./CatalogueQueryBoundary";

describe("CatalogueQueryBoundary", () => {
  beforeEach(() => {
    // A caught render error is expected noise in these tests; React logs it.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders its children untouched when no error is thrown", () => {
    render(
      <CatalogueQueryBoundary>
        <p>Posts</p>
      </CatalogueQueryBoundary>,
    );

    expect(screen.getByText("Posts")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("explains a failed catalogue query and offers a Retry action", () => {
    function Bomb(): never {
      throw new Error("query failed");
    }

    render(
      <CatalogueQueryBoundary>
        <Bomb />
      </CatalogueQueryBoundary>,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/could not load/i);
    expect(alert).toHaveTextContent(/try again/i);
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("remounts the subtree on Retry so the failed subscription restarts", async () => {
    const user = userEvent.setup();

    let mounts = 0;
    let failing = true;

    function Flaky() {
      const [count, setCount] = useState(0);
      useEffect(() => {
        mounts += 1;
      }, []);
      if (failing) throw new Error("query failed");
      return (
        <button type="button" onClick={() => setCount((value) => value + 1)}>
          count {count}
        </button>
      );
    }

    const { rerender } = render(
      <CatalogueQueryBoundary>
        <Flaky />
      </CatalogueQueryBoundary>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(mounts).toBe(0);

    failing = false;
    await user.click(screen.getByRole("button", { name: /retry/i }));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "count 0" })).toBeInTheDocument();
    expect(mounts).toBe(1);

    // The recovery is a fresh mount of the same subtree, not a resumed one, so
    // a retried query starts from its first page again.
    rerender(
      <CatalogueQueryBoundary>
        <Flaky />
      </CatalogueQueryBoundary>,
    );
    expect(screen.getByRole("button", { name: "count 0" })).toBeInTheDocument();
    expect(mounts).toBe(1);
  });

  it("moves focus to Retry when an interaction in the subtree fails it", async () => {
    const user = userEvent.setup();

    function Gate({ fail }: { fail: boolean }) {
      if (fail) throw new Error("query failed");
      return <button type="button">Loaded page</button>;
    }

    const { rerender } = render(
      <CatalogueQueryBoundary>
        <Gate fail={false} />
      </CatalogueQueryBoundary>,
    );

    // A keyboard user is on the control whose activation triggers the failing
    // page request; the failure unmounts it along with the whole subtree.
    const trigger = screen.getByRole("button", { name: "Loaded page" });
    trigger.focus();
    expect(trigger).toHaveFocus();

    rerender(
      <CatalogueQueryBoundary>
        <Gate fail={true} />
      </CatalogueQueryBoundary>,
    );

    const retry = screen.getByRole("button", { name: /retry/i });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(retry).toHaveFocus();

    // Retry still remounts the subtree and returns the reader to working state.
    rerender(
      <CatalogueQueryBoundary>
        <Gate fail={false} />
      </CatalogueQueryBoundary>,
    );
    await user.click(retry);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Loaded page" }),
    ).toBeInTheDocument();
  });

  it("preserves focus on a surviving control outside the failed subtree", () => {
    function Gate({ fail }: { fail: boolean }) {
      if (fail) throw new Error("query failed");
      return <p>Posts</p>;
    }

    function Harness({ fail }: { fail: boolean }) {
      return (
        <div>
          <button type="button">Back to profile</button>
          <CatalogueQueryBoundary>
            <Gate fail={fail} />
          </CatalogueQueryBoundary>
        </div>
      );
    }

    const { rerender } = render(<Harness fail={false} />);

    // The reader has moved to an unaffected control outside the boundary before
    // the pending query fails, so it must keep focus rather than be stolen by
    // the fallback's Retry.
    const external = screen.getByRole("button", { name: "Back to profile" });
    external.focus();
    expect(external).toHaveFocus();

    rerender(<Harness fail={true} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(external).toHaveFocus();
  });

  it("keeps the surrounding author header when only the list subtree fails", () => {
    function Bomb(): never {
      throw new Error("query failed");
    }

    render(
      <div>
        <h1>Ada Lovelace</h1>
        <CatalogueQueryBoundary>
          <Bomb />
        </CatalogueQueryBoundary>
      </div>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Ada Lovelace" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
