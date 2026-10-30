import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ScrollbarBehavior } from "./ScrollbarBehavior";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("tracks viewport and panel scrolling independently and cleans up", () => {
  vi.useFakeTimers();
  vi.stubGlobal("CSS", { ...CSS, supports: () => true });
  const { unmount } = render(<ScrollbarBehavior />);
  const panel = document.createElement("div");
  panel.style.setProperty("overflow-x", "auto", "important");
  panel.style.setProperty("overflow-y", "scroll");
  document.body.append(panel);
  fireEvent.scroll(document);
  fireEvent.scroll(panel);
  expect(document.documentElement).toHaveAttribute("data-scrollbar-scrolling");
  expect(panel).toHaveAttribute("data-scrollbar-scrolling");
  fireEvent(panel, new Event("scrollend"));
  act(() => vi.advanceTimersByTime(150));
  expect(panel).not.toHaveAttribute("data-scrollbar-scrolling");
  expect(panel).toHaveAttribute("data-scrollbar-hover-suppressed");
  expect(panel.style.getPropertyValue("overflow-x")).toBe("auto");
  expect(panel.style.getPropertyPriority("overflow-x")).toBe("important");
  expect(panel.style.getPropertyValue("overflow-y")).toBe("scroll");
  fireEvent.pointerMove(panel, { buttons: 0 });
  expect(panel).not.toHaveAttribute("data-scrollbar-hover-suppressed");
  unmount();
  expect(document.documentElement).not.toHaveAttribute(
    "data-scrollbar-scrolling",
  );
  panel.remove();
});
