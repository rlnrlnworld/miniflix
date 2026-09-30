#!/usr/bin/env bash
# MP4 원본 → fMP4(CMAF) HLS. 비디오 렌디션과 오디오 렌디션을 분리해 오디오는 1벌만 저장.
# 사용: scripts/encode-fmp4.sh <input.mp4> <slug> [--ladder 1080|720]
#   --ladder 1080 (기본): 1080p/720p/480p
#   --ladder 720        : 720p/480p (단편·구형 소스용)
# 출력: media/hls/<slug>/{master.m3u8, <res>p/{init.mp4,seg_*.m4s,index.m3u8}, audio/{init.mp4,seg_*.m4s,index.m3u8}}
set -euo pipefail

INPUT="${1:-}"
SLUG="${2:-}"
LADDER="1080"
shift 2 || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --ladder) LADDER="${2:-}"; shift 2 ;;
    *) echo "unknown option: $1" >&2; exit 1 ;;
  esac
done

[[ -z "$INPUT" || -z "$SLUG" ]] && { echo "usage: $0 <input.mp4> <slug> [--ladder 1080|720]" >&2; exit 1; }
[[ -f "$INPUT" ]] || { echo "input not found: $INPUT" >&2; exit 1; }
[[ "$SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || { echo "slug must be lowercase alnum + hyphen: $SLUG" >&2; exit 1; }
[[ "$LADDER" == "1080" || "$LADDER" == "720" ]] || { echo "ladder must be 1080 or 720" >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg not installed" >&2; exit 1; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/media/hls/$SLUG"
[[ -e "$OUT" ]] && { echo "output exists, remove first: $OUT" >&2; exit 1; }

FPS="$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$INPUT" | awk -F/ '{printf "%d", $1/$2}')"
GOP=$((FPS * 2))

SCALE="force_original_aspect_ratio=decrease:force_divisible_by=2"
if [[ "$LADDER" == "1080" ]]; then
  mkdir -p "$OUT"/{1080p,720p,480p,audio}
  FILTER="[0:v]split=3[v1][v2][v3];[v1]scale=w=1920:h=1080:$SCALE[v1o];[v2]scale=w=1280:h=720:$SCALE[v2o];[v3]scale=w=854:h=480:$SCALE[v3o]"
  MAPS=(-map "[v1o]" -map "[v2o]" -map "[v3o]" -map 0:a:0)
  RATES=(-b:v:0 3000k -maxrate:v:0 3200k -bufsize:v:0 6000k
         -b:v:1 1500k -maxrate:v:1 1600k -bufsize:v:1 3000k
         -b:v:2  800k -maxrate:v:2  860k -bufsize:v:2 1600k)
  VSM="v:0,agroup:aud,name:1080p v:1,agroup:aud,name:720p v:2,agroup:aud,name:480p a:0,agroup:aud,default:yes,name:audio"
else
  mkdir -p "$OUT"/{720p,480p,audio}
  FILTER="[0:v]split=2[v1][v2];[v1]scale=w=1280:h=720:$SCALE[v1o];[v2]scale=w=854:h=480:$SCALE[v2o]"
  MAPS=(-map "[v1o]" -map "[v2o]" -map 0:a:0)
  RATES=(-b:v:0 1500k -maxrate:v:0 1600k -bufsize:v:0 3000k
         -b:v:1  800k -maxrate:v:1  860k -bufsize:v:1 1600k)
  VSM="v:0,agroup:aud,name:720p v:1,agroup:aud,name:480p a:0,agroup:aud,default:yes,name:audio"
fi

# 세그먼트 6초, GOP 2초. fMP4 는 init.mp4(헤더) + seg_*.m4s(미디어 프래그먼트).
ffmpeg -hide_banner -y -i "$INPUT" \
  -filter_complex "$FILTER" \
  "${MAPS[@]}" \
  -c:v libx264 -preset fast -profile:v main -pix_fmt yuv420p \
  -g "$GOP" -keyint_min "$GOP" -sc_threshold 0 \
  "${RATES[@]}" \
  -c:a aac -b:a 128k -ac 2 \
  -var_stream_map "$VSM" \
  -f hls -hls_time 6 -hls_playlist_type vod -hls_flags independent_segments \
  -hls_segment_type fmp4 -hls_fmp4_init_filename init.mp4 \
  -hls_segment_filename "$OUT/%v/seg_%03d.m4s" \
  -master_pl_name master.m3u8 \
  "$OUT/%v/index.m3u8"

DURATION="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$INPUT")"
echo
echo "done: $OUT"
echo "duration_sec: $DURATION"
du -sh "$OUT"/*/ "$OUT"
