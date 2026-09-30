import { useEffect, useMemo, useState } from "react";

/** 시크 썸네일 cue. 스프라이트 시트의 (x, y, w, h) 타일. */
export type ThumbCue = {
  start: number;
  end: number;
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

const EMPTY: ThumbCue[] = [];
const TIME_RE =
  /^(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s+-->\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})/;
const XYWH_RE = /^(\S+)#xywh=(\d+),(\d+),(\d+),(\d+)$/;

function toSec(h: string, m: string, s: string, ms: string) {
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
}

/** WebVTT(#xywh) → cue 배열. 스프라이트 경로는 VTT URL 기준 상대경로. */
export function parseThumbsVtt(text: string, baseUrl: string): ThumbCue[] {
  const lines = text.split(/\r?\n/);
  const cues: ThumbCue[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const t = TIME_RE.exec(lines[i]);
    if (!t) continue;
    const m = XYWH_RE.exec(lines[i + 1].trim());
    if (!m) continue;
    cues.push({
      start: toSec(t[1], t[2], t[3], t[4]),
      end: toSec(t[5], t[6], t[7], t[8]),
      src: new URL(m[1], baseUrl).href,
      x: Number(m[2]),
      y: Number(m[3]),
      w: Number(m[4]),
      h: Number(m[5]),
    });
    i++;
  }
  return cues;
}

/**
 * 썸네일 VTT 를 받아 파싱하고 스프라이트를 미리 받아 둔다.
 * url 이 없으면 빈 배열. 실패해도 조용히 빈 배열 (프리뷰는 시간만 표시).
 */
export function useThumbnails(url: string | undefined) {
  // url 별로 저장해 url 이 바뀌면 이전 결과를 자동으로 무시한다.
  const [loaded, setLoaded] = useState<{ url: string; cues: ThumbCue[] }>();
  const cues = useMemo(
    () => (url && loaded?.url === url ? loaded.cues : EMPTY),
    [url, loaded],
  );

  useEffect(() => {
    if (!url) return;
    const ctrl = new AbortController();
    fetch(url, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(r.statusText))))
      .then((text) => {
        const parsed = parseThumbsVtt(text, url);
        setLoaded({ url, cues: parsed });
        for (const src of new Set(parsed.map((c) => c.src))) {
          new Image().src = src;
        }
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [url]);

  const lookup = useMemo(() => {
    return (time: number): ThumbCue | null => {
      if (!cues.length) return null;
      let lo = 0;
      let hi = cues.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (cues[mid].start <= time) lo = mid;
        else hi = mid - 1;
      }
      const c = cues[lo];
      return c.start <= time && time < c.end ? c : (cues[lo] ?? null);
    };
  }, [cues]);

  return { cues, lookup };
}
