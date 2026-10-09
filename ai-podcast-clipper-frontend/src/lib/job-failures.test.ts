import { describe, expect, it } from "vitest";
import { failureReasonFor } from "./job-failures";

describe("failureReasonFor", () => {
  it("tells the user to check the file when the worker can't read it", () => {
    expect(
      failureReasonFor(
        new Error('Modal backend failed (422): {"detail":"Unreadable video"}'),
      ),
    ).toMatch(/couldn't be read/);
  });

  it("calls a misconfigured backend temporary, without details", () => {
    const reason = failureReasonFor(
      new Error("Modal backend failed (401): Incorrect bearer token"),
    );
    expect(reason).toMatch(/unavailable/);
    expect(reason).not.toMatch(/token/i);
  });

  it("gives a generic retry message for crashes and timeouts", () => {
    expect(
      failureReasonFor(new Error("Modal backend failed (500): Traceback ...")),
    ).toMatch(/try again/);
    expect(failureReasonFor(new Error("fetch failed"))).toMatch(/try again/);
    expect(failureReasonFor("not even an Error")).toMatch(/try again/);
  });

  it("never echoes the raw error", () => {
    const reason = failureReasonFor(
      new Error("Modal backend failed (500): s3://dark-phoenix-dev/secret-key"),
    );
    expect(reason).not.toContain("s3://");
  });
});
