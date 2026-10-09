const VIDEO_ID = /(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

// the 11-character video id from a watch or youtu.be link, or null
export function parseYouTubeVideoId(url: string): string | null {
  return VIDEO_ID.exec(url)?.[1] ?? null;
}
