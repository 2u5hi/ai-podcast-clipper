"""Downloads finished clips from S3, renames them for delivery, and writes
clips_manifest.json into deliverables/.

usage: python build_deliverables.py --video-id <id> --source-url <url>
       [--moments-json moments.json] [--aws-profile default]

moments-json is the [{start, end}] array from the Modal logs, used to record
each clip's source timestamps in the manifest.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
from pathlib import Path

import boto3


def load_env() -> None:
    root = Path(__file__).resolve().parent.parent
    for line in (root / ".env").read_text(encoding="utf-8").splitlines():
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


def probe_duration(ffmpeg: str, path: Path) -> float | None:
    result = subprocess.run(
        [ffmpeg, "-i", str(path)], capture_output=True, text=True
    )
    m = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", result.stderr)
    if not m:
        return None
    h, mn, s = int(m.group(1)), int(m.group(2)), float(m.group(3))
    return h * 3600 + mn * 60 + s


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video-id", required=True)
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--prefix", help="S3 prefix (default: youtube_<video-id>)")
    parser.add_argument("--moments-json", help="JSON file with [{start, end}] in clip order")
    parser.add_argument("--aws-profile", help="Named AWS profile to use")
    args = parser.parse_args()

    load_env()
    bucket = os.environ["S3_BUCKET_NAME"]
    prefix = args.prefix or f"youtube_{args.video_id}"

    if args.aws_profile:
        s3 = boto3.Session(profile_name=args.aws_profile).client("s3")
    else:
        s3 = boto3.client("s3", region_name=os.environ.get("AWS_REGION"))

    listed = s3.list_objects_v2(Bucket=bucket, Prefix=prefix + "/")
    clip_keys = sorted(
        o["Key"]
        for o in listed.get("Contents", [])
        if not o["Key"].endswith("original.mp4")
    )
    if not clip_keys:
        raise SystemExit(f"No clips found under s3://{bucket}/{prefix}/")
    print(f"Found {len(clip_keys)} clips: {clip_keys}")

    moments = []
    if args.moments_json:
        moments = json.loads(Path(args.moments_json).read_text(encoding="utf-8"))

    out_dir = Path(__file__).resolve().parent.parent / "deliverables"
    out_dir.mkdir(exist_ok=True)
    ffmpeg = find_ffmpeg()

    manifest = []
    for i, key in enumerate(clip_keys):
        name = f"clip_{args.video_id}_{i + 1:02d}.mp4"
        dest = out_dir / name
        print(f"Downloading {key} -> {name}")
        s3.download_file(bucket, key, str(dest))
        duration = probe_duration(ffmpeg, dest) if ffmpeg else None
        moment = moments[i] if i < len(moments) else {}
        manifest.append(
            {
                "clip_filename": name,
                "source_video_url": args.source_url,
                "youtube_video_id": args.video_id,
                "start_timestamp_seconds": moment.get("start"),
                "end_timestamp_seconds": moment.get("end"),
                "duration_seconds": round(duration, 2) if duration else None,
                "s3_key": key,
                "watermark_present": True,
                "captions_present": True,
                "known_issues": None,
            }
        )

    manifest_path = out_dir / "clips_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Wrote {manifest_path} with {len(manifest)} entries.")


if __name__ == "__main__":
    main()
