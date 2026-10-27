import { describe, expect, it } from "vitest";
import SavedRoute from "./page";

describe("Saved route", () => {
  it("redirects to the saved page in the dashboard", () => {
    expect(SavedRoute).toThrowError(
      expect.objectContaining({
        digest: "NEXT_REDIRECT;replace;/dashboard/saved;307;",
      }),
    );
  });
});
