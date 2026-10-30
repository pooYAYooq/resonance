import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { ResultsAnchorScroll } from "./ResultsAnchorScroll";

describe("ResultsAnchorScroll", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("scrolls to the results header below the sticky controls", () => {
    window.history.replaceState(null, "", "#blog-results");
    const target = document.createElement("div");
    target.id = "blog-results";
    target.style.scrollMarginTop = "96px";
    document.body.appendChild(target);
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
      top: 500,
    } as DOMRect);
    const scrollTo = vi
      .spyOn(window, "scrollTo")
      .mockImplementation(() => undefined);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    render(<ResultsAnchorScroll modeKey="topic:Design" />);

    expect(scrollTo).toHaveBeenCalledWith({ top: 404, behavior: "auto" });
  });

  it("does nothing without the results hash", () => {
    window.history.replaceState(null, "", "/blog");
    const target = document.createElement("div");
    target.id = "blog-results";
    document.body.appendChild(target);
    const scrollTo = vi
      .spyOn(window, "scrollTo")
      .mockImplementation(() => undefined);

    render(<ResultsAnchorScroll modeKey="latest" />);

    expect(scrollTo).not.toHaveBeenCalled();
  });
});
