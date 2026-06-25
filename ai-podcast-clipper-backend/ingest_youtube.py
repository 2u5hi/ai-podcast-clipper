"""Downloads a YouTube video and uploads it to S3 as <prefix>/original.mp4.

This is the reliable ingestion path when YouTube bot-checks Modal's IPs.
After it finishes, kick off processing with scripts/trigger-processing.mjs.

usage: python ingest_youtube.py --url <youtube url> [--cookies cookies.txt]
"""
import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import boto3


def load_env() -> None:
    root = Path(__file__).resolve().parent.parent
    env_file = root / ".env"
    if not env_file.exists():
        sys.exit(f"Missing {env_file}; copy .env.example and fill it in.")
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"'))


def find_ffmpeg() -> str | None:
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return None


def video_id_from_url(url: str) -> str:
    m = re.search(r"(?:v=|youtu\.be/)([a-zA-Z0-9_-]{11})", url)
    if not m:
        sys.exit(f"Invalid YouTube URL: {url}")
    return m.group(1)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True, help="YouTube video URL")
    parser.add_argument("--cookies", help="Path to a Netscape-format cookies.txt (optional)")
    parser.add_argument("--max-height", type=int, default=1080)
    parser.add_argument("--s3-key", help="Override S3 key (default: youtube_<id>/original.mp4)")
    parser.add_argument(
        "--aws-profile",
        help="Use a named AWS CLI profile for the upload instead of the .env credentials",
    )
    args = parser.parse_args()

    load_env()
    bucket = os.environ.get("S3_BUCKET_NAME")
    if not bucket:
        sys.exit("S3_BUCKET_NAME is not set.")

    video_id = video_id_from_url(args.url)
    s3_key = args.s3_key or f"youtube_{video_id}/original.mp4"

    ffmpeg = find_ffmpeg()
    with tempfile.TemporaryDirectory() as tmp:
        out_path = Path(tmp) / "original.mp4"
        cmd = [sys.executable, "-m", "yt_dlp", "--no-playlist", "-o", str(out_path)]
        if ffmpeg:
            # ffmpeg available: merge best video+audio up to max height
            cmd += [
                "-f",
                f"bestvideo[ext=mp4][height<={args.max_height}]+bestaudio[ext=m4a]/best[ext=mp4]/best",
                "--merge-output-format",
                "mp4",
                "--ffmpeg-location",
                ffmpeg,
            ]
        else:
            # no ffmpeg: fall back to best progressive mp4
            cmd += ["-f", f"best[ext=mp4][height<={args.max_height}]/best[ext=mp4]"]
        if args.cookies:
            cmd += ["--cookies", args.cookies]
        cmd.append(args.url)

        print(f"Downloading {args.url} (video id {video_id})...")
        result = subprocess.run(cmd)
        if result.returncode != 0 or not out_path.exists():
            sys.exit(
                "yt-dlp failed. If the error mentions bot checks or sign-in, "
                "export fresh YouTube cookies and pass --cookies cookies.txt."
            )

        size_mb = out_path.stat().st_size / 1e6
        print(f"Downloaded {size_mb:.1f} MB; uploading to s3://{bucket}/{s3_key}...")
        if args.aws_profile:
            session = boto3.Session(profile_name=args.aws_profile)
            s3 = session.client("s3")
        else:
            s3 = boto3.client("s3", region_name=os.environ.get("AWS_REGION"))
        s3.upload_file(str(out_path), bucket, s3_key)

    print("Upload complete.")
    print(f"S3 key: {s3_key}")
    print(f"Source URL: {args.url}")
    print(f"Video ID: {video_id}")


if __name__ == "__main__":
    main()
