import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode, ComponentProps } from "react";
const { push, prefetchRoute, request, optionalExit, navigate } = vi.hoisted(
  () => ({
    push: vi.fn(),
    prefetchRoute: vi.fn(),
    request: vi.fn(),
    optionalExit: vi.fn(),
    navigate: vi.fn(),
  }),
);
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, prefetch: prefetchRoute }),
}));
vi.mock("./AuthoringExitProvider", () => ({
  useOptionalAuthoringExit: () => optionalExit(),
}));
vi.mock("@/lib/notification-navigation", () => ({
  navigateFromNotification: (href: string, run: () => void) => {
    navigate(href);
    run();
  },
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onNavigate,
    prefetch,
    onPointerEnter,
    onFocus,
  }: {
    children: ReactNode;
    href: string;
    onNavigate: (event: { preventDefault: () => void }) => void;
    prefetch?: boolean;
  } & Pick<ComponentProps<"a">, "onPointerEnter" | "onFocus">) => (
    <a
      onPointerEnter={onPointerEnter}
      onFocus={onFocus}
      href={href}
      data-prefetch={String(prefetch)}
      onClick={(event) => {
        event.preventDefault();
        if (!event.ctrlKey && !event.metaKey)
          onNavigate({ preventDefault: () => {} });
      }}
    >
      {children}
    </a>
  ),
}));
import { NotificationLink } from "./NotificationLink";
beforeEach(() => {
  vi.clearAllMocks();
  optionalExit.mockReturnValue(null);
});
it.each(["/u/hiva", "/blog/post-1", "/blog/post-1/comments/comment-1"])(
  "uses the same direct navigation and top positioning for %s",
  (href) => {
    render(
      <NotificationLink href={href} scroll={false}>
        Destination
      </NotificationLink>,
    );
    fireEvent.click(screen.getByRole("link"));
    expect(navigate).toHaveBeenCalledWith(href);
    expect(push).toHaveBeenCalledWith(href, { scroll: true });
    expect(screen.getByRole("link")).toHaveAttribute("data-prefetch", "false");
  },
);
it("runs the authoring guard before starting navigation", () => {
  optionalExit.mockReturnValue({ request });
  render(<NotificationLink href="/u/hiva">Profile</NotificationLink>);
  fireEvent.click(screen.getByRole("link"));
  expect(push).not.toHaveBeenCalled();
  expect(request).toHaveBeenCalledWith(
    expect.objectContaining({ kind: "navigate", href: "/u/hiva" }),
  );
  request.mock.calls[0][0].onContinue();
  expect(push).toHaveBeenCalledWith("/u/hiva", { scroll: true });
});
it("keeps modifier clicks native and respects a cancelled navigation", () => {
  const { rerender } = render(
    <NotificationLink href="/u/hiva">Profile</NotificationLink>,
  );
  fireEvent.click(screen.getByRole("link"), { ctrlKey: true });
  expect(navigate).not.toHaveBeenCalled();
  rerender(
    <NotificationLink
      href="/u/hiva"
      onNavigate={(event) => event.preventDefault()}
    >
      Profile
    </NotificationLink>,
  );
  fireEvent.click(screen.getByRole("link"));
  expect(navigate).not.toHaveBeenCalled();
});

it("returns to the top when the notification opens the already-visible post", () => {
  window.history.replaceState({}, "", "/blog/post-1");
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  render(<NotificationLink href="/blog/post-1">Post</NotificationLink>);
  fireEvent.click(screen.getByRole("link"));
  expect(scroll).toHaveBeenCalledWith({ top: 0, behavior: "instant" });
  scroll.mockRestore();
});

it("prefetches only on intent, once per href, and preserves caller handlers", () => {
  const onFocus = vi.fn();
  const onPointerEnter = vi.fn();
  const { rerender } = render(
    <NotificationLink
      href="/u/one"
      onFocus={onFocus}
      onPointerEnter={onPointerEnter}
    >
      Profile
    </NotificationLink>,
  );
  const link = screen.getByRole("link");
  vi.spyOn(link, "matches").mockReturnValue(true);
  expect(prefetchRoute).not.toHaveBeenCalled();
  fireEvent.click(link);
  fireEvent.touchStart(link);
  expect(prefetchRoute).not.toHaveBeenCalled();
  const enter = (pointerType: string) => {
    const event = new Event("pointerover", { bubbles: true });
    Object.defineProperty(event, "pointerType", { value: pointerType });
    fireEvent(link, event);
  };
  enter("touch");
  expect(prefetchRoute).not.toHaveBeenCalled();
  enter("mouse");
  fireEvent.focus(link);
  expect(prefetchRoute).toHaveBeenCalledExactlyOnceWith("/u/one");
  expect(onFocus).toHaveBeenCalledTimes(1);
  expect(onPointerEnter).toHaveBeenCalledTimes(2);
  rerender(<NotificationLink href="/u/two">Profile</NotificationLink>);
  fireEvent.focus(link);
  expect(prefetchRoute).toHaveBeenLastCalledWith("/u/two");
  expect(prefetchRoute).toHaveBeenCalledTimes(2);
});
it("allows callers to disable intent prefetch", () => {
  render(
    <NotificationLink href="/u/one" prefetch={false}>
      Profile
    </NotificationLink>,
  );
  fireEvent.focus(screen.getByRole("link"));
  expect(prefetchRoute).not.toHaveBeenCalled();
});

it("does not prefetch on pointer-induced focus", () => {
  render(<NotificationLink href="/u/one">Profile</NotificationLink>);
  const link = screen.getByRole("link");
  vi.spyOn(link, "matches").mockReturnValue(false);
  fireEvent.focus(link);
  expect(prefetchRoute).not.toHaveBeenCalled();
});
it("prefetches on keyboard focus without prior hover", () => {
  render(<NotificationLink href="/u/one">Profile</NotificationLink>);
  const link = screen.getByRole("link");
  vi.spyOn(link, "matches").mockReturnValue(true);
  fireEvent.focus(link);
  expect(prefetchRoute).toHaveBeenCalledExactlyOnceWith("/u/one");
});
