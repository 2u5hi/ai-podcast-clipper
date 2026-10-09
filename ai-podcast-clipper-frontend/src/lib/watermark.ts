export const MAX_WATERMARK_LENGTH = 40;

// printable ASCII: the caption font (Anton) covers it, and nothing else can turn into a control sequence
const PRINTABLE = /^[\x20-\x7E]+$/;

// The creator's watermark as it will be stored, or an error. Empty means "no watermark".
export function parseWatermarkText(
  input: string,
): { ok: true; text: string | null } | { ok: false; error: string } {
  const text = input.trim().replace(/\s+/g, " ");
  if (text === "") return { ok: true, text: null };
  if (text.length > MAX_WATERMARK_LENGTH) {
    return {
      ok: false,
      error: `Keep it to ${MAX_WATERMARK_LENGTH} characters or fewer`,
    };
  }
  if (!PRINTABLE.test(text)) {
    return {
      ok: false,
      error: "Use letters, numbers, spaces, and common symbols (no emoji)",
    };
  }
  return { ok: true, text };
}
