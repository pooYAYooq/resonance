import { describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import LegacyFeedRoute from "./feed/page";
import LegacyNotificationsRoute from "./notifications/page";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

describe("legacy workspace routes", () => {
  it("redirects Feed into the workspace", () => {
    LegacyFeedRoute();
    expect(redirect).toHaveBeenLastCalledWith("/dashboard/feed");
  });

  it("redirects Notifications into the workspace", () => {
    LegacyNotificationsRoute();
    expect(redirect).toHaveBeenLastCalledWith("/dashboard/notifications");
  });
});
