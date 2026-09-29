import { useEffect, useRef, type RefObject } from "react";

const INTERVAL_MS = 10_000;
const MIN_DELTA_SEC = 3;

export function useWatchProgress(
  videoRef: RefObject<HTMLVideoElement | null>,
  contentId: string | undefined,
) {
  const lastSaved = useRef(-1);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !contentId) return;
    const url = `/api/watch/${contentId}`;

    const payload = () =>
      JSON.stringify({
        positionSec: video.currentTime,
        durationSec: video.duration,
      });
    const shouldSave = (force: boolean) =>
      Number.isFinite(video.duration) &&
      video.duration > 0 &&
      (force ||
        Math.abs(video.currentTime - lastSaved.current) >= MIN_DELTA_SEC);

    const save = (force = false) => {
      if (!shouldSave(force)) return;
      lastSaved.current = video.currentTime;
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload(),
        keepalive: true,
      }).catch(() => {});
    };
    const beacon = () => {
      if (!shouldSave(true)) return;
      lastSaved.current = video.currentTime;
      navigator.sendBeacon(
        url,
        new Blob([payload()], { type: "application/json" }),
      );
    };

    const timer = window.setInterval(() => {
      if (!video.paused && !video.ended) save();
    }, INTERVAL_MS);
    const onPause = () => save(true);
    const onEnded = () => save(true);
    const onHidden = () => {
      if (document.visibilityState === "hidden") beacon();
    };
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", beacon);

    return () => {
      window.clearInterval(timer);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", beacon);
      beacon();
    };
  }, [videoRef, contentId]);
}
