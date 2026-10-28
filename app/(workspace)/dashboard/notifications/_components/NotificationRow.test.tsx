import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MouseEvent, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { NotificationRow, type NotificationRowData } from "./NotificationRow";

/**
 * The desktop and mobile layouts share one DOM; jsdom does not apply the
 * responsive classes. Scope each assertion to the layout under test.
 */
vi.mock("@/components/web/FollowButton", () => ({
  FollowButton: () => null,
}));

vi.mock("@/components/web/NotificationLink", () => ({
  NotificationLink: ({
    href,
    children,
    onClick,
    onAuxClick,
    className,
    "aria-label": ariaLabel,
  }: {
    href: string;
    children?: ReactNode;
    onClick?: () => void;
    onAuxClick?: (event: MouseEvent) => void;
    className?: string;
    "aria-label"?: string;
  }) => (
    <a
      href={href}
      onClick={onClick}
      onAuxClick={onAuxClick}
      className={className}
      aria-label={ariaLabel}
    >
      {children}
    </a>
  ),
}));

const base = {
  _id: "notif-1" as NotificationRowData["_id"],
  _creationTime: 1,
  recipientId: "recipient",
  actorId: "actor",
  createdAt: Date.now(),
  actorName: "Hiva",
  actorUsername: "hiva",
  actorAvatarUrl: null,
};

function layouts(container: HTMLElement) {
  return {
    mobile: within(
      container.querySelector<HTMLElement>(
        '[data-testid="notification-mobile"]',
      )!,
    ),
    desktop: within(
      container.querySelector<HTMLElement>(
        '[data-testid="notification-desktop"]',
      )!,
    ),
  };
}

describe("NotificationRow", () => {
  it("renders a follow row without a post heading", () => {
    const { container } = render(
      <NotificationRow
        notification={{ ...base, type: "follow" } as NotificationRowData}
      />,
    );
    const { desktop } = layouts(container);

    expect(desktop.getByText(/started following you/)).toBeInTheDocument();
    expect(
      desktop.queryByRole("heading", { level: 2 }),
    ).not.toBeInTheDocument();
    expect(desktop.getByRole("link", { name: "Hiva" })).toHaveAttribute(
      "href",
      "/u/hiva",
    );
  });

  it("renders a follow row from an actor with no username as Someone", () => {
    const { container } = render(
      <NotificationRow
        notification={
          {
            ...base,
            type: "follow",
            actorName: null,
            actorUsername: null,
          } as NotificationRowData
        }
      />,
    );
    const { desktop } = layouts(container);

    const name = desktop.getByText("Someone");
    expect(name.closest("p")?.textContent).toContain("started following you");
    expect(
      desktop.queryByRole("link", { name: "Someone" }),
    ).not.toBeInTheDocument();
  });

  it("renders a post-like row with the post title", () => {
    const { container } = render(
      <NotificationRow
        notification={
          {
            ...base,
            type: "post_like",
            postId: "post-1",
            postTitle: "A post",
          } as NotificationRowData
        }
      />,
    );
    const { mobile } = layouts(container);

    expect(mobile.getByText("liked your post:")).toBeInTheDocument();
    expect(mobile.getByRole("link", { name: "Open A post" })).toHaveAttribute(
      "href",
      "/blog/post-1",
    );
    expect(mobile.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  it("renders a comment row with a focused conversation destination", () => {
    const { container } = render(
      <NotificationRow
        notification={
          {
            ...base,
            type: "comment",
            postId: "post-1",
            postTitle: "A post",
            commentId: "comment-1",
            excerpt: "nice work",
          } as NotificationRowData
        }
      />,
    );
    const { mobile } = layouts(container);

    expect(mobile.getByText(/commented/)).toBeInTheDocument();
    const excerpt = mobile.getByRole("link", { name: /nice work/ });
    expect(excerpt).toHaveAttribute("href", "/blog/post-1/comments/comment-1");
    expect(mobile.getByRole("link", { name: "Open A post" })).toHaveAttribute(
      "href",
      "/blog/post-1",
    );
  });

  it("renders a comment-like row", () => {
    const { container } = render(
      <NotificationRow
        notification={
          {
            ...base,
            type: "comment_like",
            postId: "post-1",
            postTitle: "A post",
            commentId: "comment-1",
            excerpt: "nice work",
          } as NotificationRowData
        }
      />,
    );
    const { mobile } = layouts(container);

    expect(mobile.getByText(/liked your comment/)).toBeInTheDocument();
    const excerpt = mobile.getByRole("link", { name: /nice work/ });
    expect(excerpt).toHaveAttribute("href", "/blog/post-1/comments/comment-1");
    expect(mobile.getByRole("link", { name: "Open A post" })).toHaveAttribute(
      "href",
      "/blog/post-1",
    );
  });

  it("marks the row read when the follow profile link is activated", () => {
    const onActivate = vi.fn();
    const { container } = render(
      <NotificationRow
        notification={{ ...base, type: "follow" } as NotificationRowData}
        onActivate={onActivate}
      />,
    );
    const { desktop } = layouts(container);

    fireEvent.click(desktop.getByRole("link", { name: "Hiva" }));
    expect(onActivate).toHaveBeenCalledWith("notif-1");
  });

  it("hides Mark as read on a read row", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <NotificationRow
        notification={
          {
            ...base,
            type: "follow",
            readAt: 123,
          } as NotificationRowData
        }
      />,
    );
    const { mobile } = layouts(container);

    await user.click(
      mobile.getByRole("button", { name: /Actions for notification/ }),
    );
    const menu = await screen.findByRole("menu");

    expect(
      within(menu).queryByRole("menuitem", { name: "Mark as read" }),
    ).not.toBeInTheDocument();
    expect(
      within(menu).getByRole("menuitem", { name: "Delete notification" }),
    ).toBeInTheDocument();
  });
});

it.each(["comment", "comment_like", "post_like"] as const)(
  "uses direct destinations for every %s row link in both layouts",
  async (type) => {
    const user = userEvent.setup();
    const { container } = render(
      <NotificationRow
        notification={
          {
            ...base,
            _id: `matrix-${type}`,
            type,
            postId: "post-1",
            postTitle: "A post",
            commentId: "comment-1",
            excerpt: type === "post_like" ? undefined : "Matrix excerpt",
          } as NotificationRowData
        }
      />,
    );
    const { mobile, desktop } = layouts(container);
    await user.click(
      desktop.getByRole("button", { name: /Expand notification/ }),
    );
    for (const layout of [mobile, desktop]) {
      const anchors = layout.getAllByRole("link");
      expect(anchors.every((a) => !a.getAttribute("href")?.includes("#"))).toBe(
        true,
      );
      expect(layout.getByRole("link", { name: "Hiva" })).toHaveAttribute(
        "href",
        "/u/hiva",
      );
      expect(
        layout.getByRole("link", { name: "Open Hiva's profile" }),
      ).toHaveAttribute("href", "/u/hiva");
      if (type !== "post_like")
        expect(
          layout.getByRole("link", { name: /Matrix excerpt/ }),
        ).toHaveAttribute("href", "/blog/post-1/comments/comment-1");
    }
    expect(desktop.getByRole("link", { name: "Open A post" })).toHaveAttribute(
      "href",
      "/blog/post-1",
    );
    expect(desktop.getByRole("link", { name: "A post" })).toHaveAttribute(
      "href",
      "/blog/post-1",
    );
  },
);

it("opens the full article from the mobile title and cover while the event opens the comment", () => {
  const { container } = render(
    <NotificationRow
      notification={
        {
          ...base,
          type: "comment",
          postId: "post-1",
          postTitle: "Article",
          commentId: "comment-1",
          excerpt: "The comment",
        } as NotificationRowData
      }
    />,
  );
  const { mobile } = layouts(container);
  expect(mobile.getByRole("link", { name: "Open Article" })).toHaveAttribute(
    "href",
    "/blog/post-1",
  );
  expect(mobile.getByRole("link", { name: /The comment/ })).toHaveAttribute(
    "href",
    "/blog/post-1/comments/comment-1",
  );
});

it("retains the mobile indicator slot when a notification becomes read", () => {
  const notification = { ...base, type: "follow" } as NotificationRowData;
  const { container, rerender } = render(
    <NotificationRow notification={notification} />,
  );
  const { mobile } = layouts(container);
  const indicator = mobile.getByRole("img", { name: "Unread" });
  expect(mobile.queryByText("New")).not.toBeInTheDocument();
  rerender(<NotificationRow notification={{ ...notification, readAt: 123 }} />);
  expect(indicator).toBeInTheDocument();
  expect(indicator).toHaveAttribute("aria-hidden", "true");
  expect(mobile.queryByRole("img", { name: "Unread" })).not.toBeInTheDocument();
});

it.each(["follow", "comment", "comment_like", "post_like"] as const)(
  "retains the desktop unread indicator space for a read %s row",
  (type) => {
    const notification = {
      ...base,
      type,
      postId: "post-1",
      postTitle: "A post",
      commentId: "comment-1",
      excerpt: "A comment",
    } as NotificationRowData;
    const { container, rerender } = render(
      <NotificationRow notification={notification} />,
    );
    const { desktop } = layouts(container);
    const indicator = desktop.getByRole("img", { name: "Unread" });
    const slot = indicator.parentElement;
    expect(desktop.queryByText("New")).not.toBeInTheDocument();
    rerender(
      <NotificationRow notification={{ ...notification, readAt: 123 }} />,
    );
    expect(slot).toBeInTheDocument();
    expect(indicator).toBeInTheDocument();
    expect(
      desktop.queryByRole("img", { name: "Unread" }),
    ).not.toBeInTheDocument();
    expect(indicator).toHaveAttribute("aria-hidden", "true");
    if (type === "follow") {
      expect(
        desktop.queryByRole("button", { name: "Mark as read" }),
      ).not.toBeInTheDocument();
    }
  },
);
it("keeps the desktop follow indicator keyboard action to mark read", async () => {
  const onActivate = vi.fn();
  const user = userEvent.setup();
  const { container } = render(
    <NotificationRow
      notification={{ ...base, type: "follow" } as NotificationRowData}
      onActivate={onActivate}
    />,
  );
  const { desktop } = layouts(container);
  expect(desktop.getByRole("img", { name: "Unread" })).toBeInTheDocument();
  const action = desktop.getByRole("button", { name: "Mark as read" });
  action.focus();
  await user.keyboard("{Enter}");
  expect(onActivate).toHaveBeenCalledExactlyOnceWith("notif-1");
});
