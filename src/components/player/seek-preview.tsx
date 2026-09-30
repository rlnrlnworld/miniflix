/* Hallmark · component: seek-preview (tooltip) · genre: editorial · theme: project tokens (paper/ink/accent)
 * states: hidden · visible · loading (sprite not yet decoded → paper-2 box) · no-thumbs (time only)
 * contrast: ink on paper-2 ≥ 7:1
 */
import type { ThumbCue } from "./use-thumbnails";

type Props = {
  /** 프리뷰가 가리키는 시각(초). */
  time: number;
  /** 프로그레스바 기준 x 픽셀. */
  x: number;
  /** 프로그레스바 전체 폭 픽셀. 좌우 클램프에 사용. */
  width: number;
  cue: ThumbCue | null;
  label: string;
};

/**
 * 프로그레스바 위에 뜨는 시크 프리뷰. 썸네일이 있으면 스프라이트 타일 + 시각,
 * 없으면 시각만. 위치는 포인터를 따르되 바 밖으로 나가지 않게 클램프.
 */
export function SeekPreview({ x, width, cue, label }: Props) {
  const boxW = cue ? cue.w : 0;
  const half = Math.max(boxW, 56) / 2;
  const left = Math.min(Math.max(x, half), Math.max(width - half, half));

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-full mb-3 flex -translate-x-1/2 flex-col items-center gap-1.5"
      style={{ left }}
    >
      {cue && (
        <div
          className="bg-paper-2 ring-ink/15 overflow-hidden rounded-md shadow-lg ring-1"
          style={{
            width: cue.w,
            height: cue.h,
            backgroundImage: `url("${cue.src}")`,
            backgroundPosition: `-${cue.x}px -${cue.y}px`,
            backgroundRepeat: "no-repeat",
          }}
        />
      )}
      <span className="bg-paper-2/90 text-ink rounded px-1.5 py-0.5 text-xs font-medium tabular-nums backdrop-blur">
        {label}
      </span>
    </div>
  );
}
