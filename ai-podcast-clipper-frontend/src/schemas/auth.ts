import { z } from "zod";

// emails are stored lowercase (the database checks it), so every form normalizes the same way
const email = z
  .string()
  .trim()
  .toLowerCase()
  .email("Please enter a valid email address");

const newPassword = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters");

export const signupSchema = z.object({
  email,
  password: newPassword,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: newPassword,
});

export type SignupFormValues = z.infer<typeof signupSchema>;
export type LoginFormValues = z.infer<typeof loginSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
