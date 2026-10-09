// What the dashboard tells a user about a failed job. Every failed job has its credits refunded
// (ADR 0013); the full error stays in Inngest's run log, never in the UI.

const MODAL_STATUS = /Modal backend failed \((\d{3})\)/;

export function failureReasonFor(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const status = Number(MODAL_STATUS.exec(message)?.[1]);

  // the worker answers 422 when the file has no readable video and audio
  if (status === 422 || status === 400) {
    return "The file couldn't be read as a video with sound. Check that it plays, then upload it again.";
  }
  if (status === 401 || status === 403) {
    return "Processing is unavailable right now. Please try again later.";
  }
  return "Something went wrong while making your clips. Please try again.";
}
