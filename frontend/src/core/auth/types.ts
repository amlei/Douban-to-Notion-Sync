import { z } from "zod";

export const userSchema = z.object({
  user_id: z.string(),
  name: z.string(),
  email: z.string(),
  avatar: z.string().nullable(),
  bio: z.string().nullable(),
  email_verified: z.boolean(),
  created_at: z.string(),
});

export type UserProfile = z.infer<typeof userSchema>;

export type AuthResult =
  | { status: "authenticated"; user: UserProfile }
  | { status: "unauthenticated" }
  | { status: "gateway_unavailable" };
