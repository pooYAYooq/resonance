import { describe, expect, it } from "vitest";
import {
  getBlockColorAttributes,
  getHeadingClassName,
  getHeadingTagName,
  getTextAlignment,
} from "./post-body-shared";

describe("post body shared helpers", () => {
  it("rejects fractional heading levels and uses the default size", () => {
    expect(getHeadingClassName(2.5)).toContain("text-3xl");
    expect(getHeadingClassName(2)).toContain("text-3xl");
    expect(getHeadingClassName(6)).toContain("text-base");
    expect(getHeadingClassName(7)).toContain("text-3xl");
  });

  it("normalizes heading tags and rejects invalid levels", () => {
    expect(getHeadingTagName(2)).toBe("h2");
    expect(getHeadingTagName(4.5)).toBe("h2");
    expect(getHeadingTagName(7)).toBe("h2");
    expect(getHeadingTagName(undefined)).toBe("h2");
  });

  it("ignores inherited keys for text alignment", () => {
    expect(getTextAlignment({ textAlignment: "toString" })).toBe("text-left");
    expect(getTextAlignment({ textAlignment: "center" })).toBe("text-center");
  });

  it("omits default color tokens and keeps named ones", () => {
    expect(getBlockColorAttributes({})).toEqual({});
    expect(
      getBlockColorAttributes({ textColor: "default", backgroundColor: "red" }),
    ).toEqual({ "data-background-color": "red" });
  });
});
