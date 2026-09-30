"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type Hls from "hls.js";
import { storageAuthenticatedPrefix } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { supabaseEnv } from "@/lib/supabase/env";
import { SeekPreview } from "./seek-preview";
import { TrailerPreview } from "./trailer-preview";
import { useThumbnails } from "./use-thumbnails";
import { useWatchProgress } from "./use-watch-progress";

export type SubtitleTrack = {
  lang: string;
  label: string;
  src: string;
  isDefault: boolean;
};

type Props = {
  title: string;
  description?: string | null;
  mode?: "full" | "trailer";
  loginHref?: string;
  historyContentId?: string;
  src: string;
  poster?: string;
  subtitles: SubtitleTrack[];
  startAt?: number;
  /** 시크 썸네일 VTT(#xywh) URL. 없으면 프리뷰에 시각만 표시. */
  thumbnails?: string;
  /**
   * 엔딩 크레딧 시작(초). 이 시점부터 다음 화 버튼(시리즈) 또는 포스트플레이 화면(단편·마지막 화)이 뜨고
   * NEXT_AUTOPLAY_MS 뒤 자동 이동. null 이면 끝나기 NEXT_PROMPT_BEFORE_END_SEC 전.
   */
  creditsStartSec?: number | null;
  /** 같은 시리즈의 에피소드 목록(회차순). 2개 이상일 때 컨트롤 바에 메뉴가 뜬다. */
  episodes?: {
    href: string;
    title: string;
    episodeNo: number;
    durationSec: number;
    image: string | null;
    current: boolean;
  }[];
  /** 종료 카드. 다음 화 또는 추천 1편. null 이면 "다시 보기"만. */
  endCard?: {
    href: string;
    detailHref: string | null;
    eyebrow: string;
    title: string;
    meta: string;
    description: string | null;
    image: string | null;
    /** 포스트플레이 배경 무음 예고편(HLS). */
    trailer: string | null;
    cta: string;
  } | null;
};

const NEXT_AUTOPLAY_MS = 10_000;
const NEXT_PROMPT_BEFORE_END_SEC = 30;
type NextPrompt = "hidden" | "counting" | "cancelled";

type SeekHover = { time: number; x: number; width: number };

type Level = { index: number; height: number; bitrate: number };
type Status = "loading" | "ready" | "error";
type Engine = "hls.js" | "native" | "unsupported";
type Menu = "quality" | "subtitle" | "rate" | "episodes" | null;

const AUTO = -1;
const HIDE_DELAY = 2500;
const INFO_DELAY = 100;
const RELOAD_COOLDOWN_MS = 30_000;
const VOLUME_KEY = "miniflix:volume";
const VOLUME_STEP = 0.05;

function readStoredVolume(): number {
  try {
    const v = Number(localStorage.getItem(VOLUME_KEY));
    return Number.isFinite(v) && v > 0 && v <= 1 ? v : 1;
  } catch {
    return 1;
  }
}
function storeVolume(v: number) {
  try {
    localStorage.setItem(VOLUME_KEY, String(v));
  } catch {}
}
const SUBTITLE_PRIORITY = ["ko", "en"];
const STREAM_PREFIX = "/api/stream/";

/** 네이티브 HLS 는 요청 헤더를 못 붙이므로 서버에 서명 URL 모드를 요청한다. */
function nativeSrc(src: string): string {
  if (!src.startsWith(STREAM_PREFIX)) return src;
  return `${src}${src.includes("?") ? "&" : "?"}native=1`;
}

/**
 * private 버킷 세그먼트 요청에 사용자 JWT 를 싣는다.
 * Storage RLS 가 검증하므로 URL 이 유출돼도 세션 없이는 403.
 */
function createAuthXhrSetup() {
  const supabase = createClient();
  const prefix = storageAuthenticatedPrefix(supabaseEnv().url);
  return async (xhr: XMLHttpRequest, url: string) => {
    if (!url.startsWith(prefix)) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    xhr.open("GET", url, true);
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
  };
}

function defaultSubtitle(subtitles: SubtitleTrack[]): string {
  const explicit = subtitles.find((s) => s.isDefault);
  if (explicit) return explicit.lang;
  for (const lang of SUBTITLE_PRIORITY) {
    if (subtitles.some((s) => s.lang === lang)) return lang;
  }
  return "off";
}

async function autoplay(video: HTMLVideoElement, onMutedFallback: () => void) {
  try {
    await video.play();
  } catch {
    video.muted = true;
    onMutedFallback();
    video.play().catch(() => {});
  }
}
const SEEK_STEP = 10;
const CUE_BOTTOM_PLAIN_PX = 40;
const CUE_BOTTOM_CHROME_PX = 100;
const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatTime(sec: number): string {
  if (!Number.isFinite(sec)) return "0:00";
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(r).padStart(2, "0")}`;
}

export function HlsPlayer({
  title,
  description,
  src,
  poster,
  subtitles,
  startAt,
  mode = "full",
  loginHref = "/login",
  historyContentId,
  thumbnails,
  episodes = [],
  endCard = null,
  creditsStartSec = null,
}: Props) {
  const router = useRouter();
  // 프롬프트 트리거 정보(video 이벤트 핸들러에서 읽음): 크레딧 시작 + 자동 이동 대상 존재 여부.
  const promptInfoRef = useRef({
    creditsStartSec,
    hasTarget: Boolean(endCard),
  });
  useEffect(() => {
    promptInfoRef.current = { creditsStartSec, hasTarget: Boolean(endCard) };
  }, [creditsStartSec, endCard]);
  const reducedMotion = useReducedMotion();
  // 다음 화 프롬프트 상태. ref 는 video 이벤트 핸들러(의존성 없는 effect)에서 읽기 위해.
  const [nextPrompt, setNextPrompt] = useState<NextPrompt>("hidden");
  const nextPromptRef = useRef<NextPrompt>("hidden");
  useEffect(() => {
    nextPromptRef.current = nextPrompt;
  }, [nextPrompt]);
  const navigatedRef = useRef(false);
  const currentEpisodeRef = useRef<HTMLLIElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const menuId = useId();

  const [engine, setEngine] = useState<Engine>("hls.js");
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [selected, setSelected] = useState<number>(AUTO);
  const [playing, setPlaying] = useState<Level | null>(null);
  const [subtitle, setSubtitle] = useState<string>(() =>
    defaultSubtitle(subtitles),
  );
  const [menu, setMenu] = useState<Menu>(null);
  useEffect(() => {
    if (menu === "episodes")
      currentEpisodeRef.current?.scrollIntoView({
        inline: "center",
        block: "nearest",
      });
  }, [menu]);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [infoVisible, setInfoVisible] = useState(false);

  const [paused, setPaused] = useState(true);
  const [waiting, setWaiting] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [volumeSupported, setVolumeSupported] = useState(true);
  const lastVolume = useRef(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [rate, setRate] = useState(1);
  const [ended, setEnded] = useState(false);
  const [mutedHint, setMutedHint] = useState(false);
  const [seekHover, setSeekHover] = useState<SeekHover | null>(null);
  const { lookup: lookupThumb } = useThumbnails(thumbnails);

  useWatchProgress(videoRef, mode === "full" ? historyContentId : undefined);

  // 마우스는 호버 중, 터치는 드래그 중에만 프리뷰.
  const updateSeekHover = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!duration) return;
      if (e.pointerType !== "mouse" && e.buttons === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
      setSeekHover({
        time: (x / rect.width) * duration,
        x,
        width: rect.width,
      });
    },
    [duration],
  );
  const clearSeekHover = useCallback(() => setSeekHover(null), []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let disposed = false;

    async function attach() {
      const { default: Hls } = await import("hls.js");
      if (disposed || !video) return;

      if (Hls.isSupported()) {
        const hls = new Hls({
          startPosition: startAt ?? -1,
          xhrSetup: src.startsWith(STREAM_PREFIX)
            ? createAuthXhrSetup()
            : undefined,
        });
        hlsRef.current = hls;
        hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
          setLevels(
            data.levels.map((l, i) => ({
              index: i,
              height: l.height,
              bitrate: l.bitrate,
            })),
          );
          setStatus("ready");
          autoplay(video, () => setMutedHint(true));
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
          const l = hls.levels[data.level];
          if (l)
            setPlaying({
              index: data.level,
              height: l.height,
              bitrate: l.bitrate,
            });
        });
        let lastReload = 0;
        // 401/403: 세션 만료 등. 플레이리스트부터 다시 받는다.
        const reloadSource = () => {
          const now = Date.now();
          if (now - lastReload < RELOAD_COOLDOWN_MS) return false;
          lastReload = now;
          const t = video.currentTime;
          const wasPaused = video.paused;
          hls.once(Hls.Events.MANIFEST_PARSED, () => {
            video.currentTime = t;
            if (!wasPaused) video.play().catch(() => {});
          });
          hls.loadSource(src);
          return true;
        };
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            const code = data.response?.code;
            if (
              (code === 400 || code === 401 || code === 403) &&
              reloadSource()
            )
              return;
            hls.startLoad();
            return;
          }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
            return;
          }
          setErrorMsg(
            "재생할 수 없습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.",
          );
          setStatus("error");
        });
        hls.loadSource(src);
        hls.attachMedia(video);
        return;
      }

      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        setEngine("native");
        video.src = nativeSrc(src);
        if (startAt) video.currentTime = startAt;
        setStatus("ready");
        autoplay(video, () => setMutedHint(true));
        return;
      }

      setEngine("unsupported");
      setErrorMsg("이 브라우저는 HLS 재생을 지원하지 않습니다.");
      setStatus("error");
    }

    attach();
    return () => {
      disposed = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [src, startAt]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const initial = readStoredVolume();
    video.volume = initial;
    lastVolume.current = initial;
    setVolume(video.volume);
    if (video.volume !== initial) setVolumeSupported(false);
    const onTime = () => {
      setCurrentTime(video.currentTime);
      const info = promptInfoRef.current;
      if (
        !info.hasTarget ||
        !Number.isFinite(video.duration) ||
        !video.duration
      )
        return;
      const promptAt =
        info.creditsStartSec ??
        Math.max(0, video.duration - NEXT_PROMPT_BEFORE_END_SEC);
      const state = nextPromptRef.current;
      if (video.currentTime >= promptAt && state === "hidden") {
        setNextPrompt("counting");
      } else if (video.currentTime < promptAt - 1 && state !== "hidden") {
        setNextPrompt("hidden");
      }
    };
    const onDuration = () => setDuration(video.duration);
    const onProgress = () => {
      const b = video.buffered;
      if (b.length) setBuffered(b.end(b.length - 1));
    };
    const onPlay = () => {
      setPaused(false);
      setInfoVisible(false);
    };
    const onPause = () => setPaused(true);
    const onWaiting = () => setWaiting(true);
    const onPlaying = () => setWaiting(false);
    const onVolume = () => {
      setMuted(video.muted);
      if (!video.muted) setMutedHint(false);
      setVolume(video.volume);
      if (video.volume > 0) lastVolume.current = video.volume;
    };
    const onRate = () => setRate(video.playbackRate);
    const onEnded = () => {
      setEnded(true);
      setInfoVisible(false);
    };
    const onSeeking = () => setEnded(false);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("durationchange", onDuration);
    video.addEventListener("progress", onProgress);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("volumechange", onVolume);
    video.addEventListener("ratechange", onRate);
    video.addEventListener("ended", onEnded);
    video.addEventListener("seeking", onSeeking);
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("durationchange", onDuration);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("volumechange", onVolume);
      video.removeEventListener("ratechange", onRate);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("seeking", onSeeking);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    for (const track of Array.from(video.textTracks)) {
      track.mode = track.language === subtitle ? "showing" : "hidden";
    }
  }, [subtitle, status]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const apply = () => {
      const height = video.clientHeight || 1;
      const bottomPx = chromeVisible
        ? CUE_BOTTOM_CHROME_PX
        : CUE_BOTTOM_PLAIN_PX;
      const line = Math.max(50, Math.min(96, 100 - (bottomPx / height) * 100));
      for (const track of Array.from(video.textTracks)) {
        for (const cue of Array.from(track.cues ?? [])) {
          const c = cue as VTTCue;
          c.snapToLines = false;
          c.lineAlign = "end";
          c.line = line;
        }
      }
    };
    apply();
    const tracks = Array.from(video.querySelectorAll("track"));
    tracks.forEach((t) => t.addEventListener("load", apply));
    window.addEventListener("resize", apply);
    return () => {
      tracks.forEach((t) => t.removeEventListener("load", apply));
      window.removeEventListener("resize", apply);
    };
  }, [chromeVisible, subtitle, status]);

  // 다음 화 자동 이동: 버튼이 뜬 뒤 NEXT_AUTOPLAY_MS 경과, 또는 취소하지 않은 채 영상 종료.
  // 일시정지 중엔 카운트다운도 멈춘다. 남은 시간은 ref 에 누적.
  const nextRemainingRef = useRef(NEXT_AUTOPLAY_MS);
  useEffect(() => {
    if (nextPrompt !== "counting") nextRemainingRef.current = NEXT_AUTOPLAY_MS;
  }, [nextPrompt]);
  const autoHref = endCard?.href ?? null;
  useEffect(() => {
    if (mode !== "full" || !autoHref || nextPrompt === "cancelled") return;
    const go = () => {
      if (navigatedRef.current) return;
      navigatedRef.current = true;
      router.push(autoHref);
    };
    if (ended) {
      go();
      return;
    }
    if (nextPrompt !== "counting" || paused) return;
    const startedAt = performance.now();
    const t = window.setTimeout(go, nextRemainingRef.current);
    return () => {
      window.clearTimeout(t);
      nextRemainingRef.current = Math.max(
        0,
        nextRemainingRef.current - (performance.now() - startedAt),
      );
    };
  }, [mode, autoHref, nextPrompt, ended, paused, router]);

  const replay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.play().catch(() => {});
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }, []);

  const seekBy = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(
      Math.max(0, video.currentTime + delta),
      video.duration || 0,
    );
  }, []);

  const setVolumeTo = useCallback((v: number) => {
    const video = videoRef.current;
    if (!video) return;
    const next = Math.min(1, Math.max(0, v));
    video.volume = next;
    video.muted = next === 0;
    if (next > 0) storeVolume(next);
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.muted || video.volume === 0) {
      video.muted = false;
      if (video.volume === 0) video.volume = lastVolume.current || 0.5;
    } else {
      video.muted = true;
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current?.requestFullscreen?.();
  }, []);

  const selectRate = useCallback((r: number) => {
    const video = videoRef.current;
    if (video) video.playbackRate = r;
    setMenu(null);
  }, []);

  const selectLevel = useCallback((index: number) => {
    setSelected(index);
    if (hlsRef.current) hlsRef.current.currentLevel = index;
    setMenu(null);
  }, []);

  const showChrome = useCallback(() => {
    setChromeVisible(true);
    setInfoVisible(false);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (!menu) setChromeVisible(false);
    }, HIDE_DELAY);
  }, [menu]);

  useEffect(() => {
    hideTimer.current = window.setTimeout(() => {
      if (!menu) setChromeVisible(false);
    }, HIDE_DELAY);
    return () => window.clearTimeout(hideTimer.current);
  }, [menu]);

  useEffect(() => {
    if (!paused || ended || chromeVisible || status !== "ready") return;
    const t = window.setTimeout(() => setInfoVisible(true), INFO_DELAY);
    return () => window.clearTimeout(t);
  }, [paused, ended, chromeVisible, status]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // 상세 모달이 열려 플레이어가 inert 상태면 단축키 무시 (window 리스너라 직접 걸러야 함).
      if (rootRef.current?.closest("[inert]")) return;
      if (e.target instanceof HTMLInputElement) return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          seekBy(-SEEK_STEP);
          break;
        case "ArrowRight":
          seekBy(SEEK_STEP);
          break;
        case "m":
          toggleMute();
          break;
        case "ArrowUp":
          e.preventDefault();
          setVolumeTo((videoRef.current?.volume ?? 1) + VOLUME_STEP);
          break;
        case "ArrowDown":
          e.preventDefault();
          setVolumeTo((videoRef.current?.volume ?? 1) - VOLUME_STEP);
          break;
        case "f":
          toggleFullscreen();
          break;
        case "Escape":
          setMenu(null);
          break;
        default:
          return;
      }
      showChrome();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    togglePlay,
    seekBy,
    toggleMute,
    toggleFullscreen,
    setVolumeTo,
    showChrome,
  ]);

  const levelsDesc = [...levels].sort((a, b) => b.height - a.height);
  // 종료 오버레이(트레일러 로그인 유도 / 추천 / 다음 화)가 뜨면 컨트롤·힌트 버튼은 모두 숨긴다.
  const episodesOpen = menu === "episodes" && episodes.length > 1;
  // 포스트플레이: 크레딧 구간. 본편은 오른쪽 아래로 축소되고 다음 화(시리즈) 또는 추천작(단편·마지막 화)이 뜬다.
  const postPlay =
    mode === "full" && Boolean(endCard) && (nextPrompt === "counting" || ended);
  // 크레딧이 끝난 뒤의 정지 상태: 카운트다운 없음, 축소 영상 위에 다시 보기.
  const postPlayEnded = postPlay && ended;
  const chromeClass =
    chromeVisible && !ended && !postPlay
      ? "opacity-100"
      : "pointer-events-none opacity-0";
  const chromeTransition =
    "transition-opacity duration-[var(--dur-slow)] ease-[var(--ease-out)]";
  const progress = duration ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={rootRef}
      className={`relative flex h-dvh w-full flex-col bg-black ${chromeVisible || ended || postPlay ? "" : "cursor-none"}`}
      onMouseMove={showChrome}
      onTouchStart={showChrome}
      onPointerDown={(e) => {
        if (menu && !(e.target as HTMLElement).closest("[data-menu]"))
          setMenu(null);
      }}
    >
      <video
        ref={videoRef}
        className={`relative h-full w-full origin-bottom-right object-contain transition-transform duration-[var(--dur-slow)] ease-[var(--ease-out)] ${
          postPlay
            ? "z-20 [transform:translate(-1.5rem,-1.5rem)_scale(0.3)] cursor-pointer sm:[transform:translate(-4rem,-2rem)_scale(0.22)]"
            : ""
        }`}
        poster={poster}
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        onClick={
          postPlayEnded
            ? replay
            : postPlay
              ? () => setNextPrompt("cancelled")
              : togglePlay
        }
        title={
          postPlayEnded ? "다시 보기" : postPlay ? "크레딧 보기" : undefined
        }
      >
        {subtitles.map((s) => (
          <track
            key={s.lang}
            kind="subtitles"
            srcLang={s.lang}
            label={s.label}
            src={s.src}
            default={s.lang === subtitle}
          />
        ))}
      </video>

      <header
        className={`absolute inset-x-0 top-0 flex items-center gap-3 bg-linear-to-b from-black/80 to-transparent px-4 pt-3 pb-10 ${chromeTransition} ${chromeClass}`}
      >
        <Link
          href="/"
          aria-label="홈으로"
          className="text-ink hover:bg-paper-3 active:bg-paper-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-[var(--dur-base)]"
        >
          <Icon name="back" />
        </Link>
        <h1 className="text-ink min-w-0 flex-1 truncate text-base font-semibold sm:text-lg">
          {title}
        </h1>
        {mode === "trailer" && (
          <Link
            href={loginHref}
            className="bg-accent inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold text-white transition-[filter] duration-[var(--dur-base)] hover:brightness-110 active:translate-y-px"
          >
            로그인하여 전체 보기
          </Link>
        )}
      </header>

      {(status === "loading" || waiting) && status !== "error" && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <span className="border-ink/30 border-t-ink size-10 animate-spin rounded-full border-2" />
          <span className="sr-only">불러오는 중</span>
        </div>
      )}

      <div
        aria-hidden={!infoVisible}
        className={`pointer-events-none absolute inset-0 flex flex-col justify-end bg-linear-to-t from-black/90 via-black/60 to-black/30 px-6 pb-24 sm:justify-center sm:px-16 sm:pb-0 ${chromeTransition} ${infoVisible ? "opacity-100" : "opacity-0"}`}
      >
        <p className="text-ink-2 mb-3 text-sm font-medium tracking-wide sm:text-base">
          지금 시청 중
        </p>
        <h2 className="text-ink max-w-3xl text-4xl font-bold tracking-tight [overflow-wrap:anywhere] sm:text-6xl">
          {title}
        </h2>
        {description && (
          <p className="text-ink-2 mt-4 max-w-xl text-base leading-relaxed break-keep sm:text-lg">
            {description}
          </p>
        )}
        <p className="text-muted mt-6 text-sm">일시정지됨</p>
        {mode === "trailer" && (
          <Link
            href={loginHref}
            className={`bg-accent mt-6 inline-flex h-12 w-fit items-center self-start rounded-full px-6 text-base font-semibold text-white transition-[filter] duration-[var(--dur-base)] hover:brightness-110 active:translate-y-px ${infoVisible ? "pointer-events-auto" : ""}`}
          >
            로그인하여 전체 보기
          </Link>
        )}
      </div>

      {status === "ready" && paused && !waiting && !infoVisible && !ended && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="재생"
          className="text-ink hover:bg-paper-3/90 absolute top-1/2 left-1/2 flex size-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 backdrop-blur transition-[background-color,transform] duration-[var(--dur-base)] active:scale-95"
        >
          <Icon name="play" size={36} />
        </button>
      )}

      <div
        className={`absolute inset-x-0 bottom-0 flex flex-col justify-end gap-2 px-4 pt-12 pb-4 transition-[opacity,background-color,min-height] duration-[var(--dur-slow)] ease-[var(--ease-out)] ${
          episodesOpen
            ? "min-h-[30dvh] bg-linear-to-t from-black/85 via-black/80 via-75% to-transparent"
            : "bg-linear-to-t from-black/85 to-transparent"
        } ${chromeClass}`}
      >
        {episodes.length > 1 && (
          <div
            data-menu
            inert={!episodesOpen}
            aria-hidden={!episodesOpen}
            className={`-mx-4 grid transition-[grid-template-rows,opacity,translate] duration-[var(--dur-slow)] ease-[var(--ease-out)] ${
              episodesOpen
                ? "translate-y-0 grid-rows-[1fr] opacity-100"
                : "-translate-y-2 grid-rows-[0fr] opacity-0"
            }`}
          >
            <ul
              aria-label="에피소드"
              className="flex min-h-0 snap-x gap-3 overflow-x-auto overflow-y-hidden px-4 pt-1 pb-3"
            >
              {episodes.map((e) => (
                <li
                  key={e.href}
                  ref={e.current ? currentEpisodeRef : undefined}
                  className="w-40 shrink-0 snap-start sm:w-52"
                >
                  <Link
                    href={e.href}
                    aria-current={e.current ? "true" : undefined}
                    onClick={() => setMenu(null)}
                    className="group block"
                  >
                    <div
                      className={`bg-paper-2 relative aspect-video overflow-hidden rounded-lg ring-1 ${e.current ? "ring-accent ring-2" : "ring-white/10"}`}
                    >
                      {e.image && (
                        <Image
                          src={e.image}
                          alt=""
                          fill
                          sizes="208px"
                          className="object-cover transition-transform duration-[var(--dur-slow)] ease-[var(--ease-out)] group-hover:scale-105"
                        />
                      )}
                      <span className="text-ink absolute top-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-semibold">
                        {e.episodeNo}화
                      </span>
                      {e.current && (
                        <span className="bg-accent absolute top-2 right-2 rounded px-1.5 py-0.5 text-xs font-semibold text-white">
                          재생 중
                        </span>
                      )}
                    </div>
                    <p className="text-ink mt-1.5 truncate text-sm font-medium">
                      {e.title}
                    </p>
                    <p className="text-muted text-xs">
                      {formatTime(e.durationSec)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div
          className="group relative h-6 w-full"
          onPointerMove={updateSeekHover}
          onPointerDown={updateSeekHover}
          onPointerUp={(e) => {
            if (e.pointerType !== "mouse") clearSeekHover();
          }}
          onPointerLeave={clearSeekHover}
          onPointerCancel={clearSeekHover}
        >
          {seekHover && status === "ready" && (
            <SeekPreview
              time={seekHover.time}
              x={seekHover.x}
              width={seekHover.width}
              cue={lookupThumb(seekHover.time)}
              label={formatTime(seekHover.time)}
            />
          )}
          <div className="bg-ink/20 absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full">
            <div
              className="bg-ink/35 absolute inset-y-0 left-0"
              style={{ width: `${bufferedPct}%` }}
            />
            <div
              className="bg-accent absolute inset-y-0 left-0"
              style={{ width: `${progress}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            aria-label="재생 위치"
            aria-valuetext={`${formatTime(currentTime)} / ${formatTime(duration)}`}
            onChange={(e) => {
              const video = videoRef.current;
              if (video) video.currentTime = Number(e.target.value);
            }}
            disabled={status !== "ready"}
            className="seek absolute inset-0 w-full cursor-pointer disabled:cursor-not-allowed"
          />
        </div>

        <div className="flex items-center gap-1">
          <IconButton
            label={paused ? "재생" : "일시정지"}
            onClick={togglePlay}
            disabled={status !== "ready"}
          >
            <Icon name={paused ? "play" : "pause"} />
          </IconButton>
          <IconButton
            label="10초 뒤로"
            onClick={() => seekBy(-SEEK_STEP)}
            disabled={status !== "ready"}
          >
            <Icon name="rewind" />
          </IconButton>
          <IconButton
            label="10초 앞으로"
            onClick={() => seekBy(SEEK_STEP)}
            disabled={status !== "ready"}
          >
            <Icon name="forward" />
          </IconButton>
          <div className="group/vol flex items-center">
            <IconButton
              label={muted || volume === 0 ? "음소거 해제" : "음소거"}
              onClick={toggleMute}
            >
              <Icon
                name={
                  muted || volume === 0
                    ? "muted"
                    : volume < 0.5
                      ? "volumeLow"
                      : "volume"
                }
              />
            </IconButton>
            {volumeSupported && (
              <div className="flex w-0 items-center overflow-hidden transition-[width] duration-[var(--dur-base)] ease-[var(--ease-out)] group-focus-within/vol:w-24 group-hover/vol:w-24">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={muted ? 0 : volume}
                  aria-label="음량"
                  aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)}%`}
                  onChange={(e) => setVolumeTo(Number(e.target.value))}
                  className="vol h-6 w-20 shrink-0 cursor-pointer"
                  style={
                    {
                      "--vol": `${Math.round((muted ? 0 : volume) * 100)}%`,
                    } as React.CSSProperties
                  }
                />
              </div>
            )}
          </div>
          <span className="text-ink-2 ml-2 text-sm tabular-nums">
            {formatTime(currentTime)}
            <span className="text-muted"> / {formatTime(duration)}</span>
          </span>

          <div className="flex-1" />

          {episodes.length > 1 && (
            <div data-menu className="shrink-0">
              <IconButton
                label="에피소드"
                onClick={() =>
                  setMenu((m) => (m === "episodes" ? null : "episodes"))
                }
                expanded={menu === "episodes"}
              >
                <Icon name="list" />
              </IconButton>
            </div>
          )}

          {engine === "hls.js" && levels.length > 1 && (
            <MenuButton
              id={`${menuId}-q`}
              label={
                selected === AUTO
                  ? `자동${playing ? ` · ${playing.height}p` : ""}`
                  : `${levels[selected]?.height}p`
              }
              open={menu === "quality"}
              onToggle={() =>
                setMenu((m) => (m === "quality" ? null : "quality"))
              }
            >
              <MenuItem
                active={selected === AUTO}
                onSelect={() => selectLevel(AUTO)}
              >
                자동
                {playing && (
                  <span className="text-muted ml-2 text-xs">
                    {playing.height}p ·{" "}
                    {(playing.bitrate / 1_000_000).toFixed(1)} Mbps
                  </span>
                )}
              </MenuItem>
              {levelsDesc.map((l) => (
                <MenuItem
                  key={l.index}
                  active={selected === l.index}
                  onSelect={() => selectLevel(l.index)}
                >
                  {l.height}p
                  <span className="text-muted ml-2 text-xs">
                    {(l.bitrate / 1_000_000).toFixed(1)} Mbps
                  </span>
                </MenuItem>
              ))}
            </MenuButton>
          )}

          <MenuButton
            id={`${menuId}-r`}
            label={`${rate}x`}
            open={menu === "rate"}
            onToggle={() => setMenu((m) => (m === "rate" ? null : "rate"))}
          >
            {RATES.map((r) => (
              <MenuItem
                key={r}
                active={rate === r}
                onSelect={() => selectRate(r)}
              >
                {r === 1 ? "기본" : `${r}x`}
              </MenuItem>
            ))}
          </MenuButton>

          <MenuButton
            id={`${menuId}-s`}
            label={
              subtitle === "off"
                ? "자막"
                : (subtitles.find((s) => s.lang === subtitle)?.label ?? "자막")
            }
            open={menu === "subtitle"}
            onToggle={() =>
              setMenu((m) => (m === "subtitle" ? null : "subtitle"))
            }
          >
            {subtitles.length === 0 ? (
              <li role="none" className="text-muted px-4 py-3 text-sm">
                제공되는 자막이 없습니다
              </li>
            ) : (
              <>
                <MenuItem
                  active={subtitle === "off"}
                  onSelect={() => {
                    setSubtitle("off");
                    setMenu(null);
                  }}
                >
                  끔
                </MenuItem>
                {subtitles.map((s) => (
                  <MenuItem
                    key={s.lang}
                    active={subtitle === s.lang}
                    onSelect={() => {
                      setSubtitle(s.lang);
                      setMenu(null);
                    }}
                  >
                    {s.label}
                  </MenuItem>
                ))}
              </>
            )}
          </MenuButton>

          <IconButton
            label={fullscreen ? "전체화면 종료" : "전체화면"}
            onClick={toggleFullscreen}
          >
            <Icon name={fullscreen ? "shrink" : "expand"} />
          </IconButton>
        </div>
      </div>

      {!episodesOpen && !postPlay && mutedHint && muted && !ended && (
        <button
          type="button"
          onClick={toggleMute}
          className={`bg-paper-2/90 text-ink hover:bg-paper-3 absolute right-4 z-10 inline-flex h-11 items-center gap-2 rounded-full border border-white/10 px-4 text-sm font-medium shadow-xl backdrop-blur transition-[bottom,background-color] duration-[var(--dur-slow)] ease-[var(--ease-out)] sm:right-8 ${chromeVisible ? "bottom-28" : "bottom-4"}`}
        >
          <Icon name="muted" size={18} />
          음소거 해제
        </button>
      )}

      {postPlay && endCard && (
        <div className="absolute inset-0 z-10 overflow-hidden bg-black">
          {endCard.image && (
            <Image
              src={endCard.image}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          )}
          {endCard.trailer && !reducedMotion && (
            <TrailerPreview src={endCard.trailer} />
          )}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-linear-to-t from-black/85 via-black/35 via-45% to-transparent sm:bg-linear-to-r sm:from-black/80 sm:via-black/30 sm:via-50% sm:to-transparent"
          />
          <div className="relative mx-auto flex h-full w-full max-w-7xl flex-col justify-end px-6 pb-28 sm:px-16 sm:pr-[32%] sm:pb-24">
            <p className="text-ink-2 text-sm font-medium tracking-wide sm:text-base">
              {endCard.eyebrow}
            </p>
            <h2 className="text-ink mt-2 max-w-2xl text-3xl font-bold tracking-tight [overflow-wrap:anywhere] sm:text-5xl">
              {endCard.title}
            </h2>
            <p className="text-ink-2 mt-3 text-sm">{endCard.meta}</p>
            {endCard.description && (
              <p className="text-ink-2 mt-4 line-clamp-3 max-w-xl text-base leading-relaxed break-keep sm:text-lg">
                {endCard.description}
              </p>
            )}
            <div className="mt-7 flex flex-wrap gap-3">
              {postPlayEnded ? (
                <Link
                  href={endCard.href}
                  onClick={() => {
                    navigatedRef.current = true;
                  }}
                  className="bg-ink text-paper hover:bg-ink-2 inline-flex h-12 items-center gap-2 rounded-full px-6 text-base font-semibold transition-colors duration-[var(--dur-base)] active:translate-y-px"
                >
                  <Icon name="play" size={20} /> {endCard.cta}
                </Link>
              ) : (
                <>
                  <span role="status" aria-live="polite" className="sr-only">
                    {NEXT_AUTOPLAY_MS / 1000}초 후 {endCard.title} 자동 재생
                  </span>
                  <Link
                    href={endCard.href}
                    onClick={() => {
                      navigatedRef.current = true;
                    }}
                    className="bg-ink/25 text-ink relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-full px-6 text-base font-semibold backdrop-blur transition-[filter] duration-[var(--dur-base)] hover:brightness-125 active:translate-y-px"
                  >
                    <span className="relative flex items-center gap-2">
                      <Icon name="play" size={20} /> {endCard.cta}
                    </span>
                    <span
                      aria-hidden="true"
                      className="next-fill bg-ink text-paper absolute inset-0 flex items-center gap-2 px-6"
                      style={{
                        animationDuration: `${NEXT_AUTOPLAY_MS}ms`,
                        animationPlayState: paused ? "paused" : "running",
                      }}
                    >
                      <Icon name="play" size={20} /> {endCard.cta}
                    </span>
                  </Link>
                </>
              )}
              {endCard.detailHref && (
                <Link
                  href={endCard.detailHref}
                  scroll={false}
                  onClick={() => {
                    navigatedRef.current = true;
                    setNextPrompt("cancelled");
                  }}
                  className="text-ink hover:bg-paper-3/70 inline-flex h-12 items-center gap-2 rounded-full border border-white/20 bg-black/40 px-6 text-base font-medium backdrop-blur transition-colors duration-[var(--dur-base)]"
                >
                  상세 정보
                </Link>
              )}
              {!postPlayEnded && (
                <button
                  type="button"
                  onClick={() => setNextPrompt("cancelled")}
                  className="text-ink hover:bg-paper-3/70 inline-flex h-12 items-center gap-2 rounded-full border border-white/20 bg-black/40 px-6 text-base font-medium backdrop-blur transition-colors duration-[var(--dur-base)]"
                >
                  크레딧 보기
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {postPlayEnded && (
        <div className="pointer-events-none absolute right-6 bottom-6 z-30 flex h-[30%] w-[30%] items-center justify-center sm:right-16 sm:bottom-8 sm:h-[22%] sm:w-[22%]">
          <button
            type="button"
            onClick={replay}
            aria-label="다시 보기"
            title="다시 보기"
            className="text-ink hover:bg-paper-3/90 pointer-events-auto inline-flex size-12 items-center justify-center rounded-full bg-black/65 ring-1 ring-white/30 backdrop-blur transition-[background-color,transform] duration-[var(--dur-base)] active:scale-95 sm:size-14"
          >
            <Icon name="replay" size={24} />
          </button>
        </div>
      )}

      {mode === "full" && ended && !endCard && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-black/75 px-6 text-center backdrop-blur-sm">
          <h2 className="text-ink text-2xl font-bold tracking-tight sm:text-4xl">
            재생이 끝났습니다
          </h2>
          <button
            type="button"
            onClick={replay}
            className="text-ink hover:bg-paper-3/70 inline-flex h-12 items-center gap-2 rounded-full border border-white/20 px-6 text-base font-medium transition-colors duration-[var(--dur-base)]"
          >
            <Icon name="replay" size={18} /> 다시 보기
          </button>
        </div>
      )}

      {status === "error" && (
        <div
          role="alert"
          className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 px-6 text-center"
        >
          <p className="text-ink text-base">{errorMsg}</p>
          {engine !== "unsupported" && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="bg-ink text-paper hover:bg-ink-2 inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold transition-colors duration-[var(--dur-base)] active:translate-y-px"
            >
              다시 시도
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  expanded,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** 토글형 버튼(패널 열림)일 때 aria-expanded + 눌림 배경 */
  expanded?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-expanded={expanded}
      onClick={onClick}
      disabled={disabled}
      className="text-ink hover:bg-paper-3 active:bg-paper-2 aria-expanded:bg-paper-3 inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-[var(--dur-base)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function MenuButton({
  id,
  label,
  open,
  onToggle,
  wide = false,
  children,
}: {
  id: string;
  label: string;
  open: boolean;
  onToggle: () => void;
  /** 긴 항목(에피소드 제목)용 넓은 패널 */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative shrink-0" data-menu>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className="text-ink hover:bg-paper-3 active:bg-paper-2 aria-expanded:bg-paper-3 inline-flex h-11 items-center rounded-full px-3 text-sm font-medium transition-colors duration-[var(--dur-base)]"
      >
        {label}
      </button>
      {open && (
        <ul
          id={id}
          role="menu"
          className={`bg-paper-2 border-rule absolute right-0 bottom-full z-10 mb-2 overflow-hidden rounded-xl border py-1 shadow-xl ${wide ? "w-72 max-w-[calc(100vw-2rem)]" : "min-w-44"}`}
        >
          {children}
        </ul>
      )}
    </div>
  );
}

function MenuItem({
  active,
  onSelect,
  children,
}: {
  active: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <li role="none">
      <button
        type="button"
        role="menuitemradio"
        aria-checked={active}
        onClick={onSelect}
        className="text-ink hover:bg-paper-3 active:bg-paper aria-checked:text-accent flex h-11 w-full items-center px-4 text-left text-sm transition-colors duration-[var(--dur-fast)]"
      >
        {children}
      </button>
    </li>
  );
}

const ICONS = {
  back: <path d="M15 5l-7 7 7 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  list: (
    <>
      <path d="M4 6h2M4 12h2M4 18h2" />
      <path d="M10 6h10M10 12h10M10 18h10" />
    </>
  ),
  replay: (
    <>
      <path d="M4 12a8 8 0 1 0 2.5-5.8" />
      <path d="M4 4v5h5" />
    </>
  ),
  play: <path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" />,
  pause: (
    <path
      d="M7 4.5h3.5v15H7zM13.5 4.5H17v15h-3.5z"
      fill="currentColor"
      stroke="none"
    />
  ),
  rewind: (
    <>
      <path
        d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"
        fill="currentColor"
        stroke="none"
      />
      <text
        x="12"
        y="15.8"
        fontSize="6.5"
        fontWeight="700"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
      >
        10
      </text>
    </>
  ),
  forward: (
    <>
      <path
        d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"
        fill="currentColor"
        stroke="none"
      />
      <text
        x="12"
        y="15.8"
        fontSize="6.5"
        fontWeight="700"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
      >
        10
      </text>
    </>
  ),
  volume: (
    <path d="M4 10v4h3l4 4V6l-4 4zM15 9a4 4 0 0 1 0 6M17.5 6.5a8 8 0 0 1 0 11" />
  ),
  muted: <path d="M4 10v4h3l4 4V6l-4 4zM15 9l5 6M20 9l-5 6" />,
  volumeLow: <path d="M4 10v4h3l4 4V6l-4 4zM15 9a4 4 0 0 1 0 6" />,
  expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  shrink: <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />,
} as const;

function Icon({
  name,
  size = 22,
}: {
  name: keyof typeof ICONS;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}
