import { describe, expect, it } from "vitest";
import { loginSchema, signUpSchema } from "@/schemas/auth";

describe("auth schema", () => {
  it("accepts a valid sign-up payload", () => {
    const result = signUpSchema.safeParse({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "password123",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid login email", () => {
    const result = loginSchema.safeParse({
      email: "bad-email",
      password: "password123",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a short sign-up password", () => {
    const result = signUpSchema.safeParse({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "short",
    });

    expect(result.success).toBe(false);
  });
});
