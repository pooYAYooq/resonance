import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("keeps the later Tailwind class when conflicts occur", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("filters falsey values", () => {
    expect(cn("text-sm", false && "hidden", undefined, "font-medium")).toBe(
      "text-sm font-medium",
    );
  });

  it("supports object condition syntax", () => {
    expect(cn("base", { hidden: false, block: true })).toBe("base block");
  });
});
