import nodemailer from "nodemailer";
import { env } from "~/env";

type Message = { to: string; subject: string; text: string };

// Picks how to send (ADR 0017): Resend when it has a key (needs a verified domain); otherwise SMTP,
// which on the free launch is Gmail with an app password; otherwise, in development only, the server log.
export function emailTransport(): "resend" | "smtp" | "log" {
  if (env.RESEND_API_KEY) return "resend";
  if (env.SMTP_USER && env.SMTP_PASSWORD) return "smtp";
  if (env.NODE_ENV === "production") {
    throw new Error(
      "No email transport configured: set RESEND_API_KEY or SMTP_USER and SMTP_PASSWORD",
    );
  }
  return "log";
}

export async function sendEmail(message: Message) {
  const transport = emailTransport();

  if (transport === "log") {
    console.info(
      `[dev email] to ${message.to}: ${message.subject}\n${message.text}`,
    );
    return;
  }

  const from = env.EMAIL_FROM ?? env.SMTP_USER;
  if (!from) throw new Error("EMAIL_FROM is not set");

  if (transport === "smtp") {
    await nodemailer
      .createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      })
      .sendMail({ from, ...message });
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, ...message }),
  });
  if (!response.ok) {
    throw new Error(
      `Email to ${message.to} failed (${response.status}): ${await response.text()}`,
    );
  }
}
