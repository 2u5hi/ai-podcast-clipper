"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} from "~/actions/auth";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  type ForgotPasswordFormValues,
  type ResetPasswordFormValues,
} from "~/schemas/auth";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-md bg-red-50 p-3 text-sm text-red-500">{message}</p>
  );
}

// Confirming takes a click: mail scanners open links on their own, and a page that confirmed
// on load would spend the token before the person ever saw it.
export function VerifyEmailCard({ token }: { token: string }) {
  const [state, setState] = useState<
    "ready" | "working" | "verified" | "invalid"
  >(token ? "ready" : "invalid");
  const router = useRouter();

  const confirm = async () => {
    setState("working");
    setState(await verifyEmail(token));
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Confirm your email</CardTitle>
        <CardDescription>
          {state === "verified"
            ? "Your email is confirmed and your free credits are in your account."
            : state === "invalid"
              ? "This link is invalid or has expired. Sign in and use “Resend email” on your dashboard."
              : "One click and you're ready to make clips."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state === "verified" || state === "invalid" ? (
          <Button asChild className="w-full">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        ) : (
          <Button
            className="w-full"
            onClick={confirm}
            disabled={state === "working"}
          >
            {state === "working" ? "Confirming..." : "Confirm email"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setError(null);
    const result = await requestPasswordReset(data);
    if (result.success) setSent(true);
    else setError(result.error ?? "Something went wrong");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Reset your password</CardTitle>
        <CardDescription>
          {sent
            ? "If an account uses that email, a reset link is on its way. It works for one hour."
            : "Enter your email and we'll send you a link to choose a new password."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!sent && (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-6"
          >
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>
            <ErrorNote message={error} />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send reset link"}
            </Button>
          </form>
        )}
        <div className="mt-4 text-center text-sm">
          <Link href="/login" className="underline underline-offset-4">
            Back to log in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token },
  });

  const onSubmit = async (data: ResetPasswordFormValues) => {
    setError(null);
    const result = await resetPassword(data);
    if (result.success) router.push("/login?reset=1");
    else setError(result.error ?? "Something went wrong");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Choose a new password</CardTitle>
        <CardDescription>At least 8 characters.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <input type="hidden" {...register("token")} />
          <div className="grid gap-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>
          <ErrorNote message={error} />
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Set new password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
