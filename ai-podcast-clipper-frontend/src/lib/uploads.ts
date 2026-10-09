export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
export const UPLOAD_CONTENT_TYPE = "video/mp4";

// null when the upload is allowed, otherwise the reason it isn't
export function checkUpload(file: {
  contentType: string;
  size: number;
}): string | null {
  if (file.contentType !== UPLOAD_CONTENT_TYPE)
    return "Only MP4 files are supported";
  if (!Number.isSafeInteger(file.size) || file.size <= 0)
    return "The file is empty";
  if (file.size > MAX_UPLOAD_BYTES) return "Files can be up to 500MB";
  return null;
}
