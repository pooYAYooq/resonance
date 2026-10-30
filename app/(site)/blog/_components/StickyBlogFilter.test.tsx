import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StickyBlogFilter } from "./StickyBlogFilter";

function mockMatchMedia(matches: boolean) {
  const media = {
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("matchMedia", () => media as unknown as MediaQueryList);
  return media;
}

function renderFilter(matches: boolean) {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const nav = document.createElement("nav");
  document.body.appendChild(nav);
  vi.spyOn(nav, "getBoundingClientRect").mockReturnValue({
    height: 57,
  } as DOMRect);
  mockMatchMedia(matches);
  const view = render(
    <StickyBlogFilter>
      <div>Filter</div>
    </StickyBlogFilter>,
  );
  return { nav, view };
}

describe("StickyBlogFilter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("tucks the filter one pixel under the navbar and keeps the navbar border", () => {
    const { nav } = renderFilter(false);

    expect(screen.getByTestId("blog-filter-sticky").style.top).toBe("56px");
    expect(nav.style.position).not.toBe("static");
    expect(nav.style.borderBottomColor).toBe("");
  });

  it("makes the navbar static and pins the filter at the top in short landscape", () => {
    const { nav } = renderFilter(true);

    expect(screen.getByTestId("blog-filter-sticky").style.top).toBe("0px");
    expect(nav.style.position).toBe("static");
  });

  it("restores the navbar position when unmounted", () => {
    const { nav, view } = renderFilter(true);
    view.unmount();

    expect(nav.style.position).toBe("");
  });
});
