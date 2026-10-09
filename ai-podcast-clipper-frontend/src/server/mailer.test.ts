import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
  sendMail: vi.fn(),
  createTransport: vi.fn(),
}));

vi.mock("~/env", () => ({ env: mocks.env }));
vi.mock("nodemailer", () => ({
  default: { createTransport: mocks.createTransport },
}));

const { emailTransport, sendEmail } = await import("./mailer");

const message = { to: "a@example.com", subject: "Hi", text: "Body" };

beforeEach(() => {
  vi.resetAllMocks();
  for (const key of Object.keys(mocks.env)) delete mocks.env[key];
  Object.assign(mocks.env, {
    NODE_ENV: "development",
    SMTP_HOST: "smtp.gmail.com",
    SMTP_PORT: 465,
  });
  mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
});

describe("emailTransport", () => {
  it("prints to the log in development when nothing is configured", () => {
    expect(emailTransport()).toBe("log");
  });

  it("refuses to run in production with no way to send", () => {
    mocks.env.NODE_ENV = "production";
    expect(() => emailTransport()).toThrow(/No email transport/);
  });

  it("uses SMTP when Gmail credentials are set, and Resend when it has a key", () => {
    Object.assign(mocks.env, {
      SMTP_USER: "me@gmail.com",
      SMTP_PASSWORD: "app-pass",
    });
    expect(emailTransport()).toBe("smtp");
    mocks.env.RESEND_API_KEY = "re_123";
    expect(emailTransport()).toBe("resend");
  });
});

describe("sendEmail over SMTP", () => {
  it("sends through Gmail over TLS, from EMAIL_FROM or the account itself", async () => {
    Object.assign(mocks.env, {
      SMTP_USER: "me@gmail.com",
      SMTP_PASSWORD: "app-pass",
    });

    await sendEmail(message);
    expect(mocks.createTransport).toHaveBeenCalledWith({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: "me@gmail.com", pass: "app-pass" },
    });
    expect(mocks.sendMail).toHaveBeenCalledWith({
      from: "me@gmail.com",
      ...message,
    });

    mocks.env.EMAIL_FROM = "DivClip <me@gmail.com>";
    await sendEmail(message);
    expect(mocks.sendMail).toHaveBeenLastCalledWith({
      from: "DivClip <me@gmail.com>",
      ...message,
    });
  });
});
