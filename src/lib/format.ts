export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
  return `${m}분`;
}

/** [1080, 720, 480] → "1080p · 720p · 480p". 비어 있으면 null. */
export function formatRenditions(heights: number[]): string | null {
  if (!heights.length) return null;
  return [...new Set(heights)]
    .sort((a, b) => b - a)
    .map((h) => `${h}p`)
    .join(" · ");
}
