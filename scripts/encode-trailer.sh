#!/usr/bin/env bash
# 트레일러 → 720p 단일 렌디션 HLS + master.m3u8 (public 버킷용)
# 사용: scripts/encode-trailer.sh <input> <slug>   → media/hls/<slug>-trailer/
set -euo pipefail

INPUT="${1:-}"
SLUG="${2:-}"
[[ -z "$INPUT" || -z "$SLUG" ]] && { echo "usage: $0 <input> <slug>" >&2; exit 1; }
[[ -f "$INPUT" ]] || { echo "input not found: $INPUT" >&2; exit 1; }
[[ "$SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || { echo "bad slug: $SLUG" >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg not installed" >&2; exit 1; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/media/hls/$SLUG-trailer"
[[ -e "$OUT" ]] && { echo "output exists, remove first: $OUT" >&2; exit 1; }
mkdir -p "$OUT/720p"

FPS="$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$INPUT" | awk -F/ '{printf "%d", $1/$2}')"
GOP=$((FPS * 2))

ffmpeg -hide_banner -y -i "$INPUT" \
  -filter_complex "[0:v]scale=w=1280:h=720:force_original_aspect_ratio=decrease:force_divisible_by=2[v]" \
  -map "[v]" -map 0:a:0 \
  -c:v libx264 -preset fast -profile:v main -pix_fmt yuv420p \
  -g "$GOP" -keyint_min "$GOP" -sc_threshold 0 \
  -b:v 1500k -maxrate 1600k -bufsize 3000k \
  -c:a aac -b:a 128k -ac 2 \
  -var_stream_map "v:0,a:0,name:720p" \
  -f hls -hls_time 6 -hls_playlist_type vod -hls_flags independent_segments \
  -hls_segment_filename "$OUT/%v/seg_%03d.ts" \
  -master_pl_name master.m3u8 \
  "$OUT/%v/index.m3u8"

echo
echo "done: $OUT"
echo "duration_sec: $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$INPUT")"
du -sh "$OUT"
