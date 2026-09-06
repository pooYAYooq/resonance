import { describe, expect, it } from "vitest";
import {
  buildDiscoverLatestLink,
  buildDiscoverSearchLink,
  buildDiscoverTopicLink,
  normalizeDiscoverParams,
} from "./discover";

describe("normalizeDiscoverParams", () => {
  it("selects a trimmed search query before tag or sort", () => {
    expect(
      normalizeDiscoverParams({
        q: "  design ",
        tag: "Technology",
        sort: "unsupported",
      }),
    ).toEqual({ mode: "search", query: "design" });
  });

  it("uses the first repeated query value", () => {
    expect(
      normalizeDiscoverParams({ q: ["design", "science"], tag: ["Design"] }),
    ).toEqual({ mode: "search", query: "design" });
  });

  it("selects a canonical topic and ignores latest sort", () => {
    expect(
      normalizeDiscoverParams({ tag: "Technology", sort: "latest" }),
    ).toEqual({ mode: "topic", tag: "Technology" });
  });

  it("falls back to latest for blank or unsupported values", () => {
    expect(normalizeDiscoverParams({ q: "   " })).toEqual({ mode: "latest" });
    expect(normalizeDiscoverParams({ tag: "Unsupported" })).toEqual({
      mode: "latest",
    });
    expect(normalizeDiscoverParams({ sort: "popular" })).toEqual({
      mode: "latest",
    });
  });

  it("uses the first repeated tag value", () => {
    expect(normalizeDiscoverParams({ tag: ["Design", "Technology"] })).toEqual({
      mode: "topic",
      tag: "Design",
    });
  });
});

describe("Discover mode links", () => {
  it("builds an encoded search link without topic or sort state", () => {
    expect(buildDiscoverSearchLink(" design systems ")).toBe(
      "/blog?q=design%20systems",
    );
  });

  it("builds a topic link without search or sort state", () => {
    expect(buildDiscoverTopicLink("Technology")).toBe("/blog?tag=Technology");
  });

  it("builds the latest link without incompatible state", () => {
    expect(buildDiscoverLatestLink()).toBe("/blog");
  });
});
