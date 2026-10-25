import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  navigateFromNotification,
  positionNotificationDestination,
} from "./notification-navigation";
beforeEach(() => {
  vi.useFakeTimers();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("scrollTo", vi.fn());
  window.history.replaceState({}, "", "/blog");
  document.body.innerHTML = "<main>Source page</main>";
});
afterEach(() => {
  window.dispatchEvent(new PopStateEvent("popstate"));
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});
it("starts navigation immediately and never hides or scrolls the source", async () => {
  const navigate = vi.fn();
  navigateFromNotification("/blog/post1/comments/comment1", navigate);
  expect(navigate).toHaveBeenCalledOnce();
  expect(document.querySelector('[role="status"]')).toBeNull();
  await vi.advanceTimersByTimeAsync(160);
  expect(document.querySelector('[role="status"]')).toHaveTextContent(
    "Opening destination",
  );
  expect(document.querySelector("main")).toHaveTextContent("Source page");
  window.history.pushState({}, "", "/blog/post1/comments/comment1");
  document.querySelector("main")!.innerHTML =
    '<section data-notification-destination="/blog/post1/comments/comment1">Selected comment</section>';
  await Promise.resolve();
  expect(document.querySelector('[role="status"]')).toBeNull();
});
it("shows no loading indicator for a ready destination and cancels on Back", async () => {
  navigateFromNotification("/blog/post1/comments/comment1", () => {
    window.history.pushState({}, "", "/blog/post1/comments/comment1");
    document.querySelector("main")!.innerHTML =
      '<section data-notification-destination="/blog/post1/comments/comment1"></section>';
  });
  await vi.advanceTimersByTimeAsync(200);
  expect(document.querySelector('[role="status"]')).toBeNull();
  navigateFromNotification("/blog/post1/comments/comment2", () => {});
  window.dispatchEvent(new PopStateEvent("popstate"));
  await vi.advanceTimersByTimeAsync(200);
  expect(document.querySelector('[role="status"]')).toBeNull();
});

it("lands on the comment like button without starting a highlight sequence", () => {
  window.history.replaceState({}, "", "/blog/post1#comment-comment1-likes");
  document.body.innerHTML =
    '<div data-notification-destination="/blog/post1"><article id="comment-comment1"><span data-comment-likes><button>Like</button></span></article></div>';
  expect(positionNotificationDestination(new URL(location.href))).toBe(true);
  expect(document.activeElement?.textContent).toBe("Like");
});

it("positions a post-like destination and focuses its like button", () => {
  window.history.replaceState({}, "", "/blog/post1#post-likes");
  document.body.innerHTML =
    '<div data-notification-destination="/blog/post1"><span id="post-likes"><button>Post like</button></span></div>';
  expect(positionNotificationDestination(new URL(location.href))).toBe(true);
  expect(document.activeElement?.textContent).toBe("Post like");
  expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
    block: "start",
    behavior: "instant",
  });
});

it("positions plain post and actor destinations at the top", () => {
  for (const path of ["/blog/post1", "/u/actor"]) {
    document.body.innerHTML = `<div data-notification-destination="${path}"></div>`;
    expect(
      positionNotificationDestination(new URL(path, location.origin)),
    ).toBe(true);
  }
  expect(window.scrollTo).toHaveBeenCalledTimes(2);
});
