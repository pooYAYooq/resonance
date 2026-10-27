import { describe, expect, it } from "vitest";
import LikedRoute from "./page";

describe("Liked route", () => {
  it("redirects to the liked page in the dashboard", () => {
    expect(LikedRoute).toThrowError(
      expect.objectContaining({
        digest: "NEXT_REDIRECT;replace;/dashboard/liked;307;",
      }),
    );
  });
});
