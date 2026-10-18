/**
 * Component tests for `AuthorJoinedDate`.
 *
 * The label is derived on the client from one server-provided `initialNow`, so
 * these tests pin the hydration boundary (server HTML must match the first
 * client render), the mount refresh, the visible-tab minute timer, the hidden
 * suppression, and cleanup.
 */

import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { AuthorJoinedDate } from "./AuthorJoinedDate";

const DAY_MS = 24 * 60 * 60 * 1000;
const JOINED_AT = Date.UTC(2024, 2, 5);
const MINUTE_MS = 60_000;

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

function fireVisibilityChange() {
  document.dispatchEvent(new Event("visibilitychange"));
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete (document as unknown as Record<string, unknown>).visibilityState;
});

describe("AuthorJoinedDate", () => {
  it("hydrates across a date threshold without a mismatch and refreshes on mount", async () => {
    const initialNow = JOINED_AT + MINUTE_MS;
    const mountNow = JOINED_AT + 2 * DAY_MS;

    const html = renderToString(
      <AuthorJoinedDate
        joinedAt={JOINED_AT}
        display="relative"
        initialNow={initialNow}
      />,
    );
    expect(html).toContain("Joined recently");

    vi.spyOn(Date, "now").mockReturnValue(mountNow);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);

    // `hydrateRoot` is used directly (outside `@testing-library/react`), so the
    // act environment flag it normally sets must be set here.
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;

    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(
          container,
          <AuthorJoinedDate
            joinedAt={JOINED_AT}
            display="relative"
            initialNow={initialNow}
          />,
        );
      });

      expect(consoleError).not.toHaveBeenCalled();
      expect(container.textContent).toBe("Joined 2 days ago");
    } finally {
      if (root) act(() => root!.unmount());
      container.remove();
    }
  });

  it("refreshes at most once a minute while visible and suppresses hidden ticks", () => {
    vi.useFakeTimers();
    vi.setSystemTime(JOINED_AT + MINUTE_MS);
    setVisibility("visible");

    render(
      <AuthorJoinedDate
        joinedAt={JOINED_AT}
        display="relative"
        initialNow={JOINED_AT + MINUTE_MS}
      />,
    );
    expect(screen.getByText("Joined recently")).toBeInTheDocument();

    act(() => {
      vi.setSystemTime(JOINED_AT + 2 * DAY_MS);
      vi.advanceTimersByTime(MINUTE_MS);
    });
    expect(screen.getByText("Joined 2 days ago")).toBeInTheDocument();

    act(() => {
      setVisibility("hidden");
      fireVisibilityChange();
      vi.setSystemTime(JOINED_AT + 5 * DAY_MS);
      vi.advanceTimersByTime(5 * MINUTE_MS);
    });
    expect(screen.getByText("Joined 2 days ago")).toBeInTheDocument();

    act(() => {
      setVisibility("visible");
      fireVisibilityChange();
    });
    expect(screen.getByText("Joined 5 days ago")).toBeInTheDocument();
  });

  it("clears the minute timer on unmount", () => {
    vi.useFakeTimers();
    vi.setSystemTime(JOINED_AT + MINUTE_MS);
    setVisibility("visible");

    const { unmount } = render(
      <AuthorJoinedDate
        joinedAt={JOINED_AT}
        display="relative"
        initialNow={JOINED_AT + MINUTE_MS}
      />,
    );
    const clearInterval = vi.spyOn(globalThis, "clearInterval");
    unmount();
    expect(clearInterval).toHaveBeenCalled();
  });

  it("renders the calendar month and year when the author prefers it", () => {
    render(
      <AuthorJoinedDate
        joinedAt={JOINED_AT}
        display="calendar"
        initialNow={JOINED_AT + 2 * DAY_MS}
      />,
    );
    expect(screen.getByText("Joined March 2024")).toBeInTheDocument();
  });

  it("renders no label when joinedAt is null", () => {
    const { container } = render(
      <AuthorJoinedDate
        joinedAt={null}
        display="relative"
        initialNow={JOINED_AT}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
