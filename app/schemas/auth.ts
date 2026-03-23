import { z } from "zod";

export const signUpSchema = z.object({
  name: z.string().min(3).max(32),
  email: z.email(),
  password: z.string().min(8).max(32),
});
