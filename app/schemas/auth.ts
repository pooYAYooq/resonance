import { z } from "zod";

// Validation schema for user sign-up
export const signUpSchema = z.object({
  name: z.string().min(3).max(32),
  email: z.email(),
  password: z.string().min(8).max(32),
});

// Validation schema for user login
export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(32),
});
