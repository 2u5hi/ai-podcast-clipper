import { env } from "~/env";

// Sends through Resend's HTTP API. Without a key (development only; env.js requires one in production)
// the message is printed to the server log so links can still be followed.
export async function sendEmail(message: {
  to: string;
  subject: string;
  text: string;
}) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    console.info(
      `[dev email] to ${message.to}: ${message.subject}\n${message.text}`,
    );
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Email to ${message.to} failed (${response.status}): ${await response.text()}`,
    );
  }
}
