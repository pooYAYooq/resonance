import { describe, expect, it, vi } from "vitest";

import {
  DASHBOARD_PATH,
  buildAuthHref,
  getCurrentReturnTo,
  getSafeReturnTo,
} from "./auth-return";

describe("auth return helpers", () => {
  it("uses the dashboard as the default path", () => {
    expect(DASHBOARD_PATH).toBe("/dashboard");
  });

  it("accepts an internal path with a query string", () => {
    expect(getSafeReturnTo("/blog/post-1?tag=design")).toBe(
      "/blog/post-1?tag=design",
    );
  });

  it("defaults null to the dashboard", () => {
    expect(getSafeReturnTo(null)).toBe(DASHBOARD_PATH);
  });

  it("defaults an empty path to the dashboard", () => {
    expect(getSafeReturnTo("")).toBe(DASHBOARD_PATH);
  });

  it("rejects an external HTTPS URL", () => {
    expect(getSafeReturnTo("https://example.com")).toBe(DASHBOARD_PATH);
  });

  it("rejects a protocol-relative external URL", () => {
    expect(getSafeReturnTo("//example.com")).toBe(DASHBOARD_PATH);
  });

  it("rejects a path without a leading slash", () => {
    expect(getSafeReturnTo("dashboard")).toBe(DASHBOARD_PATH);
  });

  it("rejects a backslash path", () => {
    expect(getSafeReturnTo("\\dashboard")).toBe(DASHBOARD_PATH);
  });

  it("rejects a malformed percent-encoded path", () => {
    expect(getSafeReturnTo("/blog/%zz")).toBe(DASHBOARD_PATH);
  });

  it.each([
    "/%2F%2Fevil.com",
    "/%2f%2fevil.com",
    "/%5Cevil.com",
    "/%61uth/login",
  ])("rejects encoded unsafe return paths: %s", (returnTo) => {
    expect(getSafeReturnTo(returnTo)).toBe(DASHBOARD_PATH);
  });

  it("rejects authentication paths", () => {
    expect(getSafeReturnTo("/auth/login")).toBe(DASHBOARD_PATH);
  });

  it("rejects non-login authentication paths", () => {
    expect(getSafeReturnTo("/auth/sign-up")).toBe(DASHBOARD_PATH);
  });

  it("preserves a valid hash", () => {
    expect(getSafeReturnTo("/blog/post-1#comments")).toBe(
      "/blog/post-1#comments",
    );
  });

  it("builds an auth URL with an encoded return path", () => {
    expect(buildAuthHref("/auth/login", "/u/user-1")).toBe(
      "/auth/login?returnTo=%2Fu%2Fuser-1",
    );
  });

  it("returns the browser's current path, query, and hash", () => {
    vi.stubGlobal("window", {
      location: {
        pathname: "/blog/post-1",
        search: "?tag=design",
        hash: "#comments",
      },
    });

    expect(getCurrentReturnTo()).toBe("/blog/post-1?tag=design#comments");

    vi.unstubAllGlobals();
  });
});
