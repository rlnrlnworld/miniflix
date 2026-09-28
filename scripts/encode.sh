#!/usr/bin/env bash
# MP4 원본 → 3렌디션 HLS (1080p/720p/480p) + master.m3u8
# 사용: scripts/encode.sh <input.mp4> <slug>
# 출력: media/hls/<slug>/{master.m3u8, 1080p/, 720p/, 480p/}
set -euo pipefail

INPUT="${1:-}"
SLUG="${2:-}"

if [[ -z "$INPUT" || -z "$SLUG" ]]; then
  echo "usage: $0 <input.mp4> <slug>" >&2
  exit 1
fi
if [[ ! -f "$INPUT" ]]; then
  echo "input not found: $INPUT" >&2
  exit 1
fi
if [[ ! "$SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  echo "slug must be lowercase alnum + hyphen: $SLUG" >&2
  exit 1
fi
command -v ffmpeg >/dev/null || { echo "ffmpeg not installed" >&2; exit 1; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/media/hls/$SLUG"

if [[ -e "$OUT" ]]; then
  echo "output exists, remove first: $OUT" >&2
  exit 1
fi
mkdir -p "$OUT"/{1080p,720p,480p}

# 세그먼트 6초. GOP 2초(30fps 기준 60프레임)로 세그먼트 경계마다 키프레임 보장.
# 원본이 3Mbps라 1080p 상한 3M 이상은 의미 없음.
ffmpeg -hide_banner -y -i "$INPUT" \
  -filter_complex "[0:v]split=3[v1][v2][v3];[v1]scale=w=1920:h=1080:force_original_aspect_ratio=decrease:force_divisible_by=2[v1o];[v2]scale=w=1280:h=720:force_original_aspect_ratio=decrease:force_divisible_by=2[v2o];[v3]scale=w=854:h=480:force_original_aspect_ratio=decrease:force_divisible_by=2[v3o]" \
  -map "[v1o]" -map 0:a:0 -map "[v2o]" -map 0:a:0 -map "[v3o]" -map 0:a:0 \
  -c:v libx264 -preset fast -profile:v main -pix_fmt yuv420p \
  -g 60 -keyint_min 60 -sc_threshold 0 \
  -b:v:0 3000k -maxrate:v:0 3200k -bufsize:v:0 6000k \
  -b:v:1 1500k -maxrate:v:1 1600k -bufsize:v:1 3000k \
  -b:v:2  800k -maxrate:v:2  860k -bufsize:v:2 1600k \
  -c:a aac -b:a 128k -ac 2 \
  -var_stream_map "v:0,a:0,name:1080p v:1,a:1,name:720p v:2,a:2,name:480p" \
  -f hls -hls_time 6 -hls_playlist_type vod -hls_flags independent_segments \
  -hls_segment_filename "$OUT/%v/seg_%03d.ts" \
  -master_pl_name master.m3u8 \
  "$OUT/%v/index.m3u8"

DURATION="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$INPUT")"
echo
echo "done: $OUT"
echo "duration_sec: $DURATION"
du -sh "$OUT"/1080p "$OUT"/720p "$OUT"/480p "$OUT"
