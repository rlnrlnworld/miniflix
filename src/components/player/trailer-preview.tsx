"use client";

import type Hls from "hls.js";
import { useEffect, useRef, useState } from "react";

/**
 * 종료 화면 배경용 무음 예고편. 첫 프레임이 나오면 포스터 위로 페이드인.
 * 공개 버킷 HLS 라 인증 헤더 없음. 실패하면 조용히 투명 상태 유지(포스터가 보임).
 */
export function TrailerPreview({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let hls: Hls | null = null;
    let disposed = false;
    (async () => {
      const { default: HlsCtor } = await import("hls.js");
      if (disposed) return;
      if (HlsCtor.isSupported()) {
        hls = new HlsCtor({ startLevel: 0 });
        hls.loadSource(src);
        hls.attachMedia(video);
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
      } else {
        return;
      }
      video.play().catch(() => {});
    })();
    return () => {
      disposed = true;
      hls?.destroy();
    };
  }, [src]);

  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      aria-hidden="true"
      onPlaying={() => setReady(true)}
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[var(--dur-slow)] ease-[var(--ease-out)] ${ready ? "opacity-100" : "opacity-0"}`}
    />
  );
}
