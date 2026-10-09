import re

# keys the web app issues: <uuid>/original.mp4 (and youtube_<id>/original.mp4 from before per-job keys)
_S3_KEY = re.compile(r"[A-Za-z0-9_-]{1,64}/original\.mp4")
_WATCH_URL = re.compile(r"https://www\.youtube\.com/watch\?v=[A-Za-z0-9_-]{11}")


def is_valid_s3_key(key: str) -> bool:
    return _S3_KEY.fullmatch(key) is not None


def canonical_youtube_url(url: str) -> str | None:
    """The only YouTube URL shape the worker will hand to yt-dlp; anything else is refused."""
    return url if _WATCH_URL.fullmatch(url) else None
