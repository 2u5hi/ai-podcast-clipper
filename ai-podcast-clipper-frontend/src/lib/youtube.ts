const VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/;
const WATCH_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
]);

// the 11-character video id from a youtube.com watch link or a youtu.be link, or null
export function parseYouTubeVideoId(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  let id: string | null = null;
  if (WATCH_HOSTS.has(url.hostname) && url.pathname === "/watch") {
    id = url.searchParams.get("v");
  } else if (url.hostname === "youtu.be") {
    id = url.pathname.slice(1);
  }
  return id && VIDEO_ID.test(id) ? id : null;
}

// the only URL form passed on to the worker, rebuilt from the id rather than echoing user input
export function canonicalYouTubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
