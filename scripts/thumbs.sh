#!/usr/bin/env bash
# 시크 썸네일: 로컬 HLS 480p 렌디션 → 스프라이트(webp) + thumbs.vtt (#xywh)
# 사용: scripts/thumbs.sh <slug> [interval_sec=5]
# 출력: media/hls/<slug>/thumbs/{sprite_000.webp, ..., thumbs.vtt}
# 업로드: pnpm upload <slug> thumbs --public
set -euo pipefail

SLUG="${1:-}"
INTERVAL="${2:-5}"
[[ -z "$SLUG" ]] && { echo "usage: $0 <slug> [interval_sec]" >&2; exit 1; }
[[ "$SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || { echo "bad slug: $SLUG" >&2; exit 1; }
[[ "$INTERVAL" =~ ^[0-9]+$ && "$INTERVAL" -gt 0 ]] || { echo "bad interval: $INTERVAL" >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg not installed" >&2; exit 1; }
command -v cwebp >/dev/null || { echo "cwebp not installed (brew install webp)" >&2; exit 1; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INPUT="$ROOT/media/hls/$SLUG/480p/index.m3u8"
OUT="$ROOT/media/hls/$SLUG/thumbs"
[[ -f "$INPUT" ]] || { echo "input not found: $INPUT (encode first)" >&2; exit 1; }
[[ -e "$OUT" ]] && { echo "output exists, remove first: $OUT" >&2; exit 1; }
mkdir -p "$OUT"

# 타일 160x90, 스프라이트당 10x10 = 100장. 레터박스 소스는 pad 로 16:9 고정.
W=160; H=90; COLS=10; ROWS=10
PER=$((COLS * ROWS))

ffmpeg -hide_banner -loglevel error -y -i "$INPUT" \
  -vf "fps=1/$INTERVAL,scale=$W:$H:force_original_aspect_ratio=decrease,pad=$W:$H:(ow-iw)/2:(oh-ih)/2,tile=${COLS}x${ROWS}" \
  -start_number 0 "$OUT/sprite_%03d.png"

for png in "$OUT"/sprite_*.png; do
  cwebp -quiet -q 70 "$png" -o "${png%.png}.webp"
  rm "$png"
done

DURATION="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$INPUT")"
COUNT="$(awk -v d="$DURATION" -v i="$INTERVAL" 'BEGIN{printf "%d", (d + i - 1) / i}')"

fmt() { # 초 → HH:MM:SS.000
  local s=$1
  printf "%02d:%02d:%02d.000" $((s / 3600)) $((s % 3600 / 60)) $((s % 60))
}

{
  echo "WEBVTT"
  echo
  for ((i = 0; i < COUNT; i++)); do
    start=$((i * INTERVAL))
    end=$(((i + 1) * INTERVAL))
    sprite=$((i / PER))
    idx=$((i % PER))
    x=$(((idx % COLS) * W))
    y=$(((idx / COLS) * H))
    printf "%s --> %s\nsprite_%03d.webp#xywh=%d,%d,%d,%d\n\n" \
      "$(fmt "$start")" "$(fmt "$end")" "$sprite" "$x" "$y" "$W" "$H"
  done
} > "$OUT/thumbs.vtt"

echo "done: $OUT"
echo "cues: $COUNT (every ${INTERVAL}s), sprites: $(ls "$OUT"/sprite_*.webp | wc -l | tr -d ' ')"
du -sh "$OUT"
